import { loadEnv } from './utils/env.js';

loadEnv();

export const config = {
  port: parseInt(process.env.PORT ?? '8080', 10),
  host: process.env.HOST ?? '0.0.0.0',
  pairsDbPath: process.env.PAIRS_DB_PATH ?? './data/pairs.sqlite',
  usersDbPath: process.env.USERS_DB_PATH ?? './data/users.sqlite',
  jwtSecret: process.env.JWT_SECRET ?? '',
  staticPath: process.env.STATIC_PATH ?? './static',
  logToConsole: process.env.LOG_TO_CONSOLE !== 'false',
  debug: process.env.DEBUG === 'true',
};

if (!config.jwtSecret || config.jwtSecret.length < 32) {
  throw new Error(
    'JWT_SECRET must be set in environment and at least 32 characters long.'
  );
}
