# Схема базы данных — MyKHSU Backend

## pairs.sqlite

Основная база данных расписания.

### Таблица `pairs`

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | Уникальный идентификатор |
| `week_number` | INTEGER | Номер учебной недели |
| `weekday` | INTEGER | День недели (1=Пн … 7=Вс) |
| `course` | INTEGER | Курс (-1 для магистратуры) |
| `group_name` | TEXT | Название группы |
| `date` | TEXT | Дата занятия (`YYYY-MM-DD`) |
| `time` | INTEGER | Номер пары (FK → times.id) |
| `type` | TEXT | Тип занятия (Лекция, Практика, ...) |
| `subject` | TEXT | Название дисциплины |
| `teacher` | TEXT | ФИО преподавателя |
| `auditory` | TEXT | Номер аудитории |
| `date_start` | TEXT | Начало недели (`YYYY-MM-DD`) |
| `date_end` | TEXT | Конец недели (`YYYY-MM-DD`) |

**Индексы:** `week_number`, `date`, `date_start`, `date_end`, `course`, `group_name`, `teacher`, `auditory`, `subject`

---

### Таблица `times`

Расписание звонков.

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | Уникальный идентификатор |
| `time` | INTEGER | Номер пары |
| `time_start` | TEXT | Время начала (`ЧЧ:MM`) |
| `time_end` | TEXT | Время конца (`ЧЧ:MM`) |

---

### Таблица `news`

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | Уникальный идентификатор |
| `content` | TEXT NOT NULL | Текст новости |
| `date` | TEXT NOT NULL | Дата создания (`YYYY-MM-DD HH:MM:SS`) |
| `last_change` | TEXT | Дата последнего редактирования (NULL если не правилась) |

---

### Таблица `course_catalog`

Ручной каталог курсов (для админского ручного ввода расписания).

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | Уникальный идентификатор |
| `course` | INTEGER NOT NULL UNIQUE | Номер курса |
| `created_at` | TEXT | Дата создания записи |

---

### Таблица `group_catalog`

Ручной каталог групп.

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | Уникальный идентификатор |
| `course` | INTEGER NOT NULL | Номер курса |
| `group_name` | TEXT NOT NULL | Название группы |
| `created_at` | TEXT | Дата создания записи |

Ограничение уникальности: `(course, group_name)`.

Индексы: `group_catalog(course)`, `group_catalog(group_name)`.

При старте сервера выполняется синхронизация каталогов:

- в `course_catalog` добавляются отсутствующие значения `course` из `pairs`;
- в `group_catalog` добавляются отсутствующие пары `(course, group_name)` из `pairs`.

---

### Таблица `unified_window_tickets`

Обращения модуля «Единое окно».

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | Идентификатор обращения |
| `subject` | TEXT NOT NULL | Тема обращения (fallback для старых записей) |
| `contact_email` | TEXT | Email обращения (fallback для старых записей) |
| `contact_name` | TEXT | Имя обращения (fallback для старых записей) |
| `encrypted_subject_iv/tag/data` | TEXT | Зашифрованная тема обращения (AES-256-GCM) |
| `encrypted_contact_email_iv/tag/data` | TEXT | Зашифрованный email обращения (AES-256-GCM) |
| `encrypted_contact_name_iv/tag/data` | TEXT | Зашифрованное имя обращения (AES-256-GCM) |
| `contact_email_hash` | TEXT | SHA-256 email для поиска истории по email |
| `status` | TEXT NOT NULL DEFAULT `open` | Статус (`open`, `in_progress`, `resolved`, `closed`) |
| `priority` | TEXT NOT NULL DEFAULT `normal` | Приоритет (`low`, `normal`, `high`, `urgent`) |
| `access_token` | TEXT UNIQUE | Токен пользователя для доступа к обращению |
| `due_at` | TEXT | SLA-дедлайн |
| `first_response_at` | TEXT | Время первого ответа агента |
| `resolved_at` | TEXT | Время решения |
| `created_at` | TEXT NOT NULL | Дата создания |
| `updated_at` | TEXT NOT NULL | Дата последнего изменения |

Индексы: `status`, `priority`, `access_token`, `contact_email_hash`.

Для старых БД колонка `contact_email_hash` и индекс на ней добавляются миграцией при старте сервера.

---

### Таблица `unified_window_messages`

