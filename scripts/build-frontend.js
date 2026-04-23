#!/usr/bin/env node
/**
 * Скрипт сборки объединенного фронтенда:
 * 1) MyKHSU-web -> web-build/
 * 2) admin-panel -> web-build/admin-panel/
 * 
 * Использование:
 *   node scripts/build-frontend.js [path/to/MyKHSU-web]
 * 
 * Если путь не указан — ищет папку автоматически:
 *   1. Переменная WEB_SOURCE_PATH из .env
 *   2. Сабмодуль ./mykhsu-web
 *   3. Соседняя папка ../../PRO100BYTE/MyKHSU-web
 */
import { loadEnv } from '../src/utils/env.js';
loadEnv();

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEST = path.join(ROOT, 'web-build');
const ADMIN_SOURCE = path.join(ROOT, 'admin-panel');
const ADMIN_DEST = path.join(DEST, 'admin-panel');

console.log('[build-meta] Синхронизируем версии/хэш/дату сборки...');
execSync('node scripts/sync-build-info.js', { cwd: ROOT, stdio: 'inherit' });

function findWebSource() {
  const rawArgs = process.argv.slice(2).filter(arg => arg !== '--optional');
  const fromArg = rawArgs[0];
  if (fromArg) return path.resolve(fromArg);
  
  const fromEnv = process.env.WEB_SOURCE_PATH;
  if (fromEnv) return path.resolve(fromEnv);

  // Автопоиск
  const candidates = [
    path.join(ROOT, 'mykhsu-web'),
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

console.log(`[frontend] Источник MyKHSU-web: ${webSource}`);

// Для production-сборки proxy не требуется. Это нужно только для локального npm start в mykhsu-web.
const pkg = JSON.parse(fs.readFileSync(path.join(webSource, 'package.json'), 'utf-8'));
if (!pkg.proxy) {
  console.log('[info] В MyKHSU-web/package.json нет поля "proxy". Для production-сборки это нормально.');
}

// Собираем основной фронтенд
console.log('[frontend:web] Устанавливаем зависимости...');
execSync('npm install', { cwd: webSource, stdio: 'inherit' });

console.log('[frontend:web] Собираем...');
execSync('npm run build', { cwd: webSource, stdio: 'inherit', env: { ...process.env, PUBLIC_URL: '/' } });

// Копируем build/ → web-build/
const buildDir = path.join(webSource, 'build');
if (!fs.existsSync(buildDir)) {
  console.error('[error] MyKHSU-web не создал папку build/');
  process.exit(1);
}

if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true });
fs.cpSync(buildDir, DEST, { recursive: true });

// Собираем админ-панель и вкладываем в общий frontend bundle
if (!fs.existsSync(path.join(ADMIN_SOURCE, 'package.json'))) {
  console.error(`[error] Не найдена admin-panel: ${ADMIN_SOURCE}`);
  process.exit(1);
}

console.log('[frontend:admin] Устанавливаем зависимости...');
execSync('npm install', { cwd: ADMIN_SOURCE, stdio: 'inherit' });

console.log('[frontend:admin] Собираем...');
execSync('npm run build', {
  cwd: ADMIN_SOURCE,
  stdio: 'inherit',
  env: { ...process.env, PUBLIC_URL: '/admin-panel' },
});

const adminBuildDir = path.join(ADMIN_SOURCE, 'build');
if (!fs.existsSync(adminBuildDir)) {
  console.error('[error] admin-panel не создал папку build/');
  process.exit(1);
}

if (fs.existsSync(ADMIN_DEST)) fs.rmSync(ADMIN_DEST, { recursive: true });
fs.cpSync(adminBuildDir, ADMIN_DEST, { recursive: true });

console.log(`\n✓ Единый фронтенд собран в: ${DEST}`);
console.log('  MyKHSU-web: /');
console.log('  Admin panel: /admin-panel/');
console.log('  Запустите сервер: npm start');
