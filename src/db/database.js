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
      created_at TEXT,
      updated_at TEXT
    );
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

  const now = new Date().toISOString();
  db.prepare('UPDATE users SET created_at = COALESCE(created_at, ?), updated_at = COALESCE(updated_at, ?)').run(now, now);
}

export const pairsDb = openPairsDb();
export const usersDb = openUsersDb();
