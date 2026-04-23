import fs from 'node:fs'
import path from 'node:path'

const LOG_DIR = path.resolve(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'server.log')
const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024
const LOG_TO_CONSOLE = process.env.LOG_TO_CONSOLE !== 'false'

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

function rotateIfNeeded() {
  try {
    if (!fs.existsSync(LOG_FILE)) return
    const stat = fs.statSync(LOG_FILE)
    if (stat.size < MAX_LOG_SIZE_BYTES) return

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const rotated = path.join(LOG_DIR, `server-${stamp}.log`)
    fs.renameSync(LOG_FILE, rotated)
  } catch {
    // Если ротация не удалась, продолжаем писать в текущий файл.
  }
}

function safeJson(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return '"[unserializable]"'
  }
}

function write(level, message, context = {}) {
  ensureLogDir()
  rotateIfNeeded()

  const line = `${new Date().toISOString()} [${level}] ${message} ${safeJson(context)}\n`
  fs.appendFileSync(LOG_FILE, line, 'utf-8')

  if (LOG_TO_CONSOLE) {
    const output = line.trimEnd()
    if (level === 'ERROR') {
      console.error(output)
    } else if (level === 'WARN') {
      console.warn(output)
    } else {
      console.log(output)
    }
  }
}

export function logInfo(message, context = {}) {
  write('INFO', message, context)
}

export function logWarn(message, context = {}) {
  write('WARN', message, context)
}

export function logError(message, context = {}) {
  write('ERROR', message, context)
}

export function getLogFilePath() {
  return LOG_FILE
}
