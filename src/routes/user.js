import { Router } from 'express';
import { pairsDb, usersDb } from '../db/database.js';
import { getWeekDates, getCurrentWeekNumber, normalizeDate } from '../utils/dates.js';
import { APP_CONSTANTS } from '../constants.js';
import { encryptText, decryptText, createAccessToken } from '../utils/uw-crypto.js';
import { sendUnifiedWindowEmail } from '../utils/uw-notify.js';
import fs from 'node:fs';
import path from 'node:path';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/meta
// Метаданные версии и сборки
// ---------------------------------------------------------------------------
router.get('/meta', (_req, res) => {
  res.json({
    app_name: APP_CONSTANTS.appName,
    app_short_name: APP_CONSTANTS.appShortName,
    api_version: APP_CONSTANTS.apiVersion,
    app_version: APP_CONSTANTS.appVersion,
    build_number: APP_CONSTANTS.buildNumber,
    build_date: APP_CONSTANTS.buildDate,
    admin_panel_version: APP_CONSTANTS.adminPanelVersion,
    frontend_version: APP_CONSTANTS.frontendVersion,
    contacts: APP_CONSTANTS.contacts,
  });
});

// ---------------------------------------------------------------------------
// GET /api/getpairs
// Параметры: type (group|teacher|auditory), group/data, date (dd.MM.yyyy)
// ---------------------------------------------------------------------------
router.get('/getpairs', (req, res) => {
  const { type, group, data, date } = req.query;
  const target = group ?? data ?? '';
  const normalDate = normalizeDate(date ?? '');

  if (!type || !target || !normalDate) {
    return res.status(400).json({ error: 'Missing required query params: type, group (or data), date' });
  }

  const colMap = { group: 'group_name', teacher: 'teacher', auditory: 'auditory' };
  const col = colMap[type];
  if (!col) return res.status(400).json({ error: `Unknown type: ${type}` });

  const rows = pairsDb.prepare(
    `SELECT p.*, t.time_start, t.time_end
     FROM pairs p
     LEFT JOIN times t ON p.time = t.id
     WHERE p.${col} = ? AND p.date = ?
     ORDER BY p.time`
  ).all(target, normalDate);

  res.json(mapLessons(rows));
});

// Legacy path-based: GET /api/getpairs/:args  (type:group:date)
router.get('/getpairs/:args', (req, res) => {
  const parts = (req.params.args ?? '').split(':');
  if (parts.length < 3) return res.status(400).json({ error: 'Format: type:group:date' });
  req.query = { type: parts[0], group: parts[1], date: parts[2] };
  return router.handle(Object.assign(req, { url: '/getpairs' }), res, () => {});
});

// ---------------------------------------------------------------------------
// GET /api/getpairsweek
// Параметры: type, data, week
// ---------------------------------------------------------------------------
router.get('/getpairsweek', (req, res) => {
  const { type, data, week } = req.query;
  const weekNum = parseInt(week, 10);

  if (!type || !data || isNaN(weekNum)) {
    return res.status(400).json({ error: 'Missing required query params: type, data, week' });
  }

  const colMap = { group: 'group_name', teacher: 'teacher', auditory: 'auditory' };
  const col = colMap[type];
  if (!col) return res.status(400).json({ error: `Unknown type: ${type}` });

  const rows = pairsDb.prepare(
    `SELECT p.*, t.time_start, t.time_end
     FROM pairs p
     LEFT JOIN times t ON p.time = t.id
     WHERE p.${col} = ? AND p.week_number = ?
     ORDER BY p.weekday, p.time`
  ).all(data, weekNum);

  const { dateStart, dateEnd } = getWeekDates(weekNum);
  const days = groupByWeekday(rows);

  res.json({
    week_number: weekNum,
    days,
    dates: { date_start: dateStart, date_end: dateEnd },
  });
});

