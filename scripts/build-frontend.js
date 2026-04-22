#!/usr/bin/env node
/**
 * Скрипт сборки фронтенда MyKHSU-web и копирования в web-build/.
 * 
 * Использование:
 *   node scripts/build-frontend.js [path/to/MyKHSU-web]
 * 
 * Если путь не указан — ищет папку автоматически:
 *   1. Переменная WEB_SOURCE_PATH из .env
 *   2. Соседняя папка ../../PRO100BYTE/MyKHSU-web
 */
import { loadEnv } from '../src/utils/env.js';
loadEnv();

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname ?? process.cwd(), '..');
const DEST = path.join(ROOT, 'web-build');

function findWebSource() {
  const rawArgs = process.argv.slice(2).filter(arg => arg !== '--optional');
  const fromArg = rawArgs[0];
  if (fromArg) return path.resolve(fromArg);
  
  const fromEnv = process.env.WEB_SOURCE_PATH;
  if (fromEnv) return path.resolve(fromEnv);

  // Автопоиск
  const candidates = [
    path.join(ROOT, '..', 'PRO100BYTE', 'MyKHSU-web'),
    path.join(ROOT, '..', 'MyKHSU-web'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'package.json'))) return c;
  }
  return null;
}

const optionalMode = process.argv.includes('--optional');
const webSource = findWebSource();
if (!webSource) {
  if (optionalMode) {
    console.warn('[frontend] Пропуск сборки: не найдена папка MyKHSU-web.');
    process.exit(0);
  }

  console.error('Не удалось найти папку MyKHSU-web.');
  console.error('Укажите путь: node scripts/build-frontend.js /path/to/MyKHSU-web');
  console.error('Или задайте WEB_SOURCE_PATH в .env');
  process.exit(1);
}

console.log(`[frontend] Источник: ${webSource}`);

// Проверим что это CRA-проект с /api прокси
const pkg = JSON.parse(fs.readFileSync(path.join(webSource, 'package.json'), 'utf-8'));
if (!pkg.proxy) {
  console.warn('[warn] В MyKHSU-web/package.json нет поля "proxy". Добавьте "proxy": "http://localhost:8080"');
}

// Собираем
console.log('[frontend] Устанавливаем зависимости...');
execSync('npm install', { cwd: webSource, stdio: 'inherit' });

console.log('[frontend] Собираем...');
execSync('npm run build', { cwd: webSource, stdio: 'inherit', env: { ...process.env, PUBLIC_URL: '/' } });

// Копируем build/ → web-build/
const buildDir = path.join(webSource, 'build');
if (!fs.existsSync(buildDir)) {
  console.error('[error] Сборка не создала папку build/');
  process.exit(1);
}

if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true });
fs.cpSync(buildDir, DEST, { recursive: true });

console.log(`\n✓ Фронтенд скопирован в: ${DEST}`);
console.log('  Запустите сервер: npm start');
