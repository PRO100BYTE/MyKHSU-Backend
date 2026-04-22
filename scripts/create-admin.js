#!/usr/bin/env node
/**
 * Утилита управления администраторами.
 * 
 * Использование:
 *   node scripts/create-admin.js <username> <password>   — создать/обновить пользователя
 *   node scripts/create-admin.js --seed                  — создать начальных администраторов
 *                                                          (admin / TheDayG0ne) из SEED_PASSWORDS
 *                                                          или интерактивного ввода
 *
 * Переменные окружения:
 *   SEED_ADMIN_PASSWORD       — пароль для пользователя admin
 *   SEED_THEDAYG0NE_PASSWORD  — пароль для пользователя TheDayG0ne
 */
import { loadEnv } from '../src/utils/env.js';
loadEnv();

import argon2 from 'argon2';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import readline from 'node:readline';

const usersDbPath = process.env.USERS_DB_PATH ?? './data/users.sqlite';
const absPath = path.resolve(process.cwd(), usersDbPath);

fs.mkdirSync(path.dirname(absPath), { recursive: true });
const db = new Database(absPath);
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

const columns = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
if (!columns.includes('is_active')) db.exec('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
if (!columns.includes('created_at')) db.exec('ALTER TABLE users ADD COLUMN created_at TEXT');
if (!columns.includes('updated_at')) db.exec('ALTER TABLE users ADD COLUMN updated_at TEXT');

const now = () => new Date().toISOString();

async function upsertUser(username, password) {
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    db.prepare('UPDATE users SET password = ?, is_active = 1, updated_at = ? WHERE username = ?').run(hash, now(), username);
    console.log(`[update] User "${username}" password updated.`);
  } else {
    db.prepare('INSERT INTO users (username, password, is_active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)').run(username, hash, now(), now());
    console.log(`[create] Admin user "${username}" created.`);
  }
}

async function promptPassword(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Скрыть вывод пароля
    process.stdout.write(prompt);
    let pwd = '';
    process.stdin.setRawMode?.(true);
    process.stdin.on('data', function handler(ch) {
      const char = ch.toString();
      if (char === '\n' || char === '\r' || char === '\u0004') {
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener('data', handler);
        process.stdout.write('\n');
        rl.close();
        resolve(pwd);
      } else if (char === '\u0003') {
        process.exit(1);
      } else if (char === '\u007f') {
        pwd = pwd.slice(0, -1);
      } else {
        pwd += char;
      }
    });
  });
}

const args = process.argv.slice(2);

if (args[0] === '--seed') {
  // Режим инициализации начальных администраторов
  const initialAdmins = ['admin', 'TheDayG0ne'];
  console.log('=== Инициализация начальных администраторов ===');
  for (const username of initialAdmins) {
    const envKey = username === 'admin' ? 'SEED_ADMIN_PASSWORD' : 'SEED_THEDAYG0NE_PASSWORD';
    let password = process.env[envKey];
    if (!password) {
      password = await promptPassword(`Введите пароль для "${username}": `);
    }
    if (!password || password.length < 8) {
      console.error(`Пароль для "${username}" должен содержать минимум 8 символов.`);
      process.exit(1);
    }
    await upsertUser(username, password);
  }
  console.log('\n✓ Начальные администраторы настроены.');
} else {
  // Режим одиночного пользователя
  const [username, password] = args;
  if (!username || !password) {
    console.error('Usage:\n  node scripts/create-admin.js <username> <password>\n  node scripts/create-admin.js --seed');
    process.exit(1);
  }
  await upsertUser(username, password);
}
