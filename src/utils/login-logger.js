import { UAParser } from 'ua-parser-js';
import { usersDb } from '../db/database.js';
import { nowKrasnoyarskSql } from './time.js';

/**
 * Извлекает IP адрес из request
 * Поддерживает X-Forwarded-For (за прокси), X-Real-IP и прямое соединение
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // X-Forwarded-For может содержать несколько IP, берём первый
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp) return realIp;
  return req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
}

/**
 * Парсит User-Agent и возвращает информацию об устройстве
 */
function parseUserAgent(userAgentString) {
  try {
    const parser = new UAParser(userAgentString);
    const result = parser.getResult();

    return {
      device_model: result.device?.name || null,
      device_os: result.os?.name || null,
      device_os_version: result.os?.version || null,
      browser_name: result.browser?.name || null,
      browser_version: result.browser?.version || null,
      user_agent: userAgentString || null,
    };
  } catch (err) {
    console.warn('Failed to parse User-Agent:', err.message);
    return {
      device_model: null,
      device_os: null,
      device_os_version: null,
      browser_name: null,
      browser_version: null,
      user_agent: userAgentString || null,
    };
  }
}

/**
 * Логирует вход пользователя в БД
 * @param {number} userId - ID пользователя
 * @param {object} req - Express request object
 */
export async function logUserLogin(userId, req) {
  try {
    const ipAddress = getClientIp(req);
    const userAgentString = req.headers['user-agent'] || 'unknown';
    const deviceInfo = parseUserAgent(userAgentString);

    const now = nowKrasnoyarskSql();

    usersDb.prepare(`
      INSERT INTO login_history (
        user_id,
        ip_address,
        user_agent,
        device_model,
        device_os,
        device_os_version,
        browser_name,
        browser_version,
        login_timestamp,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      ipAddress,
      deviceInfo.user_agent,
      deviceInfo.device_model,
      deviceInfo.device_os,
      deviceInfo.device_os_version,
      deviceInfo.browser_name,
      deviceInfo.browser_version,
      now,
      now
    );
  } catch (err) {
    console.error('Failed to log user login:', err.message);
    // Не прерываем процесс логина из-за ошибки логирования
  }
}

/**
 * Получает историю входов пользователя
 */
export function getUserLoginHistory(userId, limit = 50, offset = 0) {
  try {
    return usersDb.prepare(`
      SELECT
        id,
        user_id,
        ip_address,
        user_agent,
        device_model,
        device_os,
        device_os_version,
        browser_name,
        browser_version,
        login_timestamp,
        created_at
      FROM login_history
      WHERE user_id = ?
      ORDER BY login_timestamp DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset);
  } catch (err) {
    console.error('Failed to get user login history:', err.message);
    return [];
  }
}

/**
 * Получает историю входов всех пользователей (для админа)
 */
export function getAllLoginHistory(limit = 100, offset = 0, userId = null) {
  try {
    let query = `
      SELECT
        lh.id,
        lh.user_id,
        u.username,
        u.first_name,
        u.last_name,
        lh.ip_address,
        lh.user_agent,
        lh.device_model,
        lh.device_os,
        lh.device_os_version,
        lh.browser_name,
        lh.browser_version,
        lh.login_timestamp,
        lh.created_at
      FROM login_history lh
      JOIN users u ON lh.user_id = u.id
    `;

    const params = [];

    if (userId) {
      query += ' WHERE lh.user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY lh.login_timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return usersDb.prepare(query).all(...params);
  } catch (err) {
    console.error('Failed to get all login history:', err.message);
    return [];
  }
}

/**
 * Получает статистику входов для пользователя
 */
export function getUserLoginStats(userId) {
  try {
    const stats = usersDb.prepare(`
      SELECT
        COUNT(*) as total_logins,
        COUNT(DISTINCT DATE(login_timestamp)) as unique_days,
        COUNT(DISTINCT ip_address) as unique_ips,
        MAX(login_timestamp) as last_login,
        GROUP_CONCAT(DISTINCT device_os) as os_list,
        GROUP_CONCAT(DISTINCT browser_name) as browser_list
      FROM login_history
      WHERE user_id = ?
    `).get(userId);

    return stats || {
      total_logins: 0,
      unique_days: 0,
      unique_ips: 0,
      last_login: null,
      os_list: null,
      browser_list: null,
    };
  } catch (err) {
    console.error('Failed to get user login stats:', err.message);
    return null;
  }
}
