# Фронтенд — MyKHSU Backend

Бэкенд поддерживает два фронтенд-компонента:

1. **MyKHSU-web** — основной пользовательский интерфейс (React SPA)
2. **admin-panel** — панель администратора (React SPA, встроена в репозиторий)

---

## MyKHSU-web

Репозиторий: [PRO100BYTE/MyKHSU-web](https://github.com/PRO100BYTE/MyKHSU-web)

### Подключение

```bash
# Автоматическая сборка и копирование
npm run build:web

# Или вручную с указанием пути
node scripts/build-frontend.js /path/to/MyKHSU-web
```

Собранный фронтенд копируется в `web-build/` и раздаётся бэкендом (catchall `/*`).

Для единой сборки всего проекта используйте:

```bash
npm run build
```

### Настройка proxy в dev-режиме

В `MyKHSU-web/package.json` должно быть:
```json
{
  "proxy": "http://localhost:8080"
}
```

Тогда при `npm start` из папки MyKHSU-web запросы `/api/*` проксируются на бэкенд.

### Что нужно поменять в MyKHSU-web

Файл `src/utils/constants.js` — убедитесь, что `API_BASE_URL` указывает на бэкенд:
```js
export const API_BASE_URL = process.env.NODE_ENV === 'development'
  ? '/api'                   // CRA proxy → localhost:8080
  : 'https://t2iti.khsu.ru/api';  // продакшн
```

---

## Admin Panel

Встроена в репозиторий в папке `admin-panel/`.

### Технологии

- **React 18** + React Router 7
- **Ionicons 7** (через CDN)
- **Шрифт Montserrat** (Google Fonts)
- CSS-переменные в стилистике MyKHSU (glass-morphism, dark/light theme)

### Сборка

```bash
npm run build:admin
# Эквивалентно:
cd admin-panel && npm install && npm run build
```

Собранные файлы (`admin-panel/build/`) раздаются по маршруту `/admin-panel/`.

### Доступные экраны

| Маршрут | Экран | Описание |
|---|---|---|
| `/admin-panel/` | — | Редирект на /dashboard |
| `/admin-panel/login` | LoginScreen | Вход по логину и паролю |
| `/admin-panel/dashboard` | DashboardScreen | Метрики: недели, курсы, дата обновления |
| `/admin-panel/schedule` | ScheduleScreen | Загрузка / очистка расписания |
| `/admin-panel/times` | TimesScreen | Редактор расписания звонков |
| `/admin-panel/news` | NewsScreen | Управление новостями |
| `/admin-panel/users` | UsersScreen | Пользователи админки (CRUD + disable/enable) |

### Версия/билд в интерфейсе

Версия, билд и дата билда берутся из `GET /api/meta`.  
Резервные значения вынесены в `admin-panel/src/constants.js`.

### Темы

Admin Panel поддерживает два режима: `light` и `dark`.  
Переключатель — кнопка с иконкой луны/солнца в правом углу шапки.  
Выбор сохраняется в `localStorage` (ключ `admin_theme`).

### Дизайн

Стилистика максимально близка к MyKHSU-web:
- Glass-morphism карточки и сайдбар (`backdrop-filter: blur(40px)`)
- Те же CSS-переменные (`--accent`, `--background`, `--surface-card`, ...)
- Шрифт Montserrat
- Акцентный цвет `#10B981` (зелёный)
- Анимации: `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring effect)

---

## Маршруты в Express

```
GET  /               → web-build/index.html (MyKHSU-web SPA)
GET  /admin-panel/*  → admin-panel/build/index.html (Admin SPA)
GET  /api/*          → Публичный API
POST /adminapi/*     → Административный API
GET  /static/*       → legacy статика (из STATIC_PATH)
```

---

## Разработка Admin Panel

```bash
cd admin-panel
npm install
npm start   # http://localhost:3000 (прокси на localhost:8080)
```

При разработке CRA проксирует `/adminapi/*` и `/api/*` на бэкенд (настройка `proxy` в `admin-panel/package.json`).
