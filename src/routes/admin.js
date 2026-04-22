import { Router } from 'express';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import multer from 'multer';
import { pairsDb, usersDb } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { importTimetable } from '../parsers/timetable.js';
import { normalizeDate } from '../utils/dates.js';
import { AVAILABLE_ROLES, hasPermission } from '../utils/permissions.js';
import { createAccessToken, decryptBuffer, decryptText, encryptBuffer, encryptText } from '../utils/uw-crypto.js';
import { sendUnifiedWindowEmail } from '../utils/uw-notify.js';
import fs from 'node:fs';
import path from 'node:path';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const uploadUnifiedAttachment = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (hasPermission(req.user?.role, permission)) {
      return next();
    }
    return res.status(403).json({ error: `Forbidden: missing permission ${permission}` });
  };
}

function mapTicket(row) {
  if (!row) return null;
  return {
    ...row,
    tracking_code: `UW-${String(row.id).padStart(6, '0')}`,
  };
}

function getDueAtByPriority(priority) {
  const now = new Date();
  const due = new Date(now);
  if (priority === 'critical') due.setHours(due.getHours() + 2);
  else if (priority === 'high') due.setHours(due.getHours() + 8);
  else if (priority === 'low') due.setDate(due.getDate() + 3);
  else due.setDate(due.getDate() + 1);
  return due.toISOString().slice(0, 19).replace('T', ' ');
}

function recordStatusHistory(ticketId, oldStatus, newStatus, changedBy, note = null) {
  pairsDb.prepare(
    'INSERT INTO unified_window_status_history (ticket_id, old_status, new_status, changed_by, note, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(ticketId, oldStatus, newStatus, changedBy, note, nowSql());
}

// ---------------------------------------------------------------------------
// POST /adminapi/login  (также /admin/login)
// Body: { username, password }
// ---------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const usersCount = usersDb.prepare('SELECT COUNT(*) AS count FROM users').get()?.count ?? 0;
  if (!usersCount) {
    return res.status(503).json({
      error: 'Admin users are not configured. Run: npm run seed or npm run users:create -- <username> <password> true',
    });
  }

  const user = usersDb.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.is_active) {
    return res.status(403).json({ error: 'User is disabled' });
  }

  // Argon2id — проверка пароля
  const valid = await argon2.verify(user.password, password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { uid: user.id, username: user.username, auth: true },
    config.jwtSecret,
    { algorithm: 'HS256', expiresIn: '24h' }
  );

  res.json({ token, role: user.role || 'admin' });
});

// ---------------------------------------------------------------------------
// POST /adminapi/checktoken
// ---------------------------------------------------------------------------
router.post('/checktoken', requireAuth, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ---------------------------------------------------------------------------
// GET /adminapi/profile
// ---------------------------------------------------------------------------
router.get('/profile', requireAuth, (req, res) => {
  const user = usersDb.prepare(
    `SELECT id, username, first_name, last_name, position, email, is_active, created_at, updated_at
     FROM users
     WHERE id = ?`
  ).get(req.user.uid);

  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    id: user.id,
    username: user.username,
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    position: user.position ?? '',
    email: user.email ?? '',
    is_active: Boolean(user.is_active),
    created_at: user.created_at ?? null,
    updated_at: user.updated_at ?? null,
  });
});

