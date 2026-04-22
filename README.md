# MyKHSU Backend

**Бэкенд-сервер расписания занятий** для ИТИ ХГУ (KHSU). Node.js-переработка оригинального Go-сервера из репозитория `raspisanie`.

## Стек

| Слой | Технология |
| --- | --- |
| Сервер | Node.js 20+ / Express 4 |
| База данных | SQLite (better-sqlite3) |
| Аутентификация | JWT HS256 + Argon2id |
| Фронтенд | Единый bundle: [MyKHSU-web](https://github.com/PRO100BYTE/MyKHSU-web) + встроенная Admin Panel |

## Быстрый старт

```bash
# 1. Клонировать и перейти в папку
git clone <repo-url> MyKHSU-Backend
cd MyKHSU-Backend

# 2. Установить зависимости
npm install

# 3. Настроить окружение
cp .env.example .env
# Отредактируйте .env — задайте JWT_SECRET (минимум 32 символа)

# 4. Создать начальных администраторов (admin и TheDayG0ne)
npm run seed

# 5. Собрать единый frontend-бандл (web + admin-panel)
npm run build

# 6. Запустить сервер (на одном порту отдаёт API + единый фронтенд)
npm start
# или в режиме разработки с hot-reload:
npm run dev
```

После запуска:

- **API**: `http://localhost:8080/api/`
- **Админ-панель**: `http://localhost:8080/admin-panel/`
- **Фронтенд**: `http://localhost:8080/`

## Структура проекта

```text
MyKHSU-Backend/
├── src/                    # Node.js сервер
│   ├── index.js            # Точка входа, Express-приложение
│   ├── config.js           # Конфигурация из .env
│   ├── db/
│   │   └── database.js     # SQLite соединения + схема БД
│   ├── middleware/
│   │   ├── auth.js         # JWT-авторизация
│   │   └── noStore.js      # Cache-Control: no-store
│   ├── routes/
│   │   ├── user.js         # Публичный API /api/*
│   │   └── admin.js        # Административный API /adminapi/*
│   ├── parsers/
│   │   └── timetable.js    # Импорт JSON-расписания в БД
│   └── utils/
│       ├── dates.js        # Работа с неделями и датами
│       └── env.js          # Загрузчик .env
├── admin-panel/            # React-приложение admin-панели
│   ├── src/
│   │   ├── App.js          # Главный компонент, роутинг
│   │   ├── styles.css      # CSS в стилистике MyKHSU
│   │   ├── api.js          # HTTP-клиент для API
│   │   ├── context/        # AuthContext, ThemeContext
│   │   └── screens/        # Dashboard, Schedule, News, Times
│   └── public/
├── scripts/
│   ├── create-admin.js     # Управление пользователями-администраторами
│   └── build-frontend.js   # Единая сборка MyKHSU-web + admin-panel в web-build/
├── data/                   # SQLite базы данных (создаются автоматически)
│   ├── pairs.sqlite        # Расписание, новости, звонки
│   └── users.sqlite        # Пользователи-администраторы
├── web-build/              # Единый фронтенд-бандл (/, /admin-panel)
├── docs/                   # Полная документация проекта
├── .env.example            # Пример конфигурации
├── AGENTS.md               # Инструкции для AI-агентов (общие)
├── CLAUDE.md               # Инструкции для Claude
└── COPILOT.md              # Инструкции для GitHub Copilot
```

## Переменные окружения

| Переменная | По умолчанию | Описание |
| --- | --- | --- |
| `PORT` | `8080` | HTTP-порт сервера |
| `HOST` | `0.0.0.0` | Адрес прослушивания |
| `PAIRS_DB_PATH` | `./data/pairs.sqlite` | Путь к БД расписания |
| `USERS_DB_PATH` | `./data/users.sqlite` | Путь к БД пользователей |
| `JWT_SECRET` | — | **Обязательно.** Секрет для JWT (≥32 символов) |
| `STATIC_PATH` | `./static` | Путь к статическим файлам (legacy) |
| `DEBUG` | `false` | Включить отладочный вывод |
| `WEB_SOURCE_PATH` | (автопоиск) | Путь к MyKHSU-web для build:web |
| `SEED_ADMIN_PASSWORD` | (интерактивный ввод) | Пароль для admin при `npm run seed` |
| `SEED_THEDAYG0NE_PASSWORD` | (интерактивный ввод) | Пароль для TheDayG0ne при `npm run seed` |

## NPM-скрипты

| Команда | Описание |
| --- | --- |
| `npm start` | Единый запуск: предварительно собирает объединенный frontend bundle, затем стартует сервер |
| `npm run start:all` | Алиас единого запуска |
| `npm run dev` | Запуск с автоперезагрузкой при изменениях |
| `npm run build` | Единая сборка всего приложения |
| `npm run build:all` | То же, что build (единый frontend bundle, web optional) |
| `npm run seed` | Создание начальных администраторов (admin, TheDayG0ne) |
| `npm run create-admin <user> <pass>` | Создать/обновить одного администратора |
| `npm run build:admin` | Отдельная сборка React admin-панели (локально в admin-panel/build) |
| `npm run build:web` | Сборка единого frontend bundle: MyKHSU-web + admin-panel в web-build |
| `npm run users:list` | Показать пользователей админки |
| `npm run users:create -- <username> <password> [active]` | Создать пользователя |
| `npm run users:edit -- <id> [username] [password]` | Изменить логин и/или пароль |
| `npm run users:disable -- <id>` | Отключить пользователя |
| `npm run users:enable -- <id>` | Включить пользователя |
| `npm run users:delete -- <id>` | Удалить пользователя |

## Управление версией и билдом

Быстро редактируемые метаданные версии/билда вынесены в:

- `src/constants.js` — основной источник для backend/API
- `admin-panel/src/constants.js` — fallback-значения интерфейса

Публичный эндпоинт `GET /api/meta` возвращает:

- `api_version`
- `app_version`
- `build_number`
- `build_date`

## Документация

Подробная документация в папке `docs/`:

- [docs/api.md](docs/api.md) — Справочник по всем API-эндпоинтам
- [docs/architecture.md](docs/architecture.md) — Архитектура и структура проекта
- [docs/database.md](docs/database.md) — Схема базы данных
- [docs/deployment.md](docs/deployment.md) — Руководство по развёртыванию
- [docs/frontend.md](docs/frontend.md) — Подключение MyKHSU-web и admin-panel

## Связь с оригиналом (raspisanie)

Этот бэкенд — Node.js-переработка Go-проекта [`raspisanie`](raspisanie/). Использованы материалы из веток:

- **`main`** — стабильная версия API и структуры БД
- **`experimental`** — обновлённая admin-panel, редактор звонков
- **`wasm_frontend`** — текущая ветка с WASM-фронтендом (заменён на React)

## Лицензия

LGPL v3.0 (совместимо с оригинальным Go-репозиторием)
