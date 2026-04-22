import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function openPairsDb() {
  ensureDir(config.pairsDbPath);
  const db = new Database(config.pairsDbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initPairsSchema(db);
  return db;
}

function openUsersDb() {
  ensureDir(config.usersDbPath);
  const db = new Database(config.usersDbPath);
  db.pragma('journal_mode = WAL');
  initUsersSchema(db);
  return db;
}

function initPairsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS times (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      time       INTEGER NOT NULL,
      time_start TEXT    NOT NULL,
      time_end   TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pairs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      week_number INTEGER,
      weekday     INTEGER,
      course      INTEGER,
      group_name  TEXT,
      date        TEXT,
      time        INTEGER REFERENCES times(id),
      type        TEXT,
      subject     TEXT,
      teacher     TEXT,
      auditory    TEXT,
      date_start  TEXT,
      date_end    TEXT
    );

    CREATE TABLE IF NOT EXISTS news (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      content     TEXT    NOT NULL,
      date        TEXT    NOT NULL,
      last_change TEXT
    );

    CREATE TABLE IF NOT EXISTS course_catalog (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      course     INTEGER NOT NULL UNIQUE,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS group_catalog (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      course     INTEGER NOT NULL,
      group_name TEXT    NOT NULL,
      created_at TEXT,
      UNIQUE(course, group_name)
    );

    CREATE TABLE IF NOT EXISTS unified_window_tickets (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_role      TEXT    NOT NULL,
      requester_name      TEXT,
      requester_email     TEXT,
      subject             TEXT    NOT NULL,
      message             TEXT    NOT NULL,
      status              TEXT    NOT NULL DEFAULT 'new',
      priority            TEXT    NOT NULL DEFAULT 'normal',
      source              TEXT    NOT NULL DEFAULT 'web',
      access_token        TEXT,
      assignee            TEXT,
      response_text       TEXT,
      internal_note       TEXT,
      due_at              TEXT,
      first_response_at   TEXT,
      resolved_at         TEXT,
      created_at          TEXT    NOT NULL,
      updated_at          TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS unified_window_messages (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id            INTEGER NOT NULL,
      sender_type          TEXT    NOT NULL,
      sender_name          TEXT,
      sender_email         TEXT,
      encrypted_text_iv    TEXT,
      encrypted_text_tag   TEXT,
      encrypted_text_data  TEXT,
      created_at           TEXT    NOT NULL,
      FOREIGN KEY(ticket_id) REFERENCES unified_window_tickets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS unified_window_files (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id          INTEGER NOT NULL,
      file_name           TEXT    NOT NULL,
      mime_type           TEXT,
      size_bytes          INTEGER NOT NULL,
      encrypted_blob_iv   TEXT    NOT NULL,
      encrypted_blob_tag  TEXT    NOT NULL,
      encrypted_blob_data TEXT    NOT NULL,
      created_at          TEXT    NOT NULL,
      FOREIGN KEY(message_id) REFERENCES unified_window_messages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS unified_window_status_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id   INTEGER NOT NULL,
      old_status  TEXT,
      new_status  TEXT,
      changed_by  TEXT,
      note        TEXT,
      created_at  TEXT NOT NULL,
      FOREIGN KEY(ticket_id) REFERENCES unified_window_tickets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pairs_week_number ON pairs(week_number);
    CREATE INDEX IF NOT EXISTS idx_pairs_date        ON pairs(date);
    CREATE INDEX IF NOT EXISTS idx_pairs_date_start  ON pairs(date_start);
    CREATE INDEX IF NOT EXISTS idx_pairs_date_end    ON pairs(date_end);
    CREATE INDEX IF NOT EXISTS idx_pairs_course      ON pairs(course);
    CREATE INDEX IF NOT EXISTS idx_pairs_group_name  ON pairs(group_name);
    CREATE INDEX IF NOT EXISTS idx_pairs_teacher     ON pairs(teacher);
    CREATE INDEX IF NOT EXISTS idx_pairs_auditory    ON pairs(auditory);
    CREATE INDEX IF NOT EXISTS idx_pairs_subject     ON pairs(subject);
    CREATE INDEX IF NOT EXISTS idx_unified_status      ON unified_window_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_unified_priority    ON unified_window_tickets(priority);
    CREATE INDEX IF NOT EXISTS idx_unified_created_at  ON unified_window_tickets(created_at);
    CREATE INDEX IF NOT EXISTS idx_unified_access      ON unified_window_tickets(access_token);
    CREATE INDEX IF NOT EXISTS idx_unified_msg_ticket  ON unified_window_messages(ticket_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_unified_file_msg    ON unified_window_files(message_id);
    CREATE INDEX IF NOT EXISTS idx_unified_hist_ticket ON unified_window_status_history(ticket_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_group_catalog_name  ON group_catalog(group_name);
  `);

  const ticketColumns = db.prepare('PRAGMA table_info(unified_window_tickets)').all().map(c => c.name);
  if (!ticketColumns.includes('priority')) {
    db.exec("ALTER TABLE unified_window_tickets ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'");
  }
  if (!ticketColumns.includes('access_token')) {
    db.exec('ALTER TABLE unified_window_tickets ADD COLUMN access_token TEXT');
  }
  if (!ticketColumns.includes('due_at')) {
    db.exec('ALTER TABLE unified_window_tickets ADD COLUMN due_at TEXT');
  }
  if (!ticketColumns.includes('first_response_at')) {
    db.exec('ALTER TABLE unified_window_tickets ADD COLUMN first_response_at TEXT');
  }
  if (!ticketColumns.includes('resolved_at')) {
    db.exec('ALTER TABLE unified_window_tickets ADD COLUMN resolved_at TEXT');
  }
}


function initUsersSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'admin',
      is_active  INTEGER NOT NULL DEFAULT 1,
      first_name TEXT,
      last_name  TEXT,
      position   TEXT,
      email      TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  // Миграция для уже существующих БД: добавляем недостающие колонки.
  const columns = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!columns.includes('role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'");
  }
  if (!columns.includes('is_active')) {
    db.exec('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  }
  if (!columns.includes('first_name')) {
    db.exec('ALTER TABLE users ADD COLUMN first_name TEXT');
  }
  if (!columns.includes('last_name')) {
    db.exec('ALTER TABLE users ADD COLUMN last_name TEXT');
  }
  if (!columns.includes('position')) {
    db.exec('ALTER TABLE users ADD COLUMN position TEXT');
  }
  if (!columns.includes('email')) {
    db.exec('ALTER TABLE users ADD COLUMN email TEXT');
  }
  if (!columns.includes('created_at')) {
    db.exec('ALTER TABLE users ADD COLUMN created_at TEXT');
  }
  if (!columns.includes('updated_at')) {
    db.exec('ALTER TABLE users ADD COLUMN updated_at TEXT');
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE users SET created_at = COALESCE(created_at, ?), updated_at = COALESCE(updated_at, ?)').run(now, now);
}

export const pairsDb = openPairsDb();
export const usersDb = openUsersDb();