// ---------------------------------------------------------------------------
// GET /api/getfullschedule
// Параметры: course, from, to
// ---------------------------------------------------------------------------
router.get('/getfullschedule', (req, res) => {
  const course = parseInt(req.query.course, 10);
  const from   = parseInt(req.query.from, 10);
  const to     = parseInt(req.query.to, 10);

  if (isNaN(course) || isNaN(from) || isNaN(to)) {
    return res.status(400).json({ error: 'Missing required query params: course, from, to' });
  }

  const rows = pairsDb.prepare(
    `SELECT p.*, t.time_start, t.time_end
     FROM pairs p
     LEFT JOIN times t ON p.time = t.id
     WHERE p.course = ? AND p.week_number BETWEEN ? AND ?
     ORDER BY p.group_name, p.week_number, p.weekday, p.time`
  ).all(course, from, to);

  // Группируем по group_name → week_number → weekday
  const result = {};
  for (const row of rows) {
    const g = row.group_name;
    const w = row.week_number;
    if (!result[g]) result[g] = {};
    if (!result[g][w]) result[g][w] = { week_number: w, days: {} };
    const wd = row.weekday;
    if (!result[g][w].days[wd]) result[g][w].days[wd] = { weekday: wd, lessons: [] };
    result[g][w].days[wd].lessons.push(mapLesson(row));
  }

  // Преобразуем вложенные объекты в массивы
  const output = Object.entries(result).map(([groupName, weeks]) => ({
    group_name: groupName,
    weeks: Object.values(weeks).map(wk => ({
      week_number: wk.week_number,
      days: Object.values(wk.days),
    })),
  }));

  res.json(output);
});

// ---------------------------------------------------------------------------
// GET /api/getgroups
// Параметры: course
// ---------------------------------------------------------------------------
router.get('/getgroups', (req, res) => {
  const course = req.query.course;
  let rows;
  if (course !== undefined && course !== '') {
    rows = pairsDb.prepare(
      'SELECT DISTINCT group_name FROM pairs WHERE course = ? ORDER BY group_name'
    ).all(parseInt(course, 10));
  } else {
    rows = pairsDb.prepare(
      'SELECT DISTINCT group_name FROM pairs ORDER BY group_name'
    ).all();
  }
  res.json(rows.map(r => r.group_name));
});

// Legacy: GET /api/getgroups/:course
router.get('/getgroups/:course', (req, res) => {
  const course = parseInt(req.params.course, 10);
  if (isNaN(course)) return res.status(400).json({ error: 'Invalid course' });
  const rows = pairsDb.prepare(
    'SELECT DISTINCT group_name FROM pairs WHERE course = ? ORDER BY group_name'
  ).all(course);
  res.json(rows.map(r => r.group_name));
});

// ---------------------------------------------------------------------------
// GET /api/getcourses
// ---------------------------------------------------------------------------
router.get('/getcourses', (_req, res) => {
  const rows = pairsDb.prepare(
    'SELECT DISTINCT course FROM pairs ORDER BY course'
  ).all();
  res.json(rows.map(r => r.course));
});

// ---------------------------------------------------------------------------
// GET /api/getdates
// Параметры: week
// ---------------------------------------------------------------------------
router.get('/getdates', (req, res) => {
  const week = parseInt(req.query.week, 10);
  if (isNaN(week)) return res.status(400).json({ error: 'Missing param: week' });
  const { dateStart, dateEnd } = getWeekDates(week);
  // Отдаём массив дат пн-пт
  const dates = [];
  const start = new Date(dateStart);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * 86400_000);
    dates.push(d.toISOString().slice(0, 10));
  }
  res.json(dates);
});

// GET /api/getdatesextended/:week
router.get('/getdatesextended/:week', (req, res) => {
  const week = parseInt(req.params.week, 10);
  if (isNaN(week)) return res.status(400).json({ error: 'Invalid week number' });
  const { dateStart, dateEnd } = getWeekDates(week);
  res.json({ date_start: dateStart, date_end: dateEnd });
});

// ---------------------------------------------------------------------------
// GET /api/lastweeknumber
// Параметры: group
// ---------------------------------------------------------------------------
router.get('/lastweeknumber', (req, res) => {
  const group = req.query.group;
  if (!group) return res.status(400).json({ error: 'Missing param: group' });
  const row = pairsDb.prepare(
    'SELECT MAX(week_number) AS max_week FROM pairs WHERE group_name = ?'
  ).get(group);
  res.json({ last_week: row?.max_week ?? 0 });
});

// ---------------------------------------------------------------------------
// GET /api/weeknumbers
// ---------------------------------------------------------------------------
router.get('/weeknumbers', (_req, res) => {
  const rows = pairsDb.prepare(
    'SELECT DISTINCT week_number FROM pairs ORDER BY week_number'
  ).all();
  res.json({
    weeks: rows.map(r => r.week_number),
    current: getCurrentWeekNumber(),
  });
});

