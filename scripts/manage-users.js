#!/usr/bin/env node
import { loadEnv } from '../src/utils/env.js';
loadEnv();

import argon2 from 'argon2';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

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
const [, , command, ...args] = process.argv;

function printUsage() {
  console.log('Команды:');
  console.log('  node scripts/manage-users.js list');
  console.log('  node scripts/manage-users.js create <username> <password> [active:true|false]');
  console.log('  node scripts/manage-users.js edit <id> [username] [password]');
  console.log('  node scripts/manage-users.js disable <id>');
  console.log('  node scripts/manage-users.js enable <id>');
  console.log('  node scripts/manage-users.js delete <id>');
}

function listUsers() {
  const users = db.prepare('SELECT id, username, is_active, created_at, updated_at FROM users ORDER BY username COLLATE NOCASE').all();
  if (!users.length) {
    console.log('Пользователи не найдены.');
    return;
  }

  console.table(users.map(u => ({
    id: u.id,
    username: u.username,
    status: u.is_active ? 'active' : 'disabled',
    created_at: u.created_at ?? '-',
    updated_at: u.updated_at ?? '-',
  })));
}

async function createUser(username, password, activeRaw) {
  const safeUsername = String(username ?? '').trim();
  if (!safeUsername || !password) {
    console.error('Нужны username и password.');
    process.exit(1);
  }
  if (String(password).length < 8) {
    console.error('Пароль должен быть не короче 8 символов.');
    process.exit(1);
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(safeUsername);
  if (exists) {
    console.error(`Пользователь "${safeUsername}" уже существует.`);
    process.exit(1);
  }

  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const active = activeRaw === 'false' ? 0 : 1;
  db.prepare('INSERT INTO users (username, password, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(safeUsername, hash, active, now(), now());
  console.log(`Пользователь "${safeUsername}" создан.`);
}

async function editUser(idRaw, username, password) {
  const id = parseInt(idRaw, 10);
  if (Number.isNaN(id)) {
    console.error('Некорректный id.');
    process.exit(1);
  }

  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!target) {
    console.error('Пользователь не найден.');
    process.exit(1);
  }

  const updates = [];
  const params = { id, updated_at: now() };

  if (username) {
    const safeUsername = username.trim();
    if (safeUsername.length < 3) {
      console.error('Username должен содержать минимум 3 символа.');
      process.exit(1);
    }
    const conflict = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(safeUsername, id);
    if (conflict) {
      console.error('Такой username уже занят.');
      process.exit(1);
    }
    updates.push('username = @username');
    params.username = safeUsername;
  }

  if (password) {
    if (password.length < 8) {
      console.error('Пароль должен быть не короче 8 символов.');
      process.exit(1);
    }
    params.password = await argon2.hash(password, { type: argon2.argon2id });
    updates.push('password = @password');
  }

  if (!updates.length) {
    console.error('Нечего обновлять: передайте username и/или password.');
    process.exit(1);
  }

  updates.push('updated_at = @updated_at');
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = @id`).run(params);
  console.log(`Пользователь #${id} обновлен.`);
}

function setStatus(idRaw, isActive) {
  const id = parseInt(idRaw, 10);
  if (Number.isNaN(id)) {
    console.error('Некорректный id.');
    process.exit(1);
  }

  const result = db.prepare('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?').run(isActive ? 1 : 0, now(), id);
  if (!result.changes) {
    console.error('Пользователь не найден.');
    process.exit(1);
  }

  console.log(`Пользователь #${id} ${isActive ? 'включен' : 'отключен'}.`);
}

function deleteUser(idRaw) {
  const id = parseInt(idRaw, 10);
  if (Number.isNaN(id)) {
    console.error('Некорректный id.');
    process.exit(1);
  }

  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (!result.changes) {
    console.error('Пользователь не найден.');
    process.exit(1);
  }

  console.log(`Пользователь #${id} удален.`);
}

(async () => {
  switch (command) {
    case 'list':
      listUsers();
      break;
    case 'create':
      await createUser(args[0], args[1], args[2]);
      break;
    case 'edit':
      await editUser(args[0], args[1], args[2]);
      break;
    case 'disable':
      setStatus(args[0], false);
      break;
    case 'enable':
      setStatus(args[0], true);
      break;
    case 'delete':
      deleteUser(args[0]);
      break;
    default:
      printUsage();
      process.exit(command ? 1 : 0);
  }
})();
