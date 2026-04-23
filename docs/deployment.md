# Развёртывание — MyKHSU Backend

## Требования

- Node.js 20+
- npm 9+
- 100 MB свободного места на диске (SQLite БД растёт со временем)

## Быстрый старт (локально)

```bash
git clone <repo-url> MyKHSU-Backend
cd MyKHSU-Backend
npm install
cp .env.example .env

# Обязательно: задайте JWT_SECRET в .env
# JWT_SECRET=your-very-long-random-string-at-least-64-characters

npm run seed               # Создать администраторов
npm run build              # Собрать всё вместе (admin + web)
npm start
```

## Продакшн (systemd / Ubuntu 24.04)

В репозитории уже подготовлены unit-файлы:

- `deploy/systemd/mykhsu-backend.service`
- `deploy/systemd/mykhsu-backend-restart.service`
- `deploy/systemd/mykhsu-backend-restart.timer`
- `deploy/systemd/mykhsu-backend-update-now.service`
- `deploy/systemd/mykhsu-backend-update.sh`
- `deploy/systemd/mykhsu-backend.env.example`

### 1) Подготовить системного пользователя и директории

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin mykhsu || true
sudo mkdir -p /opt/mykhsu
sudo chown -R mykhsu:mykhsu /opt/mykhsu
```

### 2) Разместить приложение

```bash
sudo -u mykhsu git clone <repo-url> /opt/mykhsu/MyKHSU-Backend
cd /opt/mykhsu/MyKHSU-Backend
sudo -u mykhsu git submodule update --init --recursive
sudo -u mykhsu npm ci --omit=dev
sudo -u mykhsu npm run build
```

Сборочный скрипт `scripts/build-frontend.js` привязан к каталогу самого репозитория и не зависит от текущего `cwd` процесса, поэтому команда `sudo -u mykhsu npm run build` корректно работает и при запуске из systemd/Ubuntu-среды.

### 3) Настроить env-файл службы

```bash
sudo mkdir -p /etc/mykhsu
sudo cp /opt/mykhsu/MyKHSU-Backend/deploy/systemd/mykhsu-backend.env.example /etc/mykhsu/mykhsu-backend.env
sudo chmod 600 /etc/mykhsu/mykhsu-backend.env
sudo chown root:root /etc/mykhsu/mykhsu-backend.env
```

Отредактируйте `/etc/mykhsu/mykhsu-backend.env` и обязательно задайте `JWT_SECRET`.

Для автообновления при каждом старте/рестарте оставьте:

```dotenv
MYKHSU_GIT_AUTOUPDATE=1
MYKHSU_GIT_BRANCH=main
MYKHSU_APP_DIR=/opt/mykhsu/MyKHSU-Backend
```

### 4) Установить unit-файлы

```bash
sudo cp /opt/mykhsu/MyKHSU-Backend/deploy/systemd/mykhsu-backend.service /etc/systemd/system/
sudo cp /opt/mykhsu/MyKHSU-Backend/deploy/systemd/mykhsu-backend-restart.service /etc/systemd/system/
sudo cp /opt/mykhsu/MyKHSU-Backend/deploy/systemd/mykhsu-backend-restart.timer /etc/systemd/system/
sudo cp /opt/mykhsu/MyKHSU-Backend/deploy/systemd/mykhsu-backend-update-now.service /etc/systemd/system/
sudo chmod +x /opt/mykhsu/MyKHSU-Backend/deploy/systemd/mykhsu-backend-update.sh
```

### 5) Запустить службу

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mykhsu-backend.service
sudo systemctl status mykhsu-backend.service
sudo journalctl -u mykhsu-backend.service -f
```

### 6) Включить плановый рестарт с автообновлением (опционально)

Таймер по умолчанию перезапускает сервис ежедневно в `04:30`, и перед стартом срабатывает `ExecStartPre`-скрипт, который делает `git pull --ff-only`, `npm ci --omit=dev` и `npm run build`.

```bash
sudo systemctl enable --now mykhsu-backend-restart.timer
sudo systemctl list-timers | grep mykhsu
```

### Ручное обновление через systemd

```bash
sudo systemctl restart mykhsu-backend.service
```

Принудительное обновление «прямо сейчас» (даже если SHA не изменился), затем перезапуск сервиса:

```bash
sudo systemctl start mykhsu-backend-update-now.service
```

Если в рабочем каталоге есть локальные незакоммиченные изменения, auto-update будет пропущен (защита от потери локальных правок).

## Nginx (reverse proxy)

На одном порту `8080` сервер отдаёт сразу:

- `/api/*` и `/adminapi/*` (API)
- `/admin-panel/*` (React Admin Panel)
- `/` (MyKHSU-web)

```nginx
server {
    listen 80;
    server_name t2iti.khsu.ru;

    # Перенаправление HTTP → HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name t2iti.khsu.ru;

    ssl_certificate     /etc/letsencrypt/live/t2iti.khsu.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/t2iti.khsu.ru/privkey.pem;

    # Проксирование на Node.js
    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 30s;
    }

    # Ограничение размера файлов для загрузки расписания
    client_max_body_size 50M;
}
```

## Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY scripts/ ./scripts/
COPY admin-panel/build/ ./admin-panel/build/
COPY web-build/ ./web-build/

RUN mkdir -p data

EXPOSE 8080

CMD ["node", "src/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  mykhsu:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
      - ./settings.json:/app/settings.json
    environment:
      - PORT=8080
      - JWT_SECRET=${JWT_SECRET}
      - PAIRS_DB_PATH=/app/data/pairs.sqlite
      - USERS_DB_PATH=/app/data/users.sqlite
    restart: unless-stopped
```

## Обновление с Go-версии (raspisanie)

Если вы мигрируете с оригинального Go-бэкенда:

1. Скопируйте `pairs.sqlite` и `users.sqlite` из оригинальной установки в папку `data/`
2. Скопируйте `settings.json` в корень проекта
3. **ВАЖНО:** Формат хэшей паролей отличается.  
   В Go-версии: `hex(argon2.IDKey(password, username, ...))`  
   В Node-версии: стандартный Argon2id PHC-формат от npm `argon2`  
   Все администраторы должны переустановить пароли: `npm run seed`

## Переменные окружения (полный список)

| Переменная | Обязательна | По умолчанию | Описание |
| --- | --- | --- | --- |
| `JWT_SECRET` | **ДА** | — | Секрет JWT, минимум 32 символа |
| `PORT` | нет | `8080` | TCP-порт |
| `HOST` | нет | `0.0.0.0` | Адрес прослушивания |
| `PAIRS_DB_PATH` | нет | `./data/pairs.sqlite` | Путь к БД расписания |
| `USERS_DB_PATH` | нет | `./data/users.sqlite` | Путь к БД администраторов |
| `STATIC_PATH` | нет | `./static` | Legacy статика |
| `DEBUG` | нет | `false` | Отладочный вывод |
| `WEB_SOURCE_PATH` | нет | (автопоиск) | Путь к MyKHSU-web |
| `SEED_ADMIN_PASSWORD` | нет | (интерактивно) | Пароль admin при seed |
| `SEED_THEDAYG0NE_PASSWORD` | нет | (интерактивно) | Пароль TheDayG0ne при seed |
