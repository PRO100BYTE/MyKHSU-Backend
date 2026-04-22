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
npm run build:admin        # Собрать Admin Panel
npm run build:web          # Собрать MyKHSU-web (опционально)
npm start
```

## Продакшн (systemd / Linux)

Создайте файл `/etc/systemd/system/mykhsu.service`:

```ini
[Unit]
Description=MyKHSU Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/mykhsu-backend
EnvironmentFile=/opt/mykhsu-backend/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/mykhsu-backend/data /opt/mykhsu-backend/settings.json

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable mykhsu
sudo systemctl start mykhsu
sudo journalctl -u mykhsu -f
```

## Nginx (reverse proxy)

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
|---|---|---|---|
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
