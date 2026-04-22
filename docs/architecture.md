# Архитектура проекта — MyKHSU Backend

## Обзор

```
                    ┌─────────────────────────────────────┐
                    │           Express Server             │
                    │           src/index.js              │
                    ├──────────┬──────────────────────────┤
                    │ /api/*   │ /adminapi/*              │
                    │ Публичный│ Административный         │
                    │ API      │ API (JWT-защита)         │
                    ├──────────┴──────────────────────────┤
                    │         SQLite (better-sqlite3)     │
                    │  pairs.sqlite  │  users.sqlite      │
                    └─────────────────────────────────────┘
                         ▲
              ┌──────────┴────────────────────────────────────┐
              │        Единый frontend bundle (web-build)     │
              │  MyKHSU-web (/) + Admin Panel (/admin-panel/) │
              └───────────────────────────────────────────────┘
```

## Слои приложения

### 1. Сервер (src/)

| Файл | Роль |
|---|---|
| `index.js` | Express-инициализация, подключение роутеров, раздача единого frontend bundle |
| `config.js` | Загрузка и валидация конфигурации из `.env` |
| `constants.js` | Централизованные версии, номер билда и служебные метаданные |
| `db/database.js` | Создание SQLite-соединений, инициализация схемы БД |
| `routes/user.js` | Все публичные GET-эндпоинты (`/api/*`) |
| `routes/admin.js` | Административные эндпоинты (`/adminapi/*`) |
| `parsers/timetable.js` | Парсер JSON-файла расписания (формат ХГСУ) |
| `middleware/auth.js` | JWT-проверка для защищённых маршрутов |
| `middleware/noStore.js` | Заголовки Cache-Control: no-store |
| `utils/dates.js` | Вычисление дат по номеру недели |
| `utils/env.js` | Парсер .env без сторонних зависимостей |

### 2. Admin Panel (admin-panel/src/)

| Файл / Папка | Роль |
|---|---|
| `App.js` | Роутинг, layout с сайдбаром и шапкой |
| `styles.css` | CSS-переменные и компоненты в стилистике MyKHSU |
| `api.js` | HTTP-клиент с авторизацией через JWT |
| `context/AuthContext.js` | Глобальное состояние аутентификации |
| `context/ThemeContext.js` | Переключение тем light/dark |
| `screens/LoginScreen.js` | Экран входа |
| `screens/DashboardScreen.js` | Главный экран с метриками |
| `screens/ScheduleScreen.js` | Загрузка / очистка расписания |
| `screens/NewsScreen.js` | CRUD для новостей |
| `screens/TimesScreen.js` | Редактор расписания звонков |
| `screens/UsersScreen.js` | Управление пользователями админки |

### 3. Скрипты (scripts/)

| Файл | Запуск | Описание |
|---|---|---|
| `create-admin.js` | `npm run seed` | Создание начальных администраторов |
| `manage-users.js` | `npm run users:*` | CLI управление пользователями (list/edit/disable/delete) |
| `build-frontend.js` | `npm run build:web` | Сборка MyKHSU-web |

## Поток данных

### Запрос публичного API

```
Client → GET /api/getpairs?type=group&group=ИТ-21&date=22.04.2026
  → middleware/noStore.js (устанавливает заголовки)
  → routes/user.js#handler
  → db/database.js (pairsDb.prepare().all())
  → rows → mapLesson()
  → JSON response
```

### Запрос административного API

```
Client → POST /adminapi/createtable  {Authorization: Bearer <token>}
  → middleware/noStore.js
  → middleware/auth.js (jwt.verify + user.exists + user.is_active)
  → routes/admin.js#handler
  → multer (парсинг multipart)
  → parsers/timetable.js (importTimetable)
  → db/database.js (sqlite transaction)
  → JSON response
```

## Аутентификация

Алгоритм `argon2id` для хранения паролей:
```
password → argon2.hash(password) → stored in users.sqlite
login → argon2.verify(stored_hash, password) → JWT(HS256, 24h)
```

JWT payload:
```json
{ "uid": 1, "username": "admin", "auth": true, "iat": ..., "exp": ... }
```

Middleware поддерживает два заголовка:
- `Authorization: Bearer <token>`
- `Token: <token>` (совместимость с Go-версией)

Дополнительно middleware проверяет:
- пользователь существует в `users.sqlite`
- поле `is_active = 1`

## Структура БД

Подробно: см. [database.md](database.md)

## Фронтенд

Подробно: см. [frontend.md](frontend.md)

## Взаимосвязь с Go-оригиналом (raspisanie/)

| Аспект | Go-версия | Node.js-версия |
|---|---|---|
| HTTP роутер | gorilla/mux | Express |
| JWT | golang-jwt/jwt/v5 | jsonwebtoken |
| Пароли | argon2.IDKey (hex) | argon2 (npm) |
| SQLite | mattn/go-sqlite3 | better-sqlite3 |
| Конфиг | собственный парсер | .env |
| Логирование | xlogger (GitFlic) | console |
| Фронтенд | WebAssembly (wasm_frontend) | React (MyKHSU-web) |
| Admin UI | Go templates (experimental) | React |

Схема таблиц и формат API **полностью совместимы** с Go-версией.
