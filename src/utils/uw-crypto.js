import crypto from 'node:crypto'
import { config } from '../config.js'

function getKey() {
  // Используем SHA-256 от фразы для стабильного 32-байтного ключа.
  return crypto.createHash('sha256').update(config.unifiedWindowEncryptionKey).digest()
}

function b64(input) {
  return Buffer.from(input).toString('base64')
}

function fromB64(input) {
  return Buffer.from(input, 'base64')
}

export function encryptText(plainText) {
  if (!plainText) return null
  const iv = crypto.randomBytes(12)
  const key = getKey()
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    iv: b64(iv),
    tag: b64(tag),
    data: b64(encrypted),
  }
}

export function decryptText(payload) {
  if (!payload || !payload.iv || !payload.tag || !payload.data) return ''
  const key = getKey()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, fromB64(payload.iv))
  decipher.setAuthTag(fromB64(payload.tag))
  const decrypted = Buffer.concat([decipher.update(fromB64(payload.data)), decipher.final()])
  return decrypted.toString('utf8')
}

export function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(12)
  const key = getKey()
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    iv: b64(iv),
    tag: b64(tag),
    data: b64(encrypted),
  }
}

export function decryptBuffer(payload) {
  const key = getKey()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, fromB64(payload.iv))
  decipher.setAuthTag(fromB64(payload.tag))
  return Buffer.concat([decipher.update(fromB64(payload.data)), decipher.final()])
}

export function createAccessToken() {
  return crypto.randomBytes(24).toString('hex')
}