// ---------------------------------------------------------------------------
// GET /api/lastupdate
// ---------------------------------------------------------------------------
router.get('/lastupdate', (_req, res) => {
  const settingsPath = path.resolve(process.cwd(), 'settings.json');
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    res.json({ last_update: settings.last_update ?? '' });
  } catch {
    res.json({ last_update: '' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/getpairstime
// Параметры: include_id (true/false)
// ---------------------------------------------------------------------------
router.get('/getpairstime', (req, res) => {
  const includeId = req.query.include_id === 'true';
  const rows = pairsDb.prepare('SELECT * FROM times ORDER BY time').all();
  if (includeId) {
    res.json(rows);
  } else {
    res.json(rows.map(({ id: _id, ...rest }) => rest));
  }
});

// ---------------------------------------------------------------------------
// GET /api/getmaincolumns
// ---------------------------------------------------------------------------
router.get('/getmaincolumns', (_req, res) => {
  const types      = pairsDb.prepare('SELECT DISTINCT type     FROM pairs WHERE type     IS NOT NULL ORDER BY type').all().map(r => r.type);
  const auditories = pairsDb.prepare('SELECT DISTINCT auditory FROM pairs WHERE auditory IS NOT NULL ORDER BY auditory').all().map(r => r.auditory);
  const subjects   = pairsDb.prepare('SELECT DISTINCT subject  FROM pairs WHERE subject  IS NOT NULL ORDER BY subject').all().map(r => r.subject);
  const teachers   = pairsDb.prepare('SELECT DISTINCT teacher  FROM pairs WHERE teacher  IS NOT NULL ORDER BY teacher').all().map(r => r.teacher);
  res.json({ types, auditories, subjects, teachers });
});

// ---------------------------------------------------------------------------
// GET /api/search/:query
// ---------------------------------------------------------------------------
router.get('/search/:query', (req, res) => {
  const q = `%${req.params.query}%`;
  const groups   = pairsDb.prepare("SELECT DISTINCT group_name AS value, 'group'    AS type FROM pairs WHERE group_name LIKE ?").all(q);
  const teachers = pairsDb.prepare("SELECT DISTINCT teacher    AS value, 'teacher'  AS type FROM pairs WHERE teacher    LIKE ?").all(q);
  const audits   = pairsDb.prepare("SELECT DISTINCT auditory   AS value, 'auditory' AS type FROM pairs WHERE auditory   LIKE ?").all(q);
  res.json([...groups, ...teachers, ...audits]);
});

// ---------------------------------------------------------------------------
// GET /api/news
// Параметры: amount, from, include_id
// ---------------------------------------------------------------------------
router.get('/news', (req, res) => {
  const amount    = parseInt(req.query.amount ?? '20', 10);
  const from      = parseInt(req.query.from ?? '0', 10);
  const includeId = req.query.include_id === 'true';

  const rows = pairsDb.prepare(
    'SELECT * FROM news ORDER BY id DESC LIMIT ? OFFSET ?'
  ).all(amount, from);

  if (includeId) {
    res.json(rows);
  } else {
    res.json(rows.map(({ id: _id, ...rest }) => rest));
  }
});

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

function mapLesson(row) {
  return {
    id:          row.id,
    type_lesson: row.type,
    subject:     row.subject,
    teacher:     row.teacher,
    auditory:    row.auditory,
    time:        row.time,
    time_start:  row.time_start ?? null,
    time_end:    row.time_end   ?? null,
    group:       row.group_name ? [row.group_name] : [],
  };
}

function mapLessons(rows) {
  return rows.map(mapLesson);
}

function groupByWeekday(rows) {
  const days = {};
  for (const row of rows) {
    const wd = row.weekday;
    if (!days[wd]) days[wd] = { weekday: wd, lessons: [] };
    days[wd].lessons.push(mapLesson(row));
  }
  return Object.values(days).sort((a, b) => a.weekday - b.weekday);
}

export default router;

// ---------------------------------------------------------------------------
// Единое окно — публичные эндпоинты (без авторизации)
// ---------------------------------------------------------------------------

function uwNowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function uwDueAt(priority) {
  const hoursMap = { urgent: 4, high: 24, normal: 72, low: 168 }
  const hours = hoursMap[priority] ?? 72
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
}

// POST /api/unified-window/tickets — создать обращение
router.post('/unified-window/tickets', (req, res) => {
  const { subject, contact_email, contact_name, message, priority } = req.body ?? {}

  if (!subject || !String(subject).trim()) {
    return res.status(400).json({ error: 'subject is required' })
  }
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'message is required' })
  }

  const validPriorities = ['low', 'normal', 'high', 'urgent']
  const safePriority = validPriorities.includes(priority) ? priority : 'normal'
  const accessToken = createAccessToken()
  const now = uwNowSql()
  const dueAt = uwDueAt(safePriority)

  const ticketResult = usersDb.prepare(
    `INSERT INTO unified_window_tickets (subject, contact_email, contact_name, status, priority, access_token, due_at, created_at, updated_at)
     VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?)`
  ).run(
    String(subject).trim(),
    contact_email ?? null,
    contact_name ?? null,
    safePriority, accessToken, dueAt, now, now
  )

  const ticketId = ticketResult.lastInsertRowid

  // Сохранить первое сообщение зашифрованным
  const encrypted = encryptText(String(message).trim())
  usersDb.prepare(
    `INSERT INTO unified_window_messages (ticket_id, author_role, author_name, encrypted_text_iv, encrypted_text_tag, encrypted_text_data, created_at)
     VALUES (?, 'user', ?, ?, ?, ?, ?)`
  ).run(ticketId, contact_name ?? null, encrypted.iv, encrypted.tag, encrypted.data, now)

  // Email-подтверждение создания тикета
  if (contact_email) {
    sendUnifiedWindowEmail({
      to: contact_email,
      subject: `Обращение #${ticketId} принято`,
      text: `Ваше обращение "${subject}" зарегистрировано.\nНомер обращения: ${ticketId}\nТокен для слежения: ${accessToken}`,
    }).catch(() => {})
  }

  res.status(201).json({ ok: true, id: ticketId, access_token: accessToken })
})

// GET /api/unified-window/tickets/:token — получить статус по токену
router.get('/unified-window/tickets/:token', (req, res) => {
  const { token } = req.params
  if (!token || token.length < 10) return res.status(400).json({ error: 'Invalid token' })

  const ticket = usersDb.prepare('SELECT * FROM unified_window_tickets WHERE access_token = ?').get(token)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

  res.json({
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    contact_name: ticket.contact_name,
    due_at: ticket.due_at,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
  })
})

// GET /api/unified-window/tickets/:token/messages — получить сообщения по токену
router.get('/unified-window/tickets/:token/messages', (req, res) => {
  const { token } = req.params
  if (!token || token.length < 10) return res.status(400).json({ error: 'Invalid token' })

  const ticket = usersDb.prepare('SELECT id FROM unified_window_tickets WHERE access_token = ?').get(token)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

  const messages = usersDb.prepare(
    'SELECT id, author_role, author_name, encrypted_text_iv, encrypted_text_tag, encrypted_text_data, created_at FROM unified_window_messages WHERE ticket_id = ? ORDER BY created_at'
  ).all(ticket.id)

  const result = messages.map(m => {
    let text = ''
    try { text = decryptText({ iv: m.encrypted_text_iv, tag: m.encrypted_text_tag, data: m.encrypted_text_data }) } catch { text = '' }
    return { id: m.id, author_role: m.author_role, author_name: m.author_name, text, created_at: m.created_at }
  })

  res.json(result)
})

// POST /api/unified-window/tickets/:token/reply — пользователь добавляет сообщение
router.post('/unified-window/tickets/:token/reply', (req, res) => {
  const { token } = req.params
  if (!token || token.length < 10) return res.status(400).json({ error: 'Invalid token' })

  const ticket = usersDb.prepare('SELECT * FROM unified_window_tickets WHERE access_token = ?').get(token)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
  if (ticket.status === 'closed') return res.status(400).json({ error: 'Ticket is closed' })

  const { message, contact_name } = req.body ?? {}
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'message is required' })

  const encrypted = encryptText(String(message).trim())
  const now = uwNowSql()

  const result = usersDb.prepare(
    `INSERT INTO unified_window_messages (ticket_id, author_role, author_name, encrypted_text_iv, encrypted_text_tag, encrypted_text_data, created_at)
     VALUES (?, 'user', ?, ?, ?, ?, ?)`
  ).run(ticket.id, contact_name ?? ticket.contact_name ?? null, encrypted.iv, encrypted.tag, encrypted.data, now)

  // Переоткрыть тикет если был resolved
  if (ticket.status === 'resolved') {
    usersDb.prepare("UPDATE unified_window_tickets SET status = 'open', updated_at = ? WHERE id = ?").run(now, ticket.id)
  }

  res.json({ ok: true, id: result.lastInsertRowid })
})
