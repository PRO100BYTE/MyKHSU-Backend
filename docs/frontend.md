# Фронтенд — MyKHSU Backend

Бэкенд использует **единый frontend-бандл** в `web-build/`, который включает:

1. **MyKHSU-web** — основной пользовательский интерфейс (React SPA)
2. **admin-panel** — панель администратора (React SPA)

---

## MyKHSU-web

Репозиторий: [PRO100BYTE/MyKHSU-web](https://github.com/PRO100BYTE/MyKHSU-web)

### Подключение

```bash
# Автоматическая сборка объединенного фронтенда
npm run build:web

# Или вручную с указанием пути
node scripts/build-frontend.js /path/to/MyKHSU-web
```

После сборки:

- MyKHSU-web копируется в `web-build/`
- Admin Panel копируется в `web-build/admin-panel/`

Обе SPA раздаются одним Express-сервером из общей директории `web-build/`.

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

Собранные файлы админки сначала создаются в `admin-panel/build/`, затем автоматически копируются в `web-build/admin-panel/`.

В production используется путь `/admin-panel/` из общего frontend bundle.

### Доступные экраны

| Маршрут | Экран | Описание |
| --- | --- | --- |
| `/admin-panel/` | — | Редирект на /dashboard |
| `/admin-panel/login` | LoginScreen | Вход по логину и паролю |
| `/admin-panel/dashboard` | DashboardScreen | Метрики: недели, курсы, дата обновления |
| `/admin-panel/schedule` | ScheduleScreen | Загрузка / очистка расписания |
| `/admin-panel/times` | TimesScreen | Редактор расписания звонков |
| `/admin-panel/news` | NewsScreen | Управление новостями |
| `/admin-panel/users` | UsersScreen | Пользователи админки (CRUD + disable/enable) |
| `/admin-panel/appearance` | AppearanceScreen | Настройки темы и акцентного цвета в стиле MyKHSU |

### Версия/билд в интерфейсе

Версия, билд и дата билда берутся из `GET /api/meta`.  
Резервные значения вынесены в `admin-panel/src/constants.js`.

### Темы

Admin Panel теперь синхронизирована с визуальной системой мобильного MyKHSU и поддерживает темы:

- `dark`
- `light`
- `matrix`
- `legend`

Текущая тема сохраняется в `localStorage` (ключ `admin_theme`), акцентный цвет — в `admin_accent`.

Дополнительно на экране `/admin-panel/appearance` доступны:

- переключение подписей пунктов сайдбара (`admin_nav_labels`)
- режим плотности интерфейса: `comfortable` / `compact` (`admin_ui_density`)

### Акцентные цвета

Доступны акценты, соответствующие мобильному приложению:

- `green`
- `blue`
- `purple`
- `orange`
- `matrix`
- `legend`

Токены вынесены в `admin-panel/src/constants.js`.

### Дизайн

Стилистика синхронизирована с React Native приложением MyKHSU:

- токены `LIQUID_GLASS` и палитра акцентов перенесены в desktop-админку
- используется фирменная бренд-марка из девяти плиток вместо условной буквы-логотипа
- фон построен на тех же радиальных свечениях green/purple/blue, что и mobile-макеты
- навигация и элементы управления оформлены как pill/glass-сегменты
- темы `matrix` и `legend` повторяют специальные режимы мобильного приложения
- build/version-метаданные выводятся в интерфейс через `GET /api/meta`
- добавлен отдельный экран внешнего вида (theme/accent preview), аналогичный mobile-подходу
- добавлены UX-настройки навигации и плотности интерфейса (desktop-аналог mobile Appearance Settings)

---

## Маршруты в Express

```text
GET  /               → web-build/index.html (MyKHSU-web SPA)
GET  /admin-panel/*  → web-build/admin-panel/index.html (Admin SPA)
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
