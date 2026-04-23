# API Reference — MyKHSU Backend

Базовый URL: `http://localhost:8080`

---

## Публичный API (`/api/*`)

Все публичные эндпоинты доступны без авторизации.  
Все ответы — JSON. Заголовки: `Cache-Control: no-store`.

---

### GET `/api/meta`

Метаданные версии, билда и проекта.

**Ответ:**
```json
{
  "app_name": "MyKHSU Backend",
  "app_short_name": "MyKHSU",
  "api_version": "1.1.0",
  "app_version": "1.1.0",
  "build_number": "2026.04.22.1",
  "build_date": "2026-04-23T15:01:22+07:00",
  "build_date_human": "23.04.2026, 15:01:22",
  "git_commit_hash": "9e2798a",
  "build_timezone": "Asia/Krasnoyarsk",
  "build_timezone_label": "Asia/Krasnoyarsk (GMT+7)",
  "admin_panel_version": "1.1.0",
  "frontend_version": "1.1.0",
  "contacts": {
    "team": "ITI KHSU",
    "projectUrl": "https://github.com/PRO100BYTE/MyKHSU"
  }
}
```

---

### GET `/api/getpairs`

Получить список занятий на указанный день.

**Query-параметры:**

| Параметр | Тип | Обязателен | Описание |
|---|---|---|---|
| `type` | `group` \| `teacher` \| `auditory` | ✓ | Тип поиска |
| `group` или `data` | string | ✓ | Название группы / ФИО преподавателя / аудитории |
| `date` | string | ✓ | Дата в формате `dd.MM.yyyy` или `yyyy-MM-dd` |

**Ответ:** массив объектов занятия

Если для целевой даты в таблице `pairs` не заполнено поле `date` (например, расписание загружено понедельно), endpoint выполняет fallback-поиск по `weekday` и диапазону `date_start/date_end`, чтобы данные корректно выдавались и в режиме отображения «На день».

```json
[
  {
    "id": 42,
    "type_lesson": "Лекция",
    "subject": "Математика",
    "teacher": "Иванов И.И.",
    "auditory": "101",
    "time": 1,
    "time_start": "08:00",
    "time_end": "09:30",
    "group": ["ИТ-21"]
  }
]
```

**Legacy-формат:** `GET /api/getpairs/{type}:{group}:{date}`

---

### GET `/api/getpairsweek`

Расписание на неделю.

**Query-параметры:**

| Параметр | Тип | Обязателен | Описание |
|---|---|---|---|
| `type` | `group` \| `teacher` \| `auditory` | ✓ | Тип поиска |
| `data` | string | ✓ | Название группы / ФИО / аудитории |
| `week` | number | ✓ | Номер учебной недели |

**Ответ:**

```json
{
  "week_number": 15,
  "days": [
    {
      "weekday": 1,
      "lessons": [ { "id": 1, "type_lesson": "Лекция", ... } ]
    }
  ],
  "dates": { "date_start": "2025-04-07", "date_end": "2025-04-13" }
}
```

---

### GET `/api/getfullschedule`

Полное расписание по курсу за диапазон недель.

**Query-параметры:** `course` (number), `from` (число недели), `to` (число недели)

**Ответ:** массив `{ group_name, weeks: [{ week_number, days: [...] }] }`

---

### GET `/api/getgroups`

**Query-параметры:** `course` (number, необязателен)

Возвращает объединённый список групп из `pairs` и ручного каталога `group_catalog`.

**Ответ:** `["ИТ-21", "ИТ-22", ...]`

**Legacy:** `GET /api/getgroups/{course}`

---

### GET `/api/getcourses`

Возвращает объединённый список курсов из `pairs` и ручного каталога `course_catalog`.

**Ответ:** `[1, 2, 3, 4]`

---

### POST `/api/unified-window/tickets`

Создать обращение в модуле «Единое окно» (доступно без авторизации).

`contact_email` обязателен: этот email используется для последующего поиска обращений.

```json
// Request
{
  "role": "student",
  "contact_name": "Иван Иванов",
  "contact_email": "ivan@example.com",
  "subject": "Проблема с расписанием",
  "message": "Не открывается расписание группы ИТ-21"
}

// Response
{
  "ok": true,
  "id": 12,
  "access_token": "a1b2c3d4..."
}
```

