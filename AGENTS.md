# AGENTS.md — Инструкции для ИИ-агентов (MyKHSU Backend)

Этот файл содержит правила работы с кодовой базой для всех ИИ-агентов (Copilot, Claude, Cursor и др.).

---

## Обязательные правила актуализации документации

**При каждом изменении кода соответствующая документация должна обновляться в той же задаче.**

| Изменён файл | Обновить |
|---|---|
| `src/routes/user.js` | `docs/api.md` (секция публичного API) |
| `src/routes/admin.js` | `docs/api.md` (секция административного API) |
| `src/db/database.js` | `docs/database.md` (схема таблиц, индексы) |
| `src/config.js` | `README.md` (таблица переменных окружения), `docs/deployment.md` |
| `package.json` (scripts) | `README.md` (таблица npm-скриптов) |
| `src/index.js` | `docs/architecture.md` (маршрутизация), `docs/frontend.md` |
| `src/parsers/*` | `docs/api.md` (формат JSON расписания) |
| `src/middleware/*` | `docs/architecture.md` |
| `scripts/*` | `README.md`, `docs/database.md` |
| `admin-panel/src/**` | `docs/frontend.md` |

Если вы меняете несколько файлов, сначала внесите все изменения в код, затем одним проходом обновите всю затронутую документацию.

---

## Структура проекта

```
MyKHSU-Backend/
├── src/            # Node.js backend (ESM, Express)
├── admin-panel/    # React Admin Panel (CRA)
├── web-build/      # Собранный MyKHSU-web (не коммитить)
├── scripts/        # Утилиты (seed, build-frontend)
├── data/           # SQLite файлы (не коммитить)
├── docs/           # Документация
└── README.md
```

## Соглашения по коду

- **Модульная система:** ESM (`import`/`export`), не CJS
- **Асинхронность:** `async/await`, без callback-стиля
- **SQLite:** `better-sqlite3` — синхронный API (без `await`)
- **Обработка ошибок:** try/catch в route-handlers, `res.status(N).json({ error })`
- **Аутентификация:** JWT HS256, секрет из переменной окружения, не хардкодить
- **Пароли:** только Argon2id через npm-пакет `argon2`, не MD5/SHA/bcrypt

## Безопасность (OWASP Top 10)

При создании или изменении кода проверяйте:

- Входные данные **валидируются** до передачи в SQL (prepared statements, не строковая конкатенация)
- JWT-секрет хранится в `.env`, не в коде
- Загружаемые файлы не сохраняются на диск напрямую, обрабатываются в памяти (multer memoryStorage)
- CORS настроен явно, не `origin: '*'` в продакшне

## Git Workflow

- Сообщения коммитов на русском языке допустимы
- Не коммитить: `data/`, `web-build/`, `admin-panel/build/`, `.env`, `node_modules/`

## Тестирование

Перед предложением изменений убедитесь, что:
1. `node --input-type=module < src/index.js` не выдаёт синтаксических ошибок
2. Новые эндпоинты задокументированы в `docs/api.md`
3. Новые env-переменные добавлены в `.env.example` и `README.md`
