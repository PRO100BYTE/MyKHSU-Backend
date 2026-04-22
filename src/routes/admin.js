import { Router } from 'express';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import multer from 'multer';
import { pairsDb, usersDb } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { importTimetable } from '../parsers/timetable.js';
import { normalizeDate } from '../utils/dates.js';
import { hasPermission, USER_ROLES } from '../utils/permissions.js';
import { encryptText, decryptText, encryptBuffer, decryptBuffer } from '../utils/uw-crypto.js';
import { sendUnifiedWindowEmail } from '../utils/uw-notify.js';
import fs from 'node:fs';
import path from 'node:path';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const uploadUw = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Middleware: проверяет разрешение у аутентифицированного пользователя.
 * @param {string} permission
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.user?.role, permission)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' })
    }
    next()
  }
}

/**
 * Возвращает дату дедлайна (ISO) в зависимости от приоритета тикета.
 * @param {'low'|'normal'|'high'|'urgent'} priority
 * @returns {string}
 */
function getDueAtByPriority(priority) {
  const hoursMap = { urgent: 4, high: 24, normal: 72, low: 168 }
  const hours = hoursMap[priority] ?? 72
  const due = new Date(Date.now() + hours * 60 * 60 * 1000)
  return due.toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * Записывает смену статуса тикета в историю.
 */
function recordStatusHistory(ticketId, fromStatus, toStatus, changedBy, comment) {
  usersDb.prepare(
    `INSERT INTO unified_window_status_history (ticket_id, from_status, to_status, changed_by, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(ticketId, fromStatus ?? null, toStatus, changedBy ?? null, comment ?? null, nowSql())
}

/**
 * Маппинг строки БД → объект тикета для ответа API.
 */
function mapTicket(row) {
  const subject = decryptTicketField(row, 'subject')
  const contactEmail = decryptTicketField(row, 'contact_email')
  const contactName = decryptTicketField(row, 'contact_name')
  return {
    id: row.id,
    subject,
    contact_email: contactEmail,
    contact_name: contactName,
    status: row.status,
    priority: row.priority,
    access_token: row.access_token,
    due_at: row.due_at,
    first_response_at: row.first_response_at,
    resolved_at: row.resolved_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function decryptTicketField(row, field) {
  const iv = row[`encrypted_${field}_iv`]
  const tag = row[`encrypted_${field}_tag`]
  const data = row[`encrypted_${field}_data`]

  if (iv && tag && data) {
    try {
      return decryptText({ iv, tag, data })
    } catch {
      return row[field] ?? null
    }
  }
  return row[field] ?? null
}

function normalizeNullableText(value, maxLen = 255) {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLen)
}

function normalizeEmail(value) {
  const email = normalizeNullableText(value, 255)
  return email ? email.toLowerCase() : null
}

const WEEKDAY_NAME_TO_NUM = {
  'понедельник': 1,
  'вторник': 2,
  'среда': 3,
  'четверг': 4,
  'пятница': 5,
  'суббота': 6,
  'воскресенье': 7,
}

function normalizeWeekday(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number') {
    if (value >= 1 && value <= 7) return value
    return null
  }
  const str = String(value).trim()
  if (!str) return null
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10)
    return num >= 1 && num <= 7 ? num : null
  }
  return WEEKDAY_NAME_TO_NUM[str.toLowerCase()] ?? null
}

function parseTimeRange(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const range = raw.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/)
  if (range) {
    return { time_start: range[1], time_end: range[2] }
  }

  const single = raw.match(/^(\d{1,2}:\d{2})$/)
  if (single) {
    return { time_start: single[1], time_end: single[1] }
  }

  return null
}

function resolveTimeId(rawTime) {
  if (rawTime === undefined || rawTime === null || rawTime === '') return null

  if (typeof rawTime === 'number' || /^\d+$/.test(String(rawTime).trim())) {
    const id = parseInt(rawTime, 10)
    if (Number.isNaN(id)) return null
    const exists = pairsDb.prepare('SELECT id FROM times WHERE id = ?').get(id)
    return exists ? id : null
  }

  const range = parseTimeRange(rawTime)
  if (!range) return null

  const existing = pairsDb
    .prepare('SELECT id FROM times WHERE time_start = ? AND time_end = ?')
    .get(range.time_start, range.time_end)
  if (existing) return existing.id

  const maxRow = pairsDb.prepare('SELECT COALESCE(MAX(time), 0) AS max_time FROM times').get()
  const nextTime = (maxRow?.max_time ?? 0) + 1
  const inserted = pairsDb
    .prepare('INSERT INTO times (time, time_start, time_end) VALUES (?, ?, ?)')
    .run(nextTime, range.time_start, range.time_end)
  return Number(inserted.lastInsertRowid)
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

  res.json({ token, role: user.role ?? 'admin' });
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
  const profile = usersDb
    .prepare('SELECT id, username, is_active, role, first_name, last_name, position, email, created_at, updated_at FROM users WHERE id = ?')
    .get(req.user.uid)

  if (!profile) return res.status(404).json({ error: 'User not found' })

  res.json(profile)
})

// ---------------------------------------------------------------------------
// PATCH /adminapi/profile
// Body: { username?, first_name?, last_name?, position?, email?, current_password?, new_password? }
// ---------------------------------------------------------------------------
router.patch('/profile', requireAuth, async (req, res) => {
  const me = usersDb.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid)
  if (!me) return res.status(404).json({ error: 'User not found' })

  const updates = []
  const params = { id: req.user.uid, updatedAt: nowSql() }

  if (req.body?.username !== undefined) {
    const safeUsername = String(req.body.username ?? '').trim()
    if (safeUsername.length < 3) {
      return res.status(400).json({ error: 'username must be at least 3 characters' })
    }
    const conflict = usersDb.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(safeUsername, req.user.uid)
    if (conflict) return res.status(409).json({ error: 'username already exists' })
    params.username = safeUsername
    updates.push('username = @username')
  }

  if (req.body?.first_name !== undefined) {
    params.first_name = normalizeNullableText(req.body.first_name, 120)
    updates.push('first_name = @first_name')
  }
  if (req.body?.last_name !== undefined) {
    params.last_name = normalizeNullableText(req.body.last_name, 120)
    updates.push('last_name = @last_name')
  }
  if (req.body?.position !== undefined) {
    params.position = normalizeNullableText(req.body.position, 160)
    updates.push('position = @position')
  }
  if (req.body?.email !== undefined) {
    params.email = normalizeEmail(req.body.email)
    updates.push('email = @email')
  }

  if (req.body?.new_password !== undefined && String(req.body.new_password).trim() !== '') {
    const currentPassword = String(req.body.current_password ?? '')
    const newPassword = String(req.body.new_password)
    const valid = await argon2.verify(me.password, currentPassword)
    if (!valid) return res.status(400).json({ error: 'current_password is invalid' })
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'new_password must be at least 8 characters' })
    }
    params.password = await argon2.hash(newPassword, { type: argon2.argon2id })
    updates.push('password = @password')
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No fields to update' })
  }

  updates.push('updated_at = @updatedAt')
  usersDb.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = @id`).run(params)

  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// GET /adminapi/users
// ---------------------------------------------------------------------------
router.get('/users', requireAuth, requirePermission('users:manage'), (_req, res) => {
  const users = usersDb
    .prepare(
      `SELECT id, username, is_active, role, first_name, last_name, position, email, created_at, updated_at
       FROM users
       ORDER BY username COLLATE NOCASE`
    )
    .all();

  res.json(users.map(u => ({
    id: u.id,
    username: u.username,
    is_active: Boolean(u.is_active),
    role: u.role ?? 'admin',
    first_name: u.first_name ?? null,
    last_name: u.last_name ?? null,
    position: u.position ?? null,
    email: u.email ?? null,
    created_at: u.created_at ?? null,
    updated_at: u.updated_at ?? null,
  })));
});

// ---------------------------------------------------------------------------
// POST /adminapi/users
// Body: { username, password, is_active?, role? }
// ---------------------------------------------------------------------------
router.post('/users', requireAuth, requirePermission('users:manage'), async (req, res) => {
  const { username, password, is_active, role, first_name, last_name, position, email } = req.body ?? {};
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

  const validRoles = Object.values(USER_ROLES)
  const safeRole = validRoles.includes(role) ? role : USER_ROLES.ADMIN

  const exists = usersDb.prepare('SELECT id FROM users WHERE username = ?').get(safeUsername);
  if (exists) {
    return res.status(409).json({ error: 'username already exists' });
  }

  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const now = nowSql();
  const result = usersDb
    .prepare('INSERT INTO users (username, password, is_active, role, first_name, last_name, position, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(
      safeUsername,
      hash,
      is_active === false ? 0 : 1,
      safeRole,
      normalizeNullableText(first_name, 120),
      normalizeNullableText(last_name, 120),
      normalizeNullableText(position, 160),
      normalizeEmail(email),
      now,
      now,
    );

  res.json({ ok: true, id: result.lastInsertRowid });
});

// ---------------------------------------------------------------------------
// PATCH /adminapi/users/:id
// Body: { username?, password?, is_active?, role? }
// ---------------------------------------------------------------------------
router.patch('/users/:id', requireAuth, requirePermission('users:manage'), async (req, res) => {
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

  if (req.body?.role !== undefined) {
    const validRoles = Object.values(USER_ROLES)
    if (!validRoles.includes(req.body.role)) {
      return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` })
    }
    params.role = req.body.role
    updates.push('role = @role')
  }

  if (req.body?.first_name !== undefined) {
    params.first_name = normalizeNullableText(req.body.first_name, 120)
    updates.push('first_name = @first_name')
  }
  if (req.body?.last_name !== undefined) {
    params.last_name = normalizeNullableText(req.body.last_name, 120)
    updates.push('last_name = @last_name')
  }
  if (req.body?.position !== undefined) {
    params.position = normalizeNullableText(req.body.position, 160)
    updates.push('position = @position')
  }
  if (req.body?.email !== undefined) {
    params.email = normalizeEmail(req.body.email)
    updates.push('email = @email')
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
router.post('/users/:id/disable', requireAuth, requirePermission('users:manage'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });
  if (id === req.user.uid) return res.status(400).json({ error: 'You cannot disable your own account' });

  const result = usersDb
    .prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?')
    .run(nowSql(), id);

  if (!result.changes) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

router.post('/users/:id/enable', requireAuth, requirePermission('users:manage'), (req, res) => {
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
router.delete('/users/:id', requireAuth, requirePermission('users:manage'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });
  if (id === req.user.uid) return res.status(400).json({ error: 'You cannot delete your own account' });

  const result = usersDb.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (!result.changes) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Каталог курсов/групп для ручного ввода расписания
// ---------------------------------------------------------------------------
router.get('/catalog/courses', requireAuth, requirePermission('schedule:write'), (_req, res) => {
  const rows = pairsDb
    .prepare('SELECT id, course, created_at FROM course_catalog ORDER BY course')
    .all()
  res.json(rows)
})

router.post('/catalog/courses', requireAuth, requirePermission('schedule:write'), (req, res) => {
  const course = parseInt(req.body?.course, 10)
  if (Number.isNaN(course) || course < -1 || course > 10) {
    return res.status(400).json({ error: 'course must be an integer between -1 and 10' })
  }

  const now = nowSql()
  const result = pairsDb
    .prepare('INSERT OR IGNORE INTO course_catalog (course, created_at) VALUES (?, ?)')
    .run(course, now)
  res.json({ ok: true, inserted: result.changes > 0 })
})

router.get('/catalog/groups', requireAuth, requirePermission('schedule:write'), (req, res) => {
  const courseFilter = req.query?.course
  if (courseFilter !== undefined && courseFilter !== '') {
    const course = parseInt(courseFilter, 10)
    if (Number.isNaN(course)) return res.status(400).json({ error: 'Invalid course' })
    const rows = pairsDb
      .prepare('SELECT id, course, group_name, created_at FROM group_catalog WHERE course = ? ORDER BY group_name COLLATE NOCASE')
      .all(course)
    return res.json(rows)
  }

  const rows = pairsDb
    .prepare('SELECT id, course, group_name, created_at FROM group_catalog ORDER BY course, group_name COLLATE NOCASE')
    .all()
  res.json(rows)
})

router.post('/catalog/groups', requireAuth, requirePermission('schedule:write'), (req, res) => {
  const course = parseInt(req.body?.course, 10)
  const groupName = normalizeNullableText(req.body?.group_name, 120)

  if (Number.isNaN(course) || course < -1 || course > 10) {
    return res.status(400).json({ error: 'course must be an integer between -1 and 10' })
  }
  if (!groupName) {
    return res.status(400).json({ error: 'group_name is required' })
  }

  const now = nowSql()
  pairsDb.prepare('INSERT OR IGNORE INTO course_catalog (course, created_at) VALUES (?, ?)').run(course, now)
  const result = pairsDb
    .prepare('INSERT OR IGNORE INTO group_catalog (course, group_name, created_at) VALUES (?, ?, ?)')
    .run(course, groupName, now)

  res.json({ ok: true, inserted: result.changes > 0 })
})

// ---------------------------------------------------------------------------
// DELETE /adminapi/deletetable
// ---------------------------------------------------------------------------
router.delete('/deletetable', requireAuth, requirePermission('schedule:write'), (_req, res) => {
  pairsDb.prepare('DELETE FROM pairs').run();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /adminapi/createtable  — загрузить JSON расписания (полная замена)
// Поле формы: file
// ---------------------------------------------------------------------------
router.post('/createtable', requireAuth, requirePermission('schedule:write'), upload.single('file'), async (req, res) => {
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
router.post('/updatetable', requireAuth, requirePermission('schedule:write'), upload.single('file'), async (req, res) => {
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
// GET /adminapi/pairs — получить пары по фильтрам (для редактирования)
router.get('/pairs', requireAuth, requirePermission('schedule:write'), (req, res) => {
  const query = (req.query.group || '').trim()
  const course = parseInt(req.query.course, 10)
  const weekNumber = parseInt(req.query.week_number, 10)

  let sql = 'SELECT p.*, t.time_start, t.time_end FROM pairs p LEFT JOIN times t ON p.time = t.id WHERE 1=1'
  const params = []

  if (query) {
    sql += ' AND p.group_name = ?'
    params.push(query)
  }
  if (!Number.isNaN(course)) {
    sql += ' AND p.course = ?'
    params.push(course)
  }
  if (!Number.isNaN(weekNumber)) {
    sql += ' AND p.week_number = ?'
    params.push(weekNumber)
  }

  sql += ' ORDER BY p.weekday, p.time'
  const rows = pairsDb.prepare(sql).all(...params)
  res.json(rows)
})

// PUT /adminapi/pairs/:id — обновить пару
router.put('/pairs/:id', requireAuth, requirePermission('schedule:write'), (req, res) => {
  const pairsId = parseInt(req.params.id, 10)
  if (Number.isNaN(pairsId)) return res.status(400).json({ error: 'Invalid pair ID' })

  const { weekday, course, group_name, date, week_number, time, type, subject, teacher, auditory } = req.body

  const existing = pairsDb.prepare('SELECT * FROM pairs WHERE id = ?').get(pairsId)
  if (!existing) return res.status(404).json({ error: 'Pair not found' })

  pairsDb.prepare(
    `UPDATE pairs SET weekday=?, course=?, group_name=?, date=?, week_number=?, time=?, type=?, subject=?, teacher=?, auditory=?
     WHERE id = ?`
  ).run(weekday, course, group_name, date, week_number, time, type, subject, teacher, auditory, pairsId)

  res.json({ ok: true })
})

// DELETE /adminapi/pairs/:id — удалить пару
router.delete('/pairs/:id', requireAuth, requirePermission('schedule:write'), (req, res) => {
  const pairsId = parseInt(req.params.id, 10)
  if (Number.isNaN(pairsId)) return res.status(400).json({ error: 'Invalid pair ID' })

  const existing = pairsDb.prepare('SELECT * FROM pairs WHERE id = ?').get(pairsId)
  if (!existing) return res.status(404).json({ error: 'Pair not found' })

  pairsDb.prepare('DELETE FROM pairs WHERE id = ?').run(pairsId)
  res.json({ ok: true })
})

router.post('/updatepairs', requireAuth, requirePermission('schedule:write'), (req, res) => {
  const { group, course, date, week_number, weekday, lessons } = req.body ?? {};

  if (!group || !Array.isArray(lessons)) {
    return res.status(400).json({ error: 'group and lessons[] are required' });
  }

  const normalizedCourse = Number.isNaN(parseInt(course, 10)) ? null : parseInt(course, 10)
  const normalizedWeekday = normalizeWeekday(weekday)
  if (weekday !== undefined && weekday !== null && weekday !== '' && normalizedWeekday === null) {
    return res.status(400).json({ error: 'weekday must be 1..7 or weekday name' })
  }

  const normalDate = normalizeDate(date ?? '') || null;
  const insert = pairsDb.prepare(
    `INSERT INTO pairs (week_number, weekday, course, group_name, date, time, type, subject, teacher, auditory, date_start, date_end)
     VALUES (@week_number, @weekday, @course, @group_name, @date, @time, @type, @subject, @teacher, @auditory, @date_start, @date_end)`
  );
  const update = pairsDb.prepare(
    `UPDATE pairs SET type=@type, subject=@subject, teacher=@teacher, auditory=@auditory, time=@time WHERE id=@id`
  );
  const del = pairsDb.prepare('DELETE FROM pairs WHERE id=?');

  const run = pairsDb.transaction(() => {
    if (normalizedCourse !== null) {
      pairsDb.prepare('INSERT OR IGNORE INTO course_catalog (course, created_at) VALUES (?, ?)').run(normalizedCourse, nowSql())
      pairsDb.prepare('INSERT OR IGNORE INTO group_catalog (course, group_name, created_at) VALUES (?, ?, ?)').run(normalizedCourse, String(group).trim(), nowSql())
    }

    for (const lesson of lessons) {
      const timeId = resolveTimeId(lesson.time)

      switch (lesson.method) {
        case 'create':
          insert.run({
            week_number: week_number ?? null,
            weekday: normalizedWeekday,
            course: normalizedCourse,
            group_name: String(group).trim(),
            date: normalDate,
            time: timeId,
            type: lesson.type ?? null, subject: lesson.subject ?? null,
            teacher: lesson.teacher ?? null, auditory: lesson.auditory ?? null,
            date_start: null, date_end: null,
          });
          break;
        case 'update':
          update.run({ id: lesson.id, type: lesson.type, subject: lesson.subject, teacher: lesson.teacher, auditory: lesson.auditory, time: timeId });
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
router.post('/updatetimes', requireAuth, requirePermission('times:write'), (req, res) => {
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
// POST /adminapi/createnews  — создать новость
// Body: { content }
// ---------------------------------------------------------------------------
router.post('/createnews', requireAuth, requirePermission('news:write'), (req, res) => {
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
router.post('/editnews', requireAuth, requirePermission('news:write'), (req, res) => {
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
router.delete('/deletenews', requireAuth, requirePermission('news:write'), (req, res) => {
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

// ---------------------------------------------------------------------------
// Единое окно — административные эндпоинты
// ---------------------------------------------------------------------------

// GET /adminapi/unified-window/tickets
// GET /adminapi/unified-window/tickets — список всех тикетов с фильтрацией
router.get('/unified-window/tickets', requireAuth, requirePermission('unified_window:read'), (req, res) => {
  const status = (req.query.status || '').trim()
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100)
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0)

  let sql = 'SELECT * FROM unified_window_tickets WHERE 1=1'
  const params = []

  if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
    sql += ' AND status = ?'
    params.push(status)
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const rows = usersDb.prepare(sql).all(...params)

  // Расшифровываем поля
  const tickets = rows.map(t => ({
    id: t.id,
    subject: decryptTicketField(t, 'subject'),
    status: t.status,
    priority: t.priority,
    contact_name: decryptTicketField(t, 'contact_name'),
    contact_email: decryptTicketField(t, 'contact_email'),
    access_token: t.access_token,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }))

  res.json(tickets)
})



// GET /adminapi/unified-window/tickets/:id
router.get('/unified-window/tickets/:id', requireAuth, requirePermission('unified_window:read'), (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ticket id' })

  const ticket = usersDb.prepare('SELECT * FROM unified_window_tickets WHERE id = ?').get(id)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

  const messagesRaw = usersDb.prepare(
    'SELECT * FROM unified_window_messages WHERE ticket_id = ? ORDER BY created_at ASC'
  ).all(id)

  const messages = messagesRaw.map(m => {
    let text = null
    if (m.encrypted_text_iv && m.encrypted_text_tag && m.encrypted_text_data) {
      try {
        text = decryptText({ iv: m.encrypted_text_iv, tag: m.encrypted_text_tag, data: m.encrypted_text_data })
      } catch { text = '[ошибка дешифрования]' }
    }
    return { id: m.id, author_role: m.author_role, author_name: m.author_name, text, created_at: m.created_at }
  })

  const files = usersDb.prepare(
    'SELECT id, message_id, original_name, mime_type, size_bytes, created_at FROM unified_window_files WHERE ticket_id = ?'
  ).all(id)

  const history = usersDb.prepare(
    'SELECT * FROM unified_window_status_history WHERE ticket_id = ? ORDER BY created_at ASC'
  ).all(id)

  res.json({ ...mapTicket(ticket), messages, files, history })
})

// GET /adminapi/pairs — получить пары для редактирования
router.get('/pairs', requireAuth, requirePermission('schedule:write'), (req, res) => {
  const { group, course, week_number } = req.query

  let query = 'SELECT * FROM pairs WHERE 1=1'
  const params = []

  if (group) {
    query += ' AND group_name = ?'
    params.push(group)
  }
  if (course) {
    query += ' AND course = ?'
    params.push(parseInt(course, 10))
  }
  if (week_number) {
    query += ' AND week_number = ?'
    params.push(parseInt(week_number, 10))
  }

  query += ' ORDER BY date, time'

  const pairs = pairsDb.prepare(query).all(...params)

  const enrichedPairs = pairs.map(p => {
    const timeObj = pairsDb.prepare('SELECT time FROM times WHERE id = ?').get(p.time)
    const [time_start, time_end] = timeObj?.time?.split('-') || ['', '']
    return { ...p, time_start, time_end }
  })

  res.json(enrichedPairs)
})

// PUT /adminapi/pairs/:id — обновить пару
router.put('/pairs/:id', requireAuth, requirePermission('schedule:write'), (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid pair id' })

  const { weekday, course, group_name, date, week_number, time, type, subject, teacher, auditory } = req.body

  const stmt = pairsDb.prepare(`
    UPDATE pairs SET
      weekday = ?,
      course = ?,
      group_name = ?,
      date = ?,
      week_number = ?,
      time = ?,
      type = ?,
      subject = ?,
      teacher = ?,
      auditory = ?
    WHERE id = ?
  `)

  stmt.run(weekday, course, group_name, date, week_number, time, type, subject, teacher, auditory, id)
  res.json({ ok: true })
})

// DELETE /adminapi/pairs/:id — удалить пару
router.delete('/pairs/:id', requireAuth, requirePermission('schedule:write'), (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid pair id' })

  pairsDb.prepare('DELETE FROM pairs WHERE id = ?').run(id)
  res.json({ ok: true })
})

// GET /adminapi/unified-window/tickets — получить все обращения
router.get('/unified-window/tickets', requireAuth, requirePermission('unified_window:read'), (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query

  let query = 'SELECT * FROM unified_window_tickets WHERE 1=1'
  const params = []

  if (status) {
    query += ' AND status = ?'
    params.push(status)
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit, 10), parseInt(offset, 10))

  const rows = usersDb.prepare(query).all(...params)

  const tickets = rows.map(t => ({
    id: t.id,
    subject: decryptTicketField(t, 'subject'),
    status: t.status,
    priority: t.priority,
    contact_name: decryptTicketField(t, 'contact_name'),
    contact_email: decryptTicketField(t, 'contact_email'),
    created_at: t.created_at,
    updated_at: t.updated_at,
  }))

  res.json(tickets)
})

// POST /adminapi/unified-window/tickets/:id/messages — ответ агента
router.post('/unified-window/tickets/:id/messages', requireAuth, requirePermission('unified_window:write'), (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ticket id' })

  const ticket = usersDb.prepare('SELECT * FROM unified_window_tickets WHERE id = ?').get(id)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

  const { text } = req.body ?? {}
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'text is required' })

  const encrypted = encryptText(String(text).trim())
  const now = nowSql()

  const result = usersDb.prepare(
    `INSERT INTO unified_window_messages (ticket_id, author_role, author_name, encrypted_text_iv, encrypted_text_tag, encrypted_text_data, created_at)
     VALUES (?, 'agent', ?, ?, ?, ?, ?)`
  ).run(id, req.user.username, encrypted.iv, encrypted.tag, encrypted.data, now)

  // Записать время первого ответа агента если ещё не установлено
  if (!ticket.first_response_at) {
    usersDb.prepare('UPDATE unified_window_tickets SET first_response_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, id)
  }

  const ticketEmail = decryptTicketField(ticket, 'contact_email')
  const ticketSubject = decryptTicketField(ticket, 'subject')

  // Email-уведомление пользователю
  if (ticketEmail) {
    sendUnifiedWindowEmail({
      to: ticketEmail,
      subject: `Ответ на обращение #${id}: ${ticketSubject ?? 'Без темы'}`,
      text: `Вам ответили по обращению "${ticketSubject ?? 'Без темы'}".\n\n${text}`,
    }).catch(() => {})
  }

  res.json({ ok: true, id: result.lastInsertRowid })
})

// POST /adminapi/unified-window/tickets/:id/attachments — загрузить зашифрованный файл
router.post(
  '/unified-window/tickets/:id/attachments',
  requireAuth,
  requirePermission('unified_window:write'),
  uploadUw.single('file'),
  (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ticket id' })
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const ticket = usersDb.prepare('SELECT id FROM unified_window_tickets WHERE id = ?').get(id)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const encrypted = encryptBuffer(req.file.buffer)
    const now = nowSql()
    const messageId = req.body?.message_id ? parseInt(req.body.message_id, 10) : null

    const result = usersDb.prepare(
      `INSERT INTO unified_window_files
         (ticket_id, message_id, original_name, mime_type, size_bytes, encrypted_blob_iv, encrypted_blob_tag, encrypted_blob_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, messageId ?? null,
      req.file.originalname, req.file.mimetype, req.file.size,
      encrypted.iv, encrypted.tag, encrypted.data, now
    )

    res.json({ ok: true, id: result.lastInsertRowid })
  }
)

// GET /adminapi/unified-window/files/:fileId — скачать расшифрованный файл
router.get('/unified-window/files/:fileId', requireAuth, requirePermission('unified_window:read'), (req, res) => {
  const fileId = parseInt(req.params.fileId, 10)
  if (Number.isNaN(fileId)) return res.status(400).json({ error: 'Invalid file id' })

  const file = usersDb.prepare('SELECT * FROM unified_window_files WHERE id = ?').get(fileId)
  if (!file) return res.status(404).json({ error: 'File not found' })

  let buffer
  try {
    buffer = decryptBuffer({ iv: file.encrypted_blob_iv, tag: file.encrypted_blob_tag, data: file.encrypted_blob_data })
  } catch {
    return res.status(500).json({ error: 'Decryption failed' })
  }

  res.setHeader('Content-Type', file.mime_type ?? 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`)
  res.send(buffer)
})

// PATCH /adminapi/unified-window/tickets/:id/status — сменить статус + SLA
router.patch('/unified-window/tickets/:id/status', requireAuth, requirePermission('unified_window:write'), (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ticket id' })

  const validStatuses = ['open', 'in_progress', 'resolved', 'closed']
  const { status, comment } = req.body ?? {}
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` })
  }

  const ticket = usersDb.prepare('SELECT * FROM unified_window_tickets WHERE id = ?').get(id)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

  const now = nowSql()
  const updates = { status, updated_at: now }

  if (status === 'resolved' && !ticket.resolved_at) {
    updates.resolved_at = now
  }

  const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(', ')
  usersDb.prepare(`UPDATE unified_window_tickets SET ${setClauses} WHERE id = @id`).run({ ...updates, id })

  recordStatusHistory(id, ticket.status, status, req.user.username, comment)

  const ticketEmail = decryptTicketField(ticket, 'contact_email')
  const ticketSubject = decryptTicketField(ticket, 'subject')

  // Email-уведомление
  if (ticketEmail) {
    const statusLabels = { open: 'Открыто', in_progress: 'В работе', resolved: 'Решено', closed: 'Закрыто' }
    sendUnifiedWindowEmail({
      to: ticketEmail,
      subject: `Статус обращения #${id} изменён`,
      text: `Статус вашего обращения "${ticketSubject ?? 'Без темы'}" изменён: ${statusLabels[status] ?? status}`,
    }).catch(() => {})
  }

  res.json({ ok: true })
})

export default router;
