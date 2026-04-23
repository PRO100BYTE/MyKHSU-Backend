import { Router } from 'express';
import { pairsDb, usersDb } from '../db/database.js';
import { getWeekDates, getCurrentWeekNumber, normalizeDate } from '../utils/dates.js';
import { APP_CONSTANTS } from '../constants.js';
import { encryptText, decryptText, createAccessToken } from '../utils/uw-crypto.js';
import { sendUnifiedWindowEmail } from '../utils/uw-notify.js';
import { createHash } from 'node:crypto';
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
    const parsedCourse = parseInt(course, 10)
    if (Number.isNaN(parsedCourse)) {
      return res.status(400).json({ error: 'Invalid course' })
    }
    rows = pairsDb.prepare(
      `SELECT group_name FROM (
         SELECT DISTINCT group_name FROM pairs WHERE course = ?
         UNION
         SELECT DISTINCT group_name FROM group_catalog WHERE course = ?
       )
       WHERE group_name IS NOT NULL AND TRIM(group_name) != ''
       ORDER BY group_name`
    ).all(parsedCourse, parsedCourse);
  } else {
    rows = pairsDb.prepare(
      `SELECT group_name FROM (
         SELECT DISTINCT group_name FROM pairs
         UNION
         SELECT DISTINCT group_name FROM group_catalog
       )
       WHERE group_name IS NOT NULL AND TRIM(group_name) != ''
       ORDER BY group_name`
    ).all();
  }
  res.json(rows.map(r => r.group_name));
});

// Legacy: GET /api/getgroups/:course
router.get('/getgroups/:course', (req, res) => {
  const course = parseInt(req.params.course, 10);
  if (isNaN(course)) return res.status(400).json({ error: 'Invalid course' });
  const rows = pairsDb.prepare(
    `SELECT group_name FROM (
       SELECT DISTINCT group_name FROM pairs WHERE course = ?
       UNION
       SELECT DISTINCT group_name FROM group_catalog WHERE course = ?
     )
     WHERE group_name IS NOT NULL AND TRIM(group_name) != ''
     ORDER BY group_name`
  ).all(course, course);
  res.json(rows.map(r => r.group_name));
});