// ---------------------------------------------------------------------------
// PATCH /adminapi/profile
// Body: { username?, first_name?, last_name?, position?, email?, current_password?, new_password? }
// ---------------------------------------------------------------------------
router.patch('/profile', requireAuth, async (req, res) => {
  const current = usersDb.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid);
  if (!current) return res.status(404).json({ error: 'User not found' });

  const updates = [];
  const params = { id: req.user.uid, updatedAt: nowSql() };

  if (req.body?.username !== undefined) {
    const safeUsername = String(req.body.username ?? '').trim();
    if (safeUsername.length < 3) {
      return res.status(400).json({ error: 'username must be at least 3 characters' });
    }
    const conflict = usersDb.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(safeUsername, req.user.uid);
    if (conflict) return res.status(409).json({ error: 'username already exists' });
    updates.push('username = @username');
    params.username = safeUsername;
  }

  for (const field of ['first_name', 'last_name', 'position']) {
    if (req.body?.[field] !== undefined) {
      updates.push(`${field} = @${field}`);
      params[field] = String(req.body[field] ?? '').trim() || null;
    }
  }

  if (req.body?.email !== undefined) {
    const email = String(req.body.email ?? '').trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'email is invalid' });
    }
    updates.push('email = @email');
    params.email = email || null;
  }

  if (req.body?.new_password !== undefined && req.body.new_password !== '') {
    const currentPassword = String(req.body.current_password ?? '');
    if (!currentPassword) {
      return res.status(400).json({ error: 'current_password is required to change password' });
    }
    const valid = await argon2.verify(current.password, currentPassword);
    if (!valid) {
      return res.status(401).json({ error: 'current_password is invalid' });
    }

    const newPassword = String(req.body.new_password);
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'new_password must be at least 8 characters' });
    }

    updates.push('password = @password');
    params.password = await argon2.hash(newPassword, { type: argon2.argon2id });
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push('updated_at = @updatedAt');
  usersDb.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = @id`).run(params);

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// GET /adminapi/users
// ---------------------------------------------------------------------------
router.get('/users', requireAuth, (_req, res) => {
  const users = usersDb
    .prepare(
      `SELECT id, username, is_active, created_at, updated_at
       FROM users
       ORDER BY username COLLATE NOCASE`
    )
    .all();

  res.json(users.map(u => ({
    id: u.id,
    username: u.username,
    is_active: Boolean(u.is_active),
    created_at: u.created_at ?? null,
    updated_at: u.updated_at ?? null,
  })));
});

// ---------------------------------------------------------------------------
// POST /adminapi/users
// Body: { username, password, is_active? }
// ---------------------------------------------------------------------------
router.post('/users', requireAuth, async (req, res) => {
  const { username, password, is_active } = req.body ?? {};
  const safeUsername = String(username ?? '').trim();

  if (!safeUsername || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  if (safeUsername.length < 3) {
    return res.status(400).json({ error: 'username must be at least 3 characters' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  const exists = usersDb.prepare('SELECT id FROM users WHERE username = ?').get(safeUsername);
  if (exists) {
    return res.status(409).json({ error: 'username already exists' });
  }

  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const now = nowSql();
  const result = usersDb
    .prepare('INSERT INTO users (username, password, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(safeUsername, hash, is_active === false ? 0 : 1, now, now);

  res.json({ ok: true, id: result.lastInsertRowid });
});

// ---------------------------------------------------------------------------
// PATCH /adminapi/users/:id
// Body: { username?, password?, is_active? }
// ---------------------------------------------------------------------------
router.patch('/users/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });

  const target = usersDb.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const updates = [];
  const params = { id, updatedAt: nowSql() };

  if (req.body?.username !== undefined) {
    const safeUsername = String(req.body.username ?? '').trim();
    if (safeUsername.length < 3) {
      return res.status(400).json({ error: 'username must be at least 3 characters' });
    }
    const conflict = usersDb.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(safeUsername, id);
    if (conflict) return res.status(409).json({ error: 'username already exists' });
    updates.push('username = @username');
    params.username = safeUsername;
  }

  if (req.body?.password !== undefined && req.body.password !== '') {
    const pwd = String(req.body.password);
    if (pwd.length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters' });
    }
    params.password = await argon2.hash(pwd, { type: argon2.argon2id });
    updates.push('password = @password');
  }

  if (req.body?.is_active !== undefined) {
    const active = req.body.is_active ? 1 : 0;
    if (id === req.user.uid && !active) {
      return res.status(400).json({ error: 'You cannot disable your own account' });
    }
    params.is_active = active;
    updates.push('is_active = @is_active');
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push('updated_at = @updatedAt');
  usersDb.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = @id`).run(params);

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /adminapi/users/:id/disable
// POST /adminapi/users/:id/enable
// ---------------------------------------------------------------------------
router.post('/users/:id/disable', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });
  if (id === req.user.uid) return res.status(400).json({ error: 'You cannot disable your own account' });

  const result = usersDb
    .prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?')
    .run(nowSql(), id);

  if (!result.changes) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

router.post('/users/:id/enable', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });

  const result = usersDb
    .prepare('UPDATE users SET is_active = 1, updated_at = ? WHERE id = ?')
    .run(nowSql(), id);

  if (!result.changes) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// DELETE /adminapi/users/:id