Сообщения в переписке обращения.

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | Идентификатор сообщения |
| `ticket_id` | INTEGER FK | Ссылка на `unified_window_tickets.id` |
| `author_role` | TEXT | `user` или `agent` |
| `author_name` | TEXT | Имя автора сообщения |
| `encrypted_text_iv/tag/data` | TEXT | Зашифрованный текст сообщения (AES-256-GCM) |
| `created_at` | TEXT NOT NULL | Дата создания |

---

### Таблица `unified_window_files`

Вложения к обращениям.

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | Идентификатор файла |
| `ticket_id` | INTEGER FK | Ссылка на `unified_window_tickets.id` |
| `message_id` | INTEGER FK NULL | Ссылка на сообщение (если файл привязан к сообщению) |
| `original_name` | TEXT | Исходное имя файла |
| `mime_type` | TEXT | MIME-тип |
| `size_bytes` | INTEGER | Размер файла |
| `encrypted_blob_iv/tag/data` | TEXT | Зашифрованный бинарный контент (AES-256-GCM) |
| `created_at` | TEXT NOT NULL | Дата создания |

---

### Таблица `unified_window_status_history`

История смены статусов обращения.

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | Идентификатор записи |
| `ticket_id` | INTEGER FK | Ссылка на `unified_window_tickets.id` |
| `from_status` | TEXT | Предыдущий статус |
| `to_status` | TEXT | Новый статус |
| `changed_by` | TEXT | Кто изменил статус |
| `comment` | TEXT | Комментарий |
| `created_at` | TEXT NOT NULL | Дата изменения |

---

## users.sqlite

База данных администраторов.

### Таблица `users`

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | Уникальный идентификатор |
| `username` | TEXT NOT NULL UNIQUE | Логин (уникальный) |
| `password` | TEXT NOT NULL | Хэш пароля (Argon2id) |
| `is_active` | INTEGER NOT NULL DEFAULT 1 | Статус учётной записи (1=активен, 0=отключён) |
| `role` | TEXT NOT NULL DEFAULT `admin` | Роль пользователя админки |
| `first_name` | TEXT | Имя пользователя |
| `last_name` | TEXT | Фамилия пользователя |
| `position` | TEXT | Должность |
| `email` | TEXT | Email для уведомлений/восстановления |
| `created_at` | TEXT | Время создания пользователя |
| `updated_at` | TEXT | Время последнего изменения |

При старте сервера выполняется автоматическая миграция, если в старой таблице `users` нет новых колонок.

---

## Начальные данные

При первом запуске (`npm run seed`) создаются два администратора:

| Логин | Описание |
|---|---|
| `admin` | Основной администратор |
| `TheDayG0ne` | Администратор (разработчик) |

Пароли задаются интерактивно или через переменные окружения `SEED_ADMIN_PASSWORD` / `SEED_THEDAYG0NE_PASSWORD`.

---

## Служебные скрипты и БД

Скрипт `scripts/build-frontend.js` теперь собирает единый frontend bundle (`web-build/` + `web-build/admin-panel/`) и использует `mykhsu-web/` (git submodule) как основной источник MyKHSU-web.

Это изменение **не меняет схему БД** (`pairs.sqlite`, `users.sqlite`), но влияет на путь доступа к UI, через который выполняются административные операции с данными.

---

## Примеры запросов

### Получить количество пар

```sql
SELECT COUNT(*) FROM pairs;
```

### Получить все группы 2 курса

```sql
SELECT DISTINCT group_name FROM pairs WHERE course = 2 ORDER BY group_name;
```

### Получить расписание для ИТ-21 на неделе 15

```sql
SELECT p.*, t.time_start, t.time_end
FROM pairs p
LEFT JOIN times t ON p.time = t.id
WHERE p.group_name = 'ИТ-21' AND p.week_number = 15
ORDER BY p.weekday, p.time;
```

### Управление администраторами

```bash
# Создать нового
node scripts/create-admin.js newadmin securepassword

# Обновить пароль существующего (скрипт делает UPSERT)
node scripts/create-admin.js admin newpassword

# Создать начальных администраторов интерактивно
npm run seed

# Через переменные окружения (для CI/CD)
SEED_ADMIN_PASSWORD=secret1 SEED_THEDAYG0NE_PASSWORD=secret2 npm run seed

# Показать пользователей
npm run users:list

# Создать пользователя
npm run users:create -- newadmin securepassword true

# Редактировать пользователя по id
npm run users:edit -- 3 newlogin newpassword

# Отключить / включить
npm run users:disable -- 3
npm run users:enable -- 3

# Удалить
npm run users:delete -- 3
```
