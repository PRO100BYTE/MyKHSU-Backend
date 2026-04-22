import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { noStore } from './middleware/noStore.js';
import userRouter from './routes/user.js';
import adminRouter from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const app = express();

// ---------------------------------------------------------------------------
// Парсинг тела запроса
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Заголовки no-cache для API
// ---------------------------------------------------------------------------
app.use('/api', noStore);
app.use('/adminapi', noStore);
app.use('/admin', noStore);

// ---------------------------------------------------------------------------
// Публичный API
// ---------------------------------------------------------------------------
app.use('/api', userRouter);

// ---------------------------------------------------------------------------
// Административный API (два префикса — /admin и /adminapi)
// ---------------------------------------------------------------------------
app.use('/adminapi', adminRouter);
app.use('/admin',    adminRouter);

// ---------------------------------------------------------------------------
// Статика Admin Panel (React build)
// Доступна по /admin-panel/*
// ---------------------------------------------------------------------------
const adminPanelBuild = path.join(ROOT, 'admin-panel', 'build');
if (fs.existsSync(adminPanelBuild)) {
  app.use('/admin-panel', express.static(adminPanelBuild));
  // SPA fallback для admin-panel
  app.get('/admin-panel/*', (_req, res) => {
    res.sendFile(path.join(adminPanelBuild, 'index.html'));
  });
}

// ---------------------------------------------------------------------------
// Статика основного фронтенда
// ---------------------------------------------------------------------------
const staticDir = path.isAbsolute(config.staticPath)
  ? config.staticPath
  : path.resolve(ROOT, config.staticPath);

if (config.debug) {
  console.log(`[static] Serving from: ${staticDir}`);
}

app.use('/static', express.static(staticDir));

// Проверяем — есть ли сборка MyKHSU-web
const webBuildDir = path.join(ROOT, 'web-build');
if (fs.existsSync(webBuildDir)) {
  app.use(express.static(webBuildDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webBuildDir, 'index.html'), err => {
      if (err) res.status(404).send('Not Found');
    });
  });
} else {
  // Fallback для старого WASM-фронтенда
  app.get('*', (_req, res) => {
    const indexPath = path.join(staticDir, 'index.html');
    res.sendFile(indexPath, err => {
      if (err) res.status(404).send('Not Found');
    });
  });
}

// ---------------------------------------------------------------------------
// Глобальный обработчик ошибок
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ---------------------------------------------------------------------------
// Запуск
// ---------------------------------------------------------------------------
app.listen(config.port, config.host, () => {
  console.log(`[server] Listening on http://${config.host}:${config.port}`);
  if (fs.existsSync(adminPanelBuild)) {
    console.log(`[admin]  Panel: http://${config.host}:${config.port}/admin-panel/`);
  } else {
    console.log('[admin]  Panel not built. Run: cd admin-panel && npm run build');
  }
});

export default app;
