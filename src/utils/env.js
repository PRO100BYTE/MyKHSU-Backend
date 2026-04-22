import fs from 'node:fs';
import path from 'node:path';

/**
 * Минимальный загрузчик .env файла без сторонних зависимостей.
 * Читает .env из корня проекта (рядом с package.json).
 */
export function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Убрать кавычки если есть
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    const currentValue = process.env[key];
    // Разрешаем .env заполнять пустые значения из окружения (например JWT_SECRET="")
    if (!(key in process.env) || currentValue === undefined || currentValue === '') {
      process.env[key] = value;
    }
  }
}