// ---------------------------------------------------------------------------
// GET /api/getcourses
// ---------------------------------------------------------------------------
router.get('/getcourses', (_req, res) => {
  const rows = pairsDb.prepare(
    `SELECT course FROM (
       SELECT DISTINCT course FROM pairs
       UNION
       SELECT DISTINCT course FROM course_catalog
     )
     WHERE course IS NOT NULL
     ORDER BY course`
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

function emailHash(email) {
  if (!email) return null
  return createHash('sha256').update(email).digest('hex')
}

function mapTicketStatusLabel(status) {
  const labels = {
    open: 'Открыто',
    in_progress: 'В работе',
    resolved: 'Решено',
    closed: 'Закрыто',
  }
  return labels[status] ?? status
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

// POST /api/unified-window/tickets — создать обращение
router.post('/unified-window/tickets', (req, res) => {
  const { role, subject, contact_email, contact_name, message, priority } = req.body ?? {}

  if (!subject || !String(subject).trim()) {
    return res.status(400).json({ error: 'subject is required' })
  }
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'message is required' })
  }

  const validPriorities = ['low', 'normal', 'high', 'urgent']
  const validRoles = ['visitor', 'student', 'teacher']
  const safeRole = validRoles.includes(role) ? role : 'visitor'
  const safePriority = validPriorities.includes(priority) ? priority : 'normal'
  const safeSubject = String(subject).trim()
  const safeContactEmail = normalizeEmail(contact_email)
  if (!safeContactEmail) {
    return res.status(400).json({ error: 'contact_email is required' })
  }
  const safeContactName = normalizeNullableText(contact_name, 160)
  const accessToken = createAccessToken()
  const now = uwNowSql()
  const dueAt = uwDueAt(safePriority)

  const encryptedSubject = encryptText(safeSubject)
  const encryptedContactEmail = safeContactEmail ? encryptText(safeContactEmail) : null
  const encryptedContactName = safeContactName ? encryptText(safeContactName) : null

  const ticketResult = usersDb.prepare(
    `INSERT INTO unified_window_tickets (
      requester_role,
      subject,
      contact_email,
      contact_name,
      encrypted_subject_iv,
      encrypted_subject_tag,
      encrypted_subject_data,
      encrypted_contact_email_iv,
      encrypted_contact_email_tag,
      encrypted_contact_email_data,
      encrypted_contact_name_iv,
      encrypted_contact_name_tag,
      encrypted_contact_name_data,
      contact_email_hash,
      status,
      priority,
      access_token,
      due_at,
      user_last_read_at,
      agent_last_read_at,
      created_at,
      updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)`
  ).run(
    safeRole,
    safeSubject,
    safeContactEmail,
    safeContactName,
    encryptedSubject.iv,
    encryptedSubject.tag,
    encryptedSubject.data,
    encryptedContactEmail?.iv ?? null,
    encryptedContactEmail?.tag ?? null,
    encryptedContactEmail?.data ?? null,
    encryptedContactName?.iv ?? null,
    encryptedContactName?.tag ?? null,
    encryptedContactName?.data ?? null,
    emailHash(safeContactEmail),
    safePriority,
    accessToken,
    dueAt,
    now,
    null,
    now,
    now,
  )

  const ticketId = ticketResult.lastInsertRowid

  // Сохранить первое сообщение зашифрованным
  const encrypted = encryptText(String(message).trim())
  usersDb.prepare(
    `INSERT INTO unified_window_messages (ticket_id, author_role, author_name, encrypted_text_iv, encrypted_text_tag, encrypted_text_data, created_at)
     VALUES (?, 'user', ?, ?, ?, ?, ?)`
  ).run(ticketId, safeContactName, encrypted.iv, encrypted.tag, encrypted.data, now)

  // Email-подтверждение создания тикета
  if (safeContactEmail) {
    sendUnifiedWindowEmail({
      to: safeContactEmail,
      subject: `Обращение #${ticketId} принято`,
      text: `Ваше обращение "${safeSubject}" зарегистрировано.\nНомер обращения: ${ticketId}\nТокен для слежения: ${accessToken}`,
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

  usersDb.prepare('UPDATE unified_window_tickets SET user_last_read_at = ? WHERE id = ?').run(uwNowSql(), ticket.id)

  const subjectText = decryptTicketField(ticket, 'subject')
  const contactNameText = decryptTicketField(ticket, 'contact_name')

  const statusHistory = usersDb.prepare(
    'SELECT from_status, to_status, changed_by, comment, created_at FROM unified_window_status_history WHERE ticket_id = ? ORDER BY created_at ASC'
  ).all(ticket.id)

  res.json({
    id: ticket.id,
    requester_role: ticket.requester_role ?? 'visitor',
    subject: subjectText,
    status: ticket.status,
    priority: ticket.priority,
    contact_name: contactNameText,
    contact_email: decryptTicketField(ticket, 'contact_email'),
    due_at: ticket.due_at,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
    status_history: statusHistory,
  })
})

// GET /api/unified-window/tickets?contact_email=... — список обращений по email
router.get('/unified-window/tickets', (req, res) => {
  const safeContactEmail = normalizeEmail(req.query.contact_email)
  if (!safeContactEmail) return res.status(400).json({ error: 'contact_email is required' })

  const rows = usersDb.prepare(
    `SELECT
       t.*,
       (
         SELECT m.author_role
         FROM unified_window_messages m
         WHERE m.ticket_id = t.id
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT 1
       ) AS last_message_author_role,
       (
         SELECT m.created_at
         FROM unified_window_messages m
         WHERE m.ticket_id = t.id
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT 1
       ) AS last_message_at
     FROM unified_window_tickets t
     WHERE t.contact_email_hash = ?
     ORDER BY t.created_at DESC
     LIMIT 50`
  ).all(emailHash(safeContactEmail))

  const tickets = rows.map(ticket => ({
    id: ticket.id,
    access_token: ticket.access_token,
    requester_role: ticket.requester_role ?? 'visitor',
    subject: decryptTicketField(ticket, 'subject'),
    status: ticket.status,
    priority: ticket.priority,
    contact_name: decryptTicketField(ticket, 'contact_name'),
    contact_email: decryptTicketField(ticket, 'contact_email'),
    last_message_author_role: ticket.last_message_author_role ?? null,
    last_message_at: ticket.last_message_at ?? null,
    has_unread_for_user: Boolean(
      ticket.last_message_author_role === 'agent' &&
      ticket.last_message_at &&
      (!ticket.user_last_read_at || ticket.last_message_at > ticket.user_last_read_at)
    ),
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
  }))

  res.json(tickets)
})

// GET /api/unified-window/tickets/:token/messages — получить сообщения по токену
router.get('/unified-window/tickets/:token/messages', (req, res) => {
  const { token } = req.params
  if (!token || token.length < 10) return res.status(400).json({ error: 'Invalid token' })

  const ticket = usersDb.prepare('SELECT id FROM unified_window_tickets WHERE access_token = ?').get(token)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

  usersDb.prepare('UPDATE unified_window_tickets SET user_last_read_at = ? WHERE id = ?').run(uwNowSql(), ticket.id)

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
  const safeContactName = normalizeNullableText(contact_name, 160)
  const fallbackContactName = decryptTicketField(ticket, 'contact_name')

  const result = usersDb.prepare(
    `INSERT INTO unified_window_messages (ticket_id, author_role, author_name, encrypted_text_iv, encrypted_text_tag, encrypted_text_data, created_at)
     VALUES (?, 'user', ?, ?, ?, ?, ?)`
  ).run(ticket.id, safeContactName ?? fallbackContactName ?? null, encrypted.iv, encrypted.tag, encrypted.data, now)

  // Переоткрыть тикет если был resolved, а также обновить время активности
  if (ticket.status === 'resolved') {
    usersDb.prepare("UPDATE unified_window_tickets SET status = 'open', updated_at = ? WHERE id = ?").run(now, ticket.id)
  } else {
    usersDb.prepare('UPDATE unified_window_tickets SET updated_at = ? WHERE id = ?').run(now, ticket.id)
  }

  res.json({ ok: true, id: result.lastInsertRowid })
})

// POST /api/unified-window/tickets/:token/close — закрыть обращение пользователем с комментарием
router.post('/unified-window/tickets/:token/close', (req, res) => {
  const { token } = req.params
  if (!token || token.length < 10) return res.status(400).json({ error: 'Invalid token' })

  const ticket = usersDb.prepare('SELECT * FROM unified_window_tickets WHERE access_token = ?').get(token)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
  if (ticket.status === 'closed') return res.status(400).json({ error: 'Ticket is already closed' })

  const { comment, contact_name } = req.body ?? {}
  const safeComment = normalizeNullableText(comment, 500)
  if (!safeComment) {
    return res.status(400).json({ error: 'comment is required' })
  }

  const now = uwNowSql()
  const safeContactName = normalizeNullableText(contact_name, 160)
  const fallbackContactName = decryptTicketField(ticket, 'contact_name')
  const actorName = safeContactName ?? fallbackContactName ?? 'Пользователь'

  usersDb.prepare('UPDATE unified_window_tickets SET status = ?, updated_at = ? WHERE id = ?').run('closed', now, ticket.id)
  usersDb.prepare(
    `INSERT INTO unified_window_status_history (ticket_id, from_status, to_status, changed_by, comment, created_at)
     VALUES (?, ?, 'closed', ?, ?, ?)`
  ).run(ticket.id, ticket.status ?? null, actorName, safeComment, now)

  const encrypted = encryptText(`Пользователь закрыл обращение. Причина: ${safeComment}`)
  usersDb.prepare(
    `INSERT INTO unified_window_messages (ticket_id, author_role, author_name, encrypted_text_iv, encrypted_text_tag, encrypted_text_data, created_at)
     VALUES (?, 'user', ?, ?, ?, ?, ?)`
  ).run(ticket.id, actorName, encrypted.iv, encrypted.tag, encrypted.data, now)

  const ticketEmail = decryptTicketField(ticket, 'contact_email')
  const ticketSubject = decryptTicketField(ticket, 'subject')

  if (ticketEmail) {
    sendUnifiedWindowEmail({
      to: ticketEmail,
      subject: `Обращение #${ticket.id} закрыто`,
      text: `Обращение "${ticketSubject ?? 'Без темы'}" закрыто.
Причина: ${safeComment}
Статус: ${mapTicketStatusLabel('closed')}`,
    }).catch(() => {})
  }

  res.json({ ok: true })
})

// DELETE /api/unified-window/tickets/:token — удалить закрытое обращение пользователем
router.delete('/unified-window/tickets/:token', (req, res) => {
  const { token } = req.params
  if (!token || token.length < 10) return res.status(400).json({ error: 'Invalid token' })

  const ticket = usersDb.prepare('SELECT id, status FROM unified_window_tickets WHERE access_token = ?').get(token)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
  if (ticket.status !== 'closed') return res.status(400).json({ error: 'Only closed ticket can be deleted' })

  usersDb.prepare('DELETE FROM unified_window_tickets WHERE id = ?').run(ticket.id)
  res.json({ ok: true })
})
