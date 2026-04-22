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

    CREATE INDEX IF NOT EXISTS idx_pairs_week_number ON pairs(week_number);
    CREATE INDEX IF NOT EXISTS idx_pairs_date        ON pairs(date);
    CREATE INDEX IF NOT EXISTS idx_pairs_date_start  ON pairs(date_start);
    CREATE INDEX IF NOT EXISTS idx_pairs_date_end    ON pairs(date_end);
    CREATE INDEX IF NOT EXISTS idx_pairs_course      ON pairs(course);
    CREATE INDEX IF NOT EXISTS idx_pairs_group_name  ON pairs(group_name);
    CREATE INDEX IF NOT EXISTS idx_pairs_teacher     ON pairs(teacher);
    CREATE INDEX IF NOT EXISTS idx_pairs_auditory    ON pairs(auditory);
    CREATE INDEX IF NOT EXISTS idx_pairs_subject     ON pairs(subject);
  `);
}

function initUsersSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      is_active  INTEGER NOT NULL DEFAULT 1,
      role       TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS unified_window_tickets (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      subject          TEXT    NOT NULL,
      contact_email    TEXT,
      contact_name     TEXT,
      status           TEXT    NOT NULL DEFAULT 'open',
      priority         TEXT    NOT NULL DEFAULT 'normal',
      access_token     TEXT    UNIQUE,
      due_at           TEXT,
      first_response_at TEXT,
      resolved_at      TEXT,
      created_at       TEXT    NOT NULL,
      updated_at       TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS unified_window_messages (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id           INTEGER NOT NULL REFERENCES unified_window_tickets(id) ON DELETE CASCADE,
      author_role         TEXT    NOT NULL DEFAULT 'user',
      author_name         TEXT,
      encrypted_text_iv   TEXT,
      encrypted_text_tag  TEXT,
      encrypted_text_data TEXT,
      created_at          TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS unified_window_files (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id           INTEGER NOT NULL REFERENCES unified_window_tickets(id) ON DELETE CASCADE,
      message_id          INTEGER REFERENCES unified_window_messages(id) ON DELETE SET NULL,
      original_name       TEXT    NOT NULL,
      mime_type           TEXT,
      size_bytes          INTEGER,
      encrypted_blob_iv   TEXT,
      encrypted_blob_tag  TEXT,
      encrypted_blob_data TEXT,
      created_at          TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS unified_window_status_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id   INTEGER NOT NULL REFERENCES unified_window_tickets(id) ON DELETE CASCADE,
      from_status TEXT,
      to_status   TEXT    NOT NULL,
      changed_by  TEXT,
      comment     TEXT,
      created_at  TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_uw_tickets_status       ON unified_window_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_uw_tickets_priority     ON unified_window_tickets(priority);
    CREATE INDEX IF NOT EXISTS idx_uw_tickets_access_token ON unified_window_tickets(access_token);
    CREATE INDEX IF NOT EXISTS idx_uw_messages_ticket_id   ON unified_window_messages(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_uw_files_ticket_id      ON unified_window_files(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_uw_history_ticket_id    ON unified_window_status_history(ticket_id);
  `);

  // Миграция для уже существующих БД: добавляем недостающие колонки.
  const columns = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!columns.includes('is_active')) {
    db.exec('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  }
  if (!columns.includes('created_at')) {
    db.exec('ALTER TABLE users ADD COLUMN created_at TEXT');
  }
  if (!columns.includes('updated_at')) {
    db.exec('ALTER TABLE users ADD COLUMN updated_at TEXT');
  }
  if (!columns.includes('role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'");
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE users SET created_at = COALESCE(created_at, ?), updated_at = COALESCE(updated_at, ?)').run(now, now);
}

export const pairsDb = openPairsDb();
export const usersDb = openUsersDb();