`role`: `visitor` | `student` | `teacher`

Для совместимости также поддерживается поле `requester_role` с теми же значениями. Если переданы оба (`role` и `requester_role`), приоритет у `requester_role`.

При внутренних ошибках создания обращения диагностические детали пишутся в серверный лог `logs/server.log`.

Данные обращения хранятся в БД `users.sqlite` в таблицах `unified_window_tickets` / `unified_window_messages`. Сообщения и чувствительные поля обращения шифруются (AES-256-GCM).

---

### GET `/api/unified-window/tickets`

История обращений по email (из БД).

**Query-параметры:**

| Параметр | Тип | Обязателен | Описание |
|---|---|---|---|
| `contact_email` | string | ✓ | Email, указанный при создании обращения |

**Ответ:**

```json
[
  {
    "id": 12,
    "access_token": "a1b2c3d4...",
    "requester_role": "student",
    "subject": "Проблема с расписанием",
    "status": "open",
    "priority": "normal",
    "contact_name": "Иван Иванов",
    "contact_email": "ivan@example.com",
    "last_message_author_role": "agent",
    "last_message_at": "2026-04-22 11:20:00",
    "has_unread_for_user": true,
    "created_at": "2026-04-22 10:00:00",
    "updated_at": "2026-04-22 10:00:00"
  }
]
```

---

### GET `/api/unified-window/tickets/{token}`

Статус и метаданные обращения по `access_token`. Включает историю смены статусов.

**Ответ:**
```json
{
  "id": 15,
  "requester_role": "student",
  "subject": "Проблема с загрузкой расписания",
  "status": "in_progress",
  "priority": "normal",
  "contact_name": "Иван Иванов",
  "contact_email": "ivan@example.com",
  "created_at": "2026-04-22 12:00:00",
  "updated_at": "2026-04-22 14:30:00",
  "status_history": [
    {
      "from_status": "open",
      "to_status": "in_progress",
      "changed_by": "admin_user",
      "comment": "Начал детальное расследование",
      "created_at": "2026-04-22 12:15:00"
    },
    {
      "from_status": "in_progress",
      "to_status": "resolved",
      "changed_by": "admin_user",
      "comment": "Проблема решена",
      "created_at": "2026-04-22 14:30:00"
    }
  ]
}
```

---

### GET `/api/unified-window/tickets/{token}/messages`

История сообщений обращения по `access_token`.

---

### POST `/api/unified-window/tickets/{token}/reply`

Добавить сообщение пользователя в существующее обращение.

**Ограничение:** если статус обращения `'closed'`, то отправка сообщений запрещена (HTTP 400).

```json
// Request
{
  "message": "Есть обновление по проблеме",
  "contact_name": "Иван Иванов"
}

// Response
{ "ok": true, "id": 101 }

// Error (если обращение закрыто)
{ "error": "Ticket is closed" }
```

---

### POST `/api/unified-window/tickets/{token}/close`

Закрыть обращение пользователем с обязательным комментарием.

```json
// Request
{
  "comment": "Вопрос решен, закрываю обращение",
  "contact_name": "Иван Иванов"
}

// Response
{ "ok": true }
```

Если `comment` пустой, сервер возвращает `400` с ошибкой `comment is required`.

---

### DELETE `/api/unified-window/tickets/{token}`

Скрыть обращение пользователем из своей истории.

Ограничение: скрывать можно только обращения в статусах `closed` или `resolved`.

Важно: обращение не удаляется из БД и остается доступным в админке до явного удаления администратором.

```json
// Response
{ "ok": true }
```

---

### GET `/api/getdates`

**Query-параметры:** `week` (number)

**Ответ:** массив дат понедельника—воскресенья: `["2025-04-07", ..., "2025-04-13"]`

---

### GET `/api/getdatesextended/{week}`

**Ответ:** `{ "date_start": "2025-04-07", "date_end": "2025-04-13" }`

---

### GET `/api/lastweeknumber`

**Query-параметры:** `group` (string)

**Ответ:** `{ "last_week": 30 }`

---

### GET `/api/weeknumbers`

