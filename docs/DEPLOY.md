# Deployment

## Option 1: VPS + Docker (recommended)

```bash
git clone <repo> && cd <repo>
cp .env.example .env
# Set:
#   MONGODB_URI  — MongoDB Atlas or a separate server (NOT on the app node)
#   AUTH_SECRET  — openssl rand -base64 32
#   REDIS_URL    — redis://redis:6379 (compose starts Redis alongside the app)
docker compose up -d --build
curl http://localhost:3000/api/health   # expect "status":"ok"
```

Compose runs the app + Redis (AOF persistence, port not exposed publicly). Mongo is always external so data outlives app nodes.

### Reverse proxy (required for production)

`nginx.example.conf` is a ready upstream config. Critical: **nginx must overwrite `X-Forwarded-For`**, otherwise clients can spoof IP and bypass IP rate limits:

```nginx
proxy_set_header X-Forwarded-For $remote_addr;
```

TLS via certbot/Caddy in front of nginx or instead of it.

## Option 2: Vercel + Upstash (serverless)

1. MongoDB Atlas + Upstash Redis (REST).
2. Vercel environment variables: `MONGODB_URI`, `AUTH_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (instead of `REDIS_URL` — client is chosen automatically, see `lib/redis.ts`).
3. Deploy. `output: "standalone"` in `next.config.ts` is ignored by Vercel — no change needed.

Also set `APP_URL=https://your-domain.com` for correct email links and Open Graph URLs.

## Scaling to multiple servers

The API is stateless; sticky sessions are not required.

1. Move Redis off app nodes (separate host or Upstash) and update `REDIS_URL`.
2. New VPS: same image + **same `.env`** (identical `AUTH_SECRET`!).
3. Add the server to the load balancer upstream.

`GET /api/health` returns 503 when Mongo is down — the LB removes the node. `degraded` (Redis down) means the node is alive but without cache and rate limiting.

## Post-deploy checklist

- [ ] `/api/health` → `"status":"ok"`
- [ ] Registration + login work; cookie is `Secure` (NODE_ENV=production)
- [ ] Forgot password email → `/reset-password` completes reset
- [ ] Email verification link → `/verify-email?status=success`
- [ ] Play a run: start → first death → save score OR watch ad → continue → final score saved
- [ ] Resubmitting the same run is rejected (stderr log with `anti-cheat`)
- [ ] Logs do not show `rate-limit ... Redis unavailable`
- [ ] `/privacy` and `/terms` pages are replaced with real legal text before launch

Full live-game checklist: [LIVE-PROD.md](LIVE-PROD.md).
