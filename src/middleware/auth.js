import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { usersDb } from '../db/database.js';

/**
 * Извлекает JWT токен из заголовков запроса.
 * Поддерживает: Authorization: Bearer <token>  и  Token: <token>
 */
function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  const tokenHeader = req.headers['token'];
  if (tokenHeader) return tokenHeader;
  return null;
}

/**
 * Middleware: проверяет JWT и кладёт uid/username в req.user
 */
export function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: no token provided' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    if (!payload.auth) {
      return res.status(403).json({ error: 'Forbidden: invalid token claims' });
    }

    const dbUser = usersDb
      .prepare('SELECT id, username, is_active, role, first_name, last_name, position, email FROM users WHERE id = ?')
      .get(payload.uid);
    if (!dbUser) {
      return res.status(401).json({ error: 'Unauthorized: user not found' });
    }
    if (!dbUser.is_active) {
      return res.status(403).json({ error: 'Forbidden: user is disabled' });
    }

    req.user = {
      uid: payload.uid,
      username: dbUser.username,
      role: dbUser.role ?? 'admin',
      first_name: dbUser.first_name ?? null,
      last_name: dbUser.last_name ?? null,
      position: dbUser.position ?? null,
      email: dbUser.email ?? null,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
  }
}
