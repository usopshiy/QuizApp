# QuizPlatform

Интерактивная платформа для проведения викторин в реальном времени. Организаторы создают квизы и управляют сессиями, участники подключаются по коду и отвечают на вопросы.

---

## Технологический стек

| Слой | Технологии |
|---|---|
| Фронтенд | Angular 17, PrimeNG 17, Socket.io client |
| Бэкенд | Node.js, Express, Socket.io |
| База данных | PostgreSQL 16 |
| Хранилище файлов | MinIO |
| Инфраструктура | Docker, Docker Compose |

---

## Требования

- [Docker](https://docs.docker.com/get-docker/) версии 24 и выше
- [Docker Compose](https://docs.docker.com/compose/install/) версии 2.20 и выше

---

## Структура проекта

```
quiz-platform/
├── docker-compose.yml
├── .env.example
├── .env                        ← создаётся вручную из .env.example
├── database/
│   └── migrations/
│       ├── 001_init.sql        ← основная схема БД
│       └── 002_participant_user_link.sql
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── src/
└── frontend/
    ├── Dockerfile
    ├── .dockerignore
    ├── nginx.conf
    ├── package.json
    └── src/
```

---

## Первый запуск

### 1. Клонировать репозиторий

```bash
git clone <url-репозитория>
cd quiz-platform
```

### 2. Создать файл переменных окружения

```bash
cp .env.example .env
```

При необходимости отредактируйте `.env`. Значения по умолчанию подходят для локальной разработки:

```env
POSTGRES_USER=quiz_user
POSTGRES_PASSWORD=quiz_password
POSTGRES_DB=quiz_db

MINIO_ROOT_USER=minio_admin
MINIO_ROOT_PASSWORD=minio_password
MINIO_BUCKET=quiz-images
MINIO_PUBLIC_URL=http://localhost:9000

JWT_SECRET=замените_на_длинную_случайную_строку
JWT_EXPIRES_IN=7d
```

> ⚠️ Перед публичным деплоем обязательно измените все пароли и `JWT_SECRET`.

### 3. Собрать и запустить все сервисы

```bash
docker compose up --build
```

### 4. Проверить, что всё запустилось

В выводе `docker compose` должны появиться строки вида:

```
quiz_postgres   — healthy
quiz_minio      — healthy
quiz_backend    — running
quiz_frontend   — running
```

---

## Доступные адреса

| Сервис | Адрес |
|---|---|
| Приложение (Angular) | http://localhost:4200 |
| API бэкенда | http://localhost:3000/api/health |
| Консоль MinIO | http://localhost:9001 |
| PostgreSQL | localhost:5432 |

---

## Применение миграций базы данных

Миграция `001_init.sql` применяется **автоматически** при первом запуске контейнера PostgreSQL.

Миграция `002_participant_user_link.sql` применяется вручную. Есть два способа:

**Способ А — чистый старт (удаляет все данные):**

```bash
docker compose down -v
docker compose up --build
```

**Способ Б — применить поверх существующих данных:**

```bash
docker compose up -d postgres
# подождать несколько секунд
docker compose exec postgres psql -U quiz_user -d quiz_db \
  -f /docker-entrypoint-initdb.d/002_participant_user_link.sql
```

---

## Полезные команды

```bash
# Запустить в фоновом режиме
docker compose up -d

# Просмотр логов конкретного сервиса
docker compose logs -f backend
docker compose logs -f frontend

# Пересобрать только бэкенд после изменений кода
docker compose up --build backend

# Пересобрать только фронтенд
docker compose up --build frontend

# Открыть оболочку внутри контейнера бэкенда
docker compose exec backend sh

# Подключиться к PostgreSQL напрямую
docker compose exec postgres psql -U quiz_user -d quiz_db

# Остановить все сервисы (данные сохраняются)
docker compose down

# Остановить и удалить все данные (полный сброс)
docker compose down -v
```

---

## Проверка работоспособности API

```bash
# Health check
curl http://localhost:3000/api/health

# Регистрация пользователя
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","displayName":"Тестовый пользователь","password":"password123"}'
```
