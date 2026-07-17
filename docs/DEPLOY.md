# Deployment

## Target: VPS + Docker

Self-hosted is the supported production path. See [VPS-DEPLOY.md](VPS-DEPLOY.md) for HTTPS and the multi-node stack.

```bash
git clone <repo> && cd <repo>
cp .env.production.example .env
# Set at minimum:
#   MONGODB_URI  — MongoDB Atlas or a separate server (NOT on the app node)
#   AUTH_SECRET  — openssl rand -base64 32
#   REDIS_URL    — managed Redis TCP (or redis://redis:6379 with single-node compose)
#   TRUST_PROXY=true
#   RATE_LIMIT_FAIL_CLOSED=true
#   SCORE_ASYNC=true  — use with score worker
docker compose -f docker-compose.prod.yml up -d --build
curl http://127.0.0.1/api/health   # expect "status":"ok"
```

Single-node / lab: `docker compose up -d --build` (app + Redis sidecar). Mongo stays external so data outlives app nodes.

### Reverse proxy (required for production)

`nginx.example.conf` is a ready upstream config. Critical: **nginx must overwrite `X-Forwarded-For`**, otherwise clients can spoof IP and bypass IP rate limits:

```nginx
proxy_set_header X-Forwarded-For $remote_addr;
```

TLS via certbot/Caddy in front of nginx or instead of it.

## Scaling to multiple servers

The API is stateless; sticky sessions are not required.

1. Use shared managed Redis (`REDIS_URL`) and Mongo across nodes.
2. New VPS: same image + **same `.env`** (identical `AUTH_SECRET`!).
3. Add the server to the load balancer upstream.
4. Scale score workers when `scoreQueueDepth` on `/api/health` grows under load.

`GET /api/health` returns 503 when Mongo is down — the LB removes the node. `degraded` (Redis down) means the node is alive but without cache and rate limiting.

## Ops: rebuild leaderboard cache

If Redis rank ZSET drifts from Mongo (wipe, incident):

```bash
npx tsx scripts/rebuild-leaderboard.ts
# or: POST /api/admin/leaderboard/rebuild with X-Admin-Secret
```

## Post-deploy checklist

- [ ] `/api/health` → `"status":"ok"` (optional: `scoreQueueDepth` when `SCORE_ASYNC=true`)
- [ ] Registration + login work; cookie is `Secure` (NODE_ENV=production)
- [ ] Forgot password email → `/reset-password` completes reset
- [ ] Email verification link → `/verify-email?status=success`
- [ ] Play a run: start → first death → save score OR watch ad → continue → final score saved
- [ ] Resubmitting the same run is rejected (stderr log with `anti-cheat`)
- [ ] Logs do not show `rate-limit ... Redis unavailable`
- [ ] `/privacy` and `/terms` pages are replaced with real legal text before launch

Full live-game checklist: [LIVE-PROD.md](LIVE-PROD.md).

> **Not supported as a product path:** serverless hosts without a long-lived score worker and TCP Redis (e.g. typical Vercel + REST-only Redis). The template is built for VPS/Docker.
