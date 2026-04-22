import { loadEnv } from './utils/env.js';

loadEnv();

export const config = {
  port: parseInt(process.env.PORT ?? '8080', 10),
  host: process.env.HOST ?? '0.0.0.0',
  pairsDbPath: process.env.PAIRS_DB_PATH ?? './data/pairs.sqlite',
  usersDbPath: process.env.USERS_DB_PATH ?? './data/users.sqlite',
  jwtSecret: process.env.JWT_SECRET ?? '',
  staticPath: process.env.STATIC_PATH ?? './static',
  unifiedWindowEncryptionKey: process.env.UW_ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? '',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: parseInt(process.env.SMTP_PORT ?? '587', 10),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? '',
  logToConsole: process.env.LOG_TO_CONSOLE !== 'false',
  debug: process.env.DEBUG === 'true',
};

if (!config.jwtSecret || config.jwtSecret.length < 32) {
  throw new Error(
    'JWT_SECRET must be set in environment and at least 32 characters long.'
  );
}

if (!config.unifiedWindowEncryptionKey || config.unifiedWindowEncryptionKey.length < 16) {
  throw new Error(
    'UW_ENCRYPTION_KEY must be set in environment and at least 16 characters long.'
  );
}
