# COPILOT.md — Инструкции для GitHub Copilot (MyKHSU Backend)

Этот файл содержит правила для GitHub Copilot при работе с этим репозиторием.

> Общие правила: см. [AGENTS.md](AGENTS.md)

---

## Обязательные правила

### При изменении API-эндпоинтов
**Всегда обновляй `docs/api.md`** одновременно с изменением кода в `src/routes/`.

### При изменении схемы БД
**Всегда обновляй `docs/database.md`** при изменении `src/db/database.js`.

### При добавлении переменных окружения
**Обновляй** `README.md` (таблица env vars), `docs/deployment.md` и `.env.example`.

---

## Технический стек

- Node.js 20+ / Express 4.x / ESM (`"type": "module"`)
- SQLite: `better-sqlite3` (синхронный API — **без await**)
- Auth: `jsonwebtoken` (HS256) + `argon2` (Argon2id)
- Admin Panel: React 18 / react-router-dom v7 / Create React App

## Шаблоны кода

### Новый публичный эндпоинт (`src/routes/user.js`)

```js
router.get('/myendpoint', (req, res) => {
  const { param } = req.query;
  if (!param) return res.status(400).json({ error: 'param is required' });

  const rows = pairsDb.prepare('SELECT ... FROM pairs WHERE column = ?').all(param);
  res.json(rows);
});
```

### Новый защищённый эндпоинт (`src/routes/admin.js`)

```js
router.post('/myaction', requireAuth, (req, res) => {
  const { field } = req.body;
  if (!field) return res.status(400).json({ error: 'field is required' });

  pairsDb.prepare('INSERT INTO table (column) VALUES (?)').run(field);
  res.json({ ok: true });
});
```

### React-компонент Admin Panel

```jsx
import { useState, useEffect } from 'react';
import { adminApi } from '../api';

export default function MyScreen() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminApi.get('/myendpoint')
      .then(r => setData(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div className="screen">
      <h1 className="screen-title">Мой экран</h1>
      {/* ... */}
    </div>
  );
}
```

## Чего не делать

- Не использовать `require()` — только `import`/`export`
- Не хардкодить JWT_SECRET или пароли
- Не использовать `.then()/.catch()` в Express-обработчиках — только `async/await`
- Не добавлять `console.log` в продакшн-код без обёртки условием `DEBUG`
- Не создавать новые CSS-файлы в admin-panel — использовать существующие CSS-переменные из `styles.css`