**Ответ:**
```json
{ "weeks": [1, 2, 3, ...], "current": 15 }
```

---

### GET `/api/lastupdate`

**Ответ:** `{ "last_update": "22.04.2026 10:12:04" }`

---

### GET `/api/getpairstime`

**Query-параметры:** `include_id` (`true` / `false`, по умолчанию `false`)

**Ответ:** массив записей о расписании звонков:
```json
[
  { "time": 1, "time_start": "08:00", "time_end": "09:30" }
]
```

---

### GET `/api/getmaincolumns`

**Ответ:**
```json
{
  "types": ["Лекция", "Практика", "Лабораторная"],
  "auditories": ["101", "202"],
  "subjects": ["Математика", "Физика"],
  "teachers": ["Иванов И.И."]
}
```

---

### GET `/api/search/{query}`

Поиск по группам, преподавателям и аудиториям.

**Ответ:**
```json
[
  { "value": "ИТ-21", "type": "group" },
  { "value": "Иванов И.И.", "type": "teacher" },
  { "value": "101", "type": "auditory" }
]
```

---

### GET `/api/news`

**Query-параметры:**

| Параметр | По умолчанию | Описание |
|---|---|---|
| `amount` | `20` | Количество новостей |
| `from` | `0` | Смещение (offset) |
| `include_id` | `false` | Включать поле `id` |

**Ответ:**
```json
[
  { "content": "Текст новости", "date": "2026-04-22 10:00:00", "last_change": null }
]
```

---

## Административный API (`/adminapi/*`)

Все эндпоинты кроме `/login` и `/checktoken` требуют JWT-токен.

**Авторизация:** заголовок `Authorization: Bearer <token>` или `Token: <token>`

---

### POST `/adminapi/login`

```json
// Request body
{ "username": "admin", "password": "password123" }

// Response 200
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }

// Response 400
{ "code": "ADM-AUTH-001", "error": "username and password are required" }

// Response 401
{ "code": "ADM-AUTH-002", "error": "Invalid credentials" }

// Response 403
{ "code": "ADM-AUTH-003", "error": "User is disabled" }

// Response 503
{ "error": "Admin users are not configured. Run: npm run seed or npm run users:create -- <username> <password> true" }
```

Токен действителен **24 часа**.

Коды ошибок авторизации:

| Код | HTTP | Где возникает | Значение |
|---|---|---|---|
| `ADM-AUTH-001` | 400 | `POST /adminapi/login` | Не передан логин или пароль |
| `ADM-AUTH-002` | 401 | `POST /adminapi/login` | Неверные учетные данные |
| `ADM-AUTH-003` | 403 | `POST /adminapi/login`, `POST /adminapi/checktoken`, любые защищенные маршруты | Учетная запись отключена |
| `ADM-AUTH-004` | 403 | Любой маршрут с проверкой прав | Недостаточно прав для выполнения действия |
| `ADM-AUTH-005` | 401 | Любой защищенный маршрут | JWT-токен не передан |
| `ADM-AUTH-006` | 403 | Любой защищенный маршрут | Токен имеет некорректные claims |
| `ADM-AUTH-007` | 401 | Любой защищенный маршрут | Пользователь из токена не найден |
| `ADM-AUTH-008` | 401 | Любой защищенный маршрут | Токен недействителен или истек |

---

### POST `/adminapi/checktoken`

Проверить токен.

**Response 200:** `{ "valid": true, "user": { "uid": 1, "username": "admin" }, "permissions": ["news:read", "news:write"] }`

Ошибки возвращаются в формате `{ "code": "ADM-AUTH-00X", "error": "..." }`.

---

### GET `/adminapi/dashboard/summary`

Ролевая сводка для дашборда. Возвращает разные блоки аналитики в зависимости от роли текущего пользователя.

