/**
 * AES-256-GCM шифрование/дешифрование для данных Единого окна.
 * Ключ берётся из UW_ENCRYPTION_KEY окружения (минимум 16 символов).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function getDerivedKey() {
  const raw = process.env.UW_ENCRYPTION_KEY ?? ''
  if (!raw || raw.length < 16) {
    throw new Error('UW_ENCRYPTION_KEY must be set and at least 16 characters long')
  }
  // SHA-256 от ключа → 32 байта для AES-256
  return createHash('sha256').update(raw).digest()
}

/**
 * Шифрует строку.
 * @param {string} plainText
 * @returns {{ iv: string, tag: string, data: string }} Base64-строки
 */
export function encryptText(plainText) {
  const key = getDerivedKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  }
}

/**
 * Дешифрует строку.
 * @param {{ iv: string, tag: string, data: string }} payload
 * @returns {string}
 */
export function decryptText({ iv, tag, data }) {
  const key = getDerivedKey()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Шифрует бинарный буфер (файл).
 * @param {Buffer} buffer
 * @returns {{ iv: string, tag: string, data: string }} Base64-строки
 */
export function encryptBuffer(buffer) {
  const key = getDerivedKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  }
}

/**
 * Дешифрует бинарный буфер (файл).
 * @param {{ iv: string, tag: string, data: string }} payload
 * @returns {Buffer}
 */
export function decryptBuffer({ iv, tag, data }) {
  const key = getDerivedKey()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()])
}

/**
 * Генерирует случайный токен доступа для пользователя ЕО (48 hex символов).
 * @returns {string}
 */
export function createAccessToken() {
  return randomBytes(24).toString('hex')
}