// ---------------------------------------------------------------------------
router.delete('/users/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });
  if (id === req.user.uid) return res.status(400).json({ error: 'You cannot delete your own account' });

  const result = usersDb.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (!result.changes) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Catalog CRUD for manual schedule setup
// ---------------------------------------------------------------------------
router.get('/catalog/courses', requireAuth, (_req, res) => {
  const rows = pairsDb.prepare('SELECT id, course, created_at FROM course_catalog ORDER BY course').all();
  res.json(rows);
});

router.post('/catalog/courses', requireAuth, (req, res) => {
  const course = Number.parseInt(req.body?.course, 10);
  if (Number.isNaN(course)) {
    return res.status(400).json({ error: 'course must be a number' });
  }

  const result = pairsDb.prepare(
    'INSERT OR IGNORE INTO course_catalog (course, created_at) VALUES (?, ?)'
  ).run(course, nowSql());

  res.json({ ok: true, inserted: result.changes > 0 });
});

router.get('/catalog/groups', requireAuth, (req, res) => {
  const course = req.query.course !== undefined ? Number.parseInt(req.query.course, 10) : null;
  if (req.query.course !== undefined && Number.isNaN(course)) {
    return res.status(400).json({ error: 'course must be a number' });
  }

  const rows = course === null
    ? pairsDb.prepare('SELECT id, course, group_name, created_at FROM group_catalog ORDER BY course, group_name').all()
    : pairsDb.prepare('SELECT id, course, group_name, created_at FROM group_catalog WHERE course = ? ORDER BY group_name').all(course);

  res.json(rows);
});

router.post('/catalog/groups', requireAuth, (req, res) => {
  const course = Number.parseInt(req.body?.course, 10);
  const groupName = String(req.body?.group_name ?? '').trim();

  if (Number.isNaN(course) || !groupName) {
    return res.status(400).json({ error: 'course and group_name are required' });
  }

  const result = pairsDb.prepare(
    'INSERT OR IGNORE INTO group_catalog (course, group_name, created_at) VALUES (?, ?, ?)'
  ).run(course, groupName, nowSql());

  res.json({ ok: true, inserted: result.changes > 0 });
});

// ---------------------------------------------------------------------------
// DELETE /adminapi/deletetable
// ---------------------------------------------------------------------------
router.delete('/deletetable', requireAuth, (_req, res) => {
  pairsDb.prepare('DELETE FROM pairs').run();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /adminapi/createtable  — загрузить JSON расписания (полная замена)
// Поле формы: file
// ---------------------------------------------------------------------------
router.post('/createtable', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let data;
  try {
    data = JSON.parse(req.file.buffer.toString('utf-8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  pairsDb.prepare('DELETE FROM pairs').run();

  try {
    const count = importTimetable(data);
    updateLastUpdate();
    res.json({ ok: true, inserted: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /adminapi/updatetable  — дополнить расписание из JSON
// Поле формы: file
// ---------------------------------------------------------------------------
router.post('/updatetable', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let data;
  try {
    data = JSON.parse(req.file.buffer.toString('utf-8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  try {
    const count = importTimetable(data);
    updateLastUpdate();
    res.json({ ok: true, inserted: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /adminapi/updatepairs  — ручное редактирование пар
// Body: { group, course, date, week_number, weekday, lessons: [...] }
// lesson.method: "create"|"update"|"delete"|"pass"
// ---------------------------------------------------------------------------
router.post('/updatepairs', requireAuth, (req, res) => {
  const { group, course, date, week_number, weekday, lessons } = req.body ?? {};

  if (!group || !Array.isArray(lessons)) {
    return res.status(400).json({ error: 'group and lessons[] are required' });
  }

  const normalDate = normalizeDate(date ?? '');
  const insert = pairsDb.prepare(
    `INSERT INTO pairs (week_number, weekday, course, group_name, date, time, type, subject, teacher, auditory, date_start, date_end)
     VALUES (@week_number, @weekday, @course, @group_name, @date, @time, @type, @subject, @teacher, @auditory, @date_start, @date_end)`
  );
  const update = pairsDb.prepare(
    `UPDATE pairs SET type=@type, subject=@subject, teacher=@teacher, auditory=@auditory WHERE id=@id`
  );
  const del = pairsDb.prepare('DELETE FROM pairs WHERE id=?');

  const run = pairsDb.transaction(() => {
    for (const lesson of lessons) {
      switch (lesson.method) {
        case 'create':
          insert.run({
            week_number, weekday, course, group_name: group,
            date: normalDate, time: lesson.time ?? null,
            type: lesson.type ?? null, subject: lesson.subject ?? null,
            teacher: lesson.teacher ?? null, auditory: lesson.auditory ?? null,
            date_start: null, date_end: null,
          });
          break;
        case 'update':
          update.run({ id: lesson.id, type: lesson.type, subject: lesson.subject, teacher: lesson.teacher, auditory: lesson.auditory });
          break;
        case 'delete':
          del.run(lesson.id);
          break;
        case 'pass':
        default:
          break;
      }
    }
  });

  run();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /adminapi/updatetimes  — CRUD расписания звонков
// Body: массив { id?, time, time_start, time_end, method: create|update|delete|pass }
// ---------------------------------------------------------------------------
router.post('/updatetimes', requireAuth, (req, res) => {
  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Body must be an array' });

  const insert = pairsDb.prepare('INSERT INTO times (time, time_start, time_end) VALUES (@time, @time_start, @time_end)');
  const update = pairsDb.prepare('UPDATE times SET time=@time, time_start=@time_start, time_end=@time_end WHERE id=@id');
  const del    = pairsDb.prepare('DELETE FROM times WHERE id=?');

  const run = pairsDb.transaction(() => {
    for (const item of items) {
      switch (item.method) {
        case 'create': insert.run({ time: item.time, time_start: item.time_start, time_end: item.time_end }); break;
        case 'update': update.run({ id: item.id, time: item.time, time_start: item.time_start, time_end: item.time_end }); break;
        case 'delete': del.run(item.id); break;
        default: break;
      }
    }
  });

  run();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Unified Window admin endpoints
// ---------------------------------------------------------------------------
router.get('/unified-window/tickets', requireAuth, (req, res) => {
  const status = String(req.query.status ?? '').trim();
  const role = String(req.query.role ?? '').trim();
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit ?? '100', 10), 1), 500);

  const conditions = [];
  const params = {};
  if (status) {
    conditions.push('status = @status');
    params.status = status;
  }
  if (role) {
    conditions.push('requester_role = @role');
    params.role = role;
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = pairsDb.prepare(
    `SELECT id, requester_role, requester_name, requester_email, subject, message,
            status, source, assignee, response_text, internal_note, created_at, updated_at
     FROM unified_window_tickets
     ${where}
     ORDER BY id DESC
     LIMIT ${limit}`
  ).all(params);

  res.json(rows);
});

router.patch('/unified-window/tickets/:id', requireAuth, (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ticket id' });
  }

  const updates = [];
  const params = { id, updated_at: nowSql() };

  if (req.body?.status !== undefined) {
    const status = String(req.body.status).trim();
    const allowed = new Set(['new', 'in_progress', 'resolved', 'closed']);
    if (!allowed.has(status)) {
      return res.status(400).json({ error: 'status must be one of: new, in_progress, resolved, closed' });
    }
    updates.push('status = @status');
    params.status = status;
  }

  for (const field of ['assignee', 'response_text', 'internal_note']) {
    if (req.body?.[field] !== undefined) {
      updates.push(`${field} = @${field}`);
      params[field] = String(req.body[field] ?? '').trim() || null;
    }
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push('updated_at = @updated_at');
  const result = pairsDb.prepare(
    `UPDATE unified_window_tickets SET ${updates.join(', ')} WHERE id = @id`
  ).run(params);

  if (!result.changes) return res.status(404).json({ error: 'Ticket not found' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /adminapi/createnews  — создать новость
// Body: { content }
// ---------------------------------------------------------------------------
router.post('/createnews', requireAuth, (req, res) => {
  const { content } = req.body ?? {};
  if (!content) return res.status(400).json({ error: 'content is required' });

  const now = nowSql();
  const result = pairsDb.prepare(
    'INSERT INTO news (content, date) VALUES (?, ?)'
  ).run(content, now);

  res.json({ ok: true, id: result.lastInsertRowid });
});

// ---------------------------------------------------------------------------
// POST /adminapi/editnews?id=N
// Body: { content }
// ---------------------------------------------------------------------------
router.post('/editnews', requireAuth, (req, res) => {
  const id = parseInt(req.query.id, 10);
  const { content } = req.body ?? {};

  if (isNaN(id)) return res.status(400).json({ error: 'Missing param: id' });
  if (!content) return res.status(400).json({ error: 'content is required' });

  const now = nowSql();
  pairsDb.prepare(
    'UPDATE news SET content = ?, last_change = ? WHERE id = ?'
  ).run(content, now, id);

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// DELETE /adminapi/deletenews?id=N
// ---------------------------------------------------------------------------
router.delete('/deletenews', requireAuth, (req, res) => {
  const id = parseInt(req.query.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Missing param: id' });

  pairsDb.prepare('DELETE FROM news WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------

function updateLastUpdate() {
  const settingsPath = path.resolve(process.cwd(), 'settings.json');
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); } catch { /* новый файл */ }

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  settings.last_update =
    `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

export default router;
