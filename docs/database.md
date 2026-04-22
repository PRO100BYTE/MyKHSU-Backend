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

## users.sqlite

База данных администраторов.

### Таблица `users`

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | Уникальный идентификатор |
| `username` | TEXT NOT NULL UNIQUE | Логин (уникальный) |
| `password` | TEXT NOT NULL | Хэш пароля (Argon2id) |
| `is_active` | INTEGER NOT NULL DEFAULT 1 | Статус учётной записи (1=активен, 0=отключён) |
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

Скрипт `scripts/build-frontend.js` теперь собирает единый frontend bundle (`web-build/` + `web-build/admin-panel/`).

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