```json
{
  "role": "manager",
  "roleSummary": {
    "kind": "manager",
    "schedule": {
      "filledWeeks": 18,
      "courses": 4,
      "groupsByCourse": [
        { "course": 1, "count": 6 },
        { "course": 2, "count": 8 }
      ],
      "lastScheduleUpdate": "23.04.2026 14:55:10",
      "filledToDate": "2026-06-30"
    },
    "news": {
      "total": 42,
      "publishedLast30Days": 9,
      "avgPerWeekLast8Weeks": 1.13,
      "lastPublishedAt": "2026-04-22 10:00:00"
    },
    "unifiedWindow": {
      "total": 27,
      "byStatus": { "open": 8, "in_progress": 6, "resolved": 4, "closed": 9 },
      "unanswered": 5,
      "unreadForAgent": 3
    },
    "freshness": {
      "scheduleLastUpdate": "23.04.2026 14:55:10",
      "scheduleFilledToDate": "2026-06-30",
      "newsLastPublishedAt": "2026-04-22 10:00:00",
      "unifiedWindowLastActivityAt": "2026-04-23 12:30:00"
    }
  },
  "system": {
    "timezone": "Asia/Krasnoyarsk (GMT+7)",
    "generatedAt": "2026-04-23 15:01:22",
    "generatedAtHuman": "23.04.2026, 15:01:22",
    "runtime": {
      "nodeVersion": "v20.19.0",
      "platform": "darwin",
      "arch": "arm64",
      "pid": 12345,
      "uptimeSeconds": 378,
      "memoryMb": {
        "rss": 93.48,
        "heapUsed": 24.16,
        "heapTotal": 38.51
      }
    },
    "entities": {
      "pairs": 5821,
      "times": 11,
      "news": 42,
      "users": 7,
      "unifiedWindowTickets": 27,
      "unifiedWindowMessages": 146,
      "unifiedWindowFiles": 4,
      "unifiedWindowStatusHistory": 35
    }
  },
  "generatedAt": "2026-04-23 15:01:22"
}
```

---

### GET `/adminapi/profile`

Профиль текущего администратора.

```json
{
  "id": 1,
  "username": "admin",
  "first_name": "Иван",
  "middle_name": "Иванович",
  "last_name": "Иванов",
  "position": "Методист",
  "email": "admin@khsu.ru",
  "is_active": true,
  "created_at": "2026-04-22 10:00:00",
  "updated_at": "2026-04-22 10:00:00"
}
```

---

### PATCH `/adminapi/profile`

Редактирование профиля текущего пользователя.

```json
// Request
{
  "username": "admin",
  "first_name": "Иван",
  "middle_name": "Иванович",
  "last_name": "Иванов",
  "position": "Заведующий отделением",
  "email": "admin@khsu.ru",
  "current_password": "old-password",
  "new_password": "new-strong-password"
}

// Response
{ "ok": true }
```

`current_password` обязателен только при смене пароля.

---

### GET `/adminapi/users`

Список пользователей админ-панели.

**Response 200:**
```json
[
  {
    "id": 1,
    "username": "admin",
    "is_active": true,
    "role": "admin",
    "first_name": "Иван",
    "middle_name": "Иванович",
    "last_name": "Иванов",
    "position": "Методист",
    "email": "admin@khsu.ru",
    "created_at": "2026-04-22 10:00:00",
    "updated_at": "2026-04-22 10:00:00"
  }
]
```

---

### POST `/adminapi/users`

Создать пользователя админки.

```json
// Request
{
  "username": "newadmin",
  "password": "very-strong-password",
  "is_active": true,
  "role": "manager",
  "first_name": "Иван",
  "middle_name": "Иванович",
  "last_name": "Иванов",
  "position": "Методист",
  "email": "ivan@khsu.ru"
}

// Response
{ "ok": true, "id": 5 }
```

---

### PATCH `/adminapi/users/{id}`

Редактирование пользователя (логин, пароль, активность).

```json
// Request
{
  "username": "admin2",
  "password": "new-password",
  "is_active": true,
  "role": "news_editor",
  "first_name": "Петр",
  "middle_name": "Петрович",
  "last_name": "Петров",
  "position": "Редактор",
  "email": "petrov@khsu.ru"
}

// Response
{ "ok": true }
```

---

### POST `/adminapi/users/{id}/disable`

Отключить пользователя.

**Response:** `{ "ok": true }`

---

### POST `/adminapi/users/{id}/enable`

Включить пользователя.

**Response:** `{ "ok": true }`

---

### DELETE `/adminapi/users/{id}`

