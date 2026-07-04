# Деплой

## Вариант 1: VPS + Docker (рекомендуемый)

```bash
git clone <repo> && cd <repo>
cp .env.example .env
# Прописать:
#   MONGODB_URI  — MongoDB Atlas или отдельный сервер (НЕ на app-ноде)
#   AUTH_SECRET  — openssl rand -base64 32
#   REDIS_URL    — redis://redis:6379 (compose поднимет рядом)
docker compose up -d --build
curl http://localhost:3000/api/health   # ожидаем "status":"ok"
```

Compose поднимает app + Redis (AOF-персистентность, порт наружу не
публикуется). Mongo — всегда внешний, чтобы данные жили отдельно от
app-нод.

### Reverse proxy (обязательно для продакшена)

`nginx.example.conf` — готовый upstream. Критично: **nginx должен
перезаписывать `X-Forwarded-For`**, иначе клиент подделает IP и обойдёт
IP-rate-limit:

```nginx
proxy_set_header X-Forwarded-For $remote_addr;
```

TLS — через certbot/caddy перед nginx или вместо него.

## Вариант 2: Vercel + Upstash (serverless)

1. MongoDB Atlas + Upstash Redis (REST).
2. В переменных окружения Vercel: `MONGODB_URI`, `AUTH_SECRET`,
   `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
   (вместо `REDIS_URL` — клиент выбирается автоматически, см. `lib/redis.ts`).
3. Deploy. `output: "standalone"` в `next.config.ts` Vercel игнорирует —
   ничего менять не нужно.

## Масштабирование на несколько серверов

API stateless, sticky sessions не нужны.

1. Вынеси Redis с app-ноды (отдельный хост или Upstash), поменяй `REDIS_URL`.
2. Новый VPS: тот же image + **тот же `.env`** (одинаковый `AUTH_SECRET`!).
3. Добавь сервер в upstream балансировщика.

`GET /api/health` возвращает 503 при падении Mongo — LB сам выведет ноду
из ротации. `degraded` (Redis down) — нода живая, но без кэша и rate limit.

## Чек после деплоя

- [ ] `/api/health` → `"status":"ok"`
- [ ] Регистрация + вход работают, cookie `Secure` (NODE_ENV=production)
- [ ] Партия: старт → проигрыш → рекорд сохранён → рейтинг обновился
- [ ] Повторный сабмит отклоняется (лог `anti-cheat` в stderr)
- [ ] В логах нет `rate-limit ... Redis unavailable`
