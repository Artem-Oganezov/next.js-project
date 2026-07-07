# VPS deployment (Docker + HTTPS)

Self-hosted deployment guide: one VPS runs the app behind nginx/Caddy with TLS.

## Prerequisites

- Ubuntu 22.04+ (or any Linux with Docker)
- Domain pointing to the server (`A` record)
- MongoDB Atlas (or dedicated Mongo) — **outside** the app VPS
- Managed Redis (TCP `REDIS_URL`) — **outside** the app VPS for multi-node prod

## Production stack (recommended)

`docker-compose.prod.yml` — **2× app**, **score worker**, **nginx LB**, no local Redis.

```bash
git clone <your-repo> && cd <your-repo>
cp .env.production.example .env
nano .env   # MONGODB_URI, REDIS_URL (managed), AUTH_SECRET, SMTP, …
docker compose -f docker-compose.prod.yml up -d --build
curl -s http://127.0.0.1/api/health
```

Nginx listens on port **80** and balances between `app-a` and `app-b`. Put **Cloudflare** or **Caddy** in front for HTTPS.

Scale workers on spikes:

```bash
docker compose -f docker-compose.prod.yml up -d --scale worker=2
```

See `.env.production.example` for all variables (`TRUST_PROXY`, `SCORE_ASYNC`, `ADMIN_SECRET`, etc.).

## Dev / single-node stack

`docker-compose.yml` — one app + local Redis sidecar (good for a single small VPS or local experiments):

```bash
cp .env.production.example .env
# set REDIS_URL=redis://redis:6379 for the bundled Redis service
docker compose up -d --build
```

## 1. Server setup

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
# re-login so docker group applies
```

## 2. Clone and configure

Use `.env.production.example` as the template (see **Production stack** above).

Key values:

```env
MONGODB_URI=mongodb+srv://...
REDIS_URL=rediss://...          # managed Redis (TCP), not Upstash REST
AUTH_SECRET=<openssl rand -base64 32>
APP_URL=https://your-domain.com
TRUST_PROXY=true
RATE_LIMIT_FAIL_CLOSED=true
ADMIN_SECRET=<openssl rand -base64 32>
SCORE_ASYNC=true

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=noreply@your-domain.com
```

`TRUST_PROXY=true` is required when nginx/Caddy/Cloudflare terminates TLS — otherwise rate limits use `unknown` as the client IP.

## 3. Start the stack

Production:

```bash
docker compose -f docker-compose.prod.yml up -d --build
curl -s http://127.0.0.1/api/health
```

Single-node (local Redis):

```bash
docker compose up -d --build
curl -s http://127.0.0.1:3000/api/health
```

## 4. HTTPS with Caddy (simplest)

Install Caddy on the host, then `/etc/caddy/Caddyfile`:

```
your-domain.com {
  reverse_proxy 127.0.0.1:80
}
```

For `docker-compose.prod.yml`, nginx already listens on port 80 — point Caddy at **:80**, not :3000.

```bash
sudo systemctl reload caddy
```

Caddy obtains Let's Encrypt certificates automatically.

## 5. HTTPS with nginx + certbot

For host-level nginx in front of Docker, see `nginx.example.conf`. For the bundled LB, use `nginx.prod.conf` inside compose and terminate TLS at Cloudflare or Caddy.

```bash
sudo certbot --nginx -d your-domain.com
```

## 6. Async score worker (traffic spikes)

When `SCORE_ASYNC=true` in `.env`:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The worker runs `node score-worker.cjs` (bundled at image build). Scale workers:

```bash
docker compose -f docker-compose.prod.yml up -d --scale worker=2
```

Requires **TCP** `REDIS_URL` (shared managed Redis). See [INFLUENCER-LAUNCH.md](INFLUENCER-LAUNCH.md).

## 7. Scaling to multiple app nodes

1. MongoDB and Redis must be **shared** and reachable from every node.
2. Deploy the same Docker image + **identical** `.env` (`AUTH_SECRET` must match).
3. Add each node to the load balancer upstream.
4. Health check: `GET /api/health` returns `503` when Mongo is down — remove unhealthy nodes from rotation.

## 8. Backups

- **MongoDB:** Atlas backups, or `mongodump` on a cron job to object storage.
- **Redis:** ephemeral (cache + rate limit); no backup required unless you store critical state there.

## 9. Operations checklist

- [ ] `GET /api/health` → `status: ok`
- [ ] Register → verification email in logs or inbox
- [ ] Submit a score → leaderboard updates
- [ ] `/admin` works with `ADMIN_SECRET`
- [ ] Prometheus scrapes `/api/metrics` (protected when `ADMIN_SECRET` is set)