Удалить пользователя.

**Response:** `{ "ok": true }`

---

### GET `/adminapi/catalog/courses`

Список курсов ручного каталога.

**Response:**
```json
[
  { "id": 1, "course": 1, "created_at": "2026-04-22 10:00:00" }
]
```

---

### POST `/adminapi/catalog/courses`

```json
// Request
{ "course": 2 }

// Response
{ "ok": true, "inserted": true }
```

---

### DELETE `/adminapi/catalog/courses/{course}`

Удалить курс из ручного каталога. Одновременно удаляются все группы этого курса из `group_catalog`.

**Response:** `{ "ok": true }`

---

### GET `/adminapi/catalog/groups`

**Query-параметры:** `course` (number, необязателен)

**Response:**
```json
[
  { "id": 1, "course": 2, "group_name": "ИТ-21", "created_at": "2026-04-22 10:00:00" }
]
```

---

### POST `/adminapi/catalog/groups`

```json
// Request
{ "course": 2, "group_name": "ИТ-21" }

// Response
{ "ok": true, "inserted": true }
```

---

### PATCH `/adminapi/catalog/groups/{id}`

Обновить группу каталога (переименование и/или перенос в другой курс).

```json
// Request
{ "course": 2, "group_name": "ИТ-22" }

// Response
{ "ok": true }
```

---

### DELETE `/adminapi/catalog/groups/{id}`

Удалить группу из каталога.

**Response:** `{ "ok": true }`

---

### DELETE `/adminapi/deletetable`

Удалить все записи из таблицы `pairs`.

**Response:** `{ "ok": true }`

---

### POST `/adminapi/createtable`

Загрузить расписание из JSON-файла (полная замена — таблица очищается перед загрузкой).

**Body:** `multipart/form-data`, поле `file` — JSON-файл в формате ХГУ.

**Response:** `{ "ok": true, "inserted": 1234 }`

---

### POST `/adminapi/updatetable`

Дополнить расписание из JSON-файла (без удаления существующих данных).

**Body:** аналогично `createtable`.

---

### POST `/adminapi/updatepairs`

Ручное редактирование занятий.

```json
{
  "group": "ИТ-21",
  "course": 2,
  "date": "22.04.2026",
  "week_number": 15,
  "weekday": 3,
  "lessons": [
    {
      "id": "42",
      "type": "Лекция",
      "subject": "Математика",
      "teacher": "Иванов И.И.",
      "auditory": "101",
      "method": "update"
    },
    {
      "type": "Практика",
      "subject": "Физика",
      "teacher": "Петров П.П.",
      "auditory": "202",
      "method": "create"
    },
    { "id": "55", "method": "delete" }
  ]
}
```

Поле `method`: `create` | `update` | `delete` | `pass`.

---

### GET `/adminapi/pairs`

Получить существующие пары для редактирования (в табличном виде).

**Query-параметры:**

| Параметр | Тип | Обязателен | Описание |
|---|---|---|---|
| `group` | string | — | Название группы для фильтра |
| `course` | number | — | Номер курса для фильтра |
| `week_number` | number | — | Номер недели для фильтра |

**Ответ:** массив пар с временем начала/окончания

```json
[
  {
    "id": 42,
    "weekday": 3,
    "course": 2,
    "group_name": "ИТ-21",
    "date": "2026-04-22",
    "week_number": 15,
    "time": 1,
    "type": "Лекция",
    "subject": "Математика",
    "teacher": "Иванов И.И.",
    "auditory": "101",
    "time_start": "08:00",
    "time_end": "09:30"
  }
]
```

---

### PUT `/adminapi/pairs/:id`

Обновить существующую пару.

**Параметры пути:** `id` (number)

**Body:**
```json
{
  "weekday": 3,
  "course": 2,
  "group_name": "ИТ-21",
  "date": "2026-04-22",
  "week_number": 15,
  "time": 1,
  "type": "Лекция",
  "subject": "Математика",
  "teacher": "Иванов И.И.",
  "auditory": "101"
}
```

**Response:** `{ "ok": true }`

---

### DELETE `/adminapi/pairs/:id`

Удалить пару.

**Параметры пути:** `id` (number)

**Response:** `{ "ok": true }`

---

Дополнительно:

- `weekday` можно передавать числом (`1..7`) или названием дня (`Понедельник`, `Вторник`, ...).
- `time` можно передавать id из таблицы `times` или строкой интервала (`08:00-09:30`).
- Если передан новый интервал времени, сервер автоматически создаёт запись в `times`.
- При ручной вставке параллельно синхронизируется каталог `course_catalog`/`group_catalog`.

---

### POST `/adminapi/updatetimes`

CRUD для расписания звонков. Body — массив:

```json
[
  { "time": 1, "time_start": "08:00", "time_end": "09:30", "method": "create" },
  { "id": 2, "time": 2, "time_start": "09:40", "time_end": "11:10", "method": "update" },
  { "id": 3, "method": "delete" }
]
```

---

### GET `/adminapi/unified-window/tickets`

Получить обращения «Единого окна».

**Query-параметры:** `status`, `role`, `limit` (по умолчанию `100`, максимум `500`)

Каждый элемент списка включает:

- `id`, `subject`, `status`, `priority`, `requester_role`, `contact_name`, `contact_email`
- `last_message_author_role` (`user` или `agent`)
- `last_message_at`
- `has_unread_for_agent` (есть непрочитанный ответ пользователя для агента)

---

### GET `/adminapi/unified-window/tickets/{id}`

Получить детали одного обращения, включая переписку, историю статусов и список вложений.

При открытии обращения автоматически обновляется маркер чтения агента (`agent_last_read_at`).

---

### POST `/adminapi/unified-window/tickets/{id}/messages`

Добавить сообщение от агента в переписку обращения.

```json
// Request
{
  "text": "Здравствуйте, приняли обращение в работу"
}

// Response
{ "ok": true, "id": 101 }
```

Поле `author_name` в сообщении записывается в формате `Фамилия И.О.` (если доступны данные профиля агента).

---

### PATCH `/adminapi/unified-window/tickets/{id}/status`

Обновление статуса и комментариев обращения.

Если агент меняет статус из `resolved`/`closed` в `open`/`in_progress`, обращение автоматически снова становится видимым пользователю (сбрасывается флаг скрытия `user_hidden_at`).

```json
// Request
{
  "status": "in_progress",
  "comment": "Взято в работу"
}

// Response
{ "ok": true }
```

`status`: `open` | `in_progress` | `resolved` | `closed`

---

### DELETE `/adminapi/unified-window/tickets/{id}`

Полностью удалить обращение (агент/администратор).

```json
// Response
{ "ok": true }
```

---

### POST `/adminapi/createnews`

```json
// Request
{ "content": "Текст новости" }
// Response
{ "ok": true, "id": 5 }
```

---

### POST `/adminapi/editnews?id=N`

```json
// Request
{ "content": "Обновлённый текст" }
// Response
{ "ok": true }
```

---

### DELETE `/adminapi/deletenews?id=N`

**Response:** `{ "ok": true }`

---

## Формат JSON расписания (импорт)

Ожидаемая структура файла для загрузки через `/adminapi/createtable`:

```json
{
  "Timetable": [
    {
      "WeekNumber": 15,
      "DateStart": "2025-04-07",
      "DateEnd": "2025-04-13",
      "Groups": [
        {
          "Course": 2,
          "GroupName": "ИТ-21",
          "Faculty": "ИТИ",
          "Days": [
            {
              "Weekday": 1,
              "WeekNumber": 15,
              "Lessons": [
                {
                  "Time": 1,
                  "Type": "Лекция",
                  "Subject": "Математика",
                  "Teachers": [{ "TeacherName": "Иванов И.И." }],
                  "Auditories": [{ "AuditoryName": "101" }],
                  "Date": "2025-04-07",
                  "Subgroup": 0,
                  "Week": 15
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Поддерживаются как `PascalCase`, так и `snake_case` ключи.

---

## Коды ошибок

| Код | Значение |
|---|---|
| 400 | Неверные входные данные (см. поле `error`) |
| 401 | Токен не предоставлен или недействителен |
| 403 | Токен валиден, но недостаточно прав |
| 404 | Ресурс не найден |
| 500 | Внутренняя ошибка сервера |
