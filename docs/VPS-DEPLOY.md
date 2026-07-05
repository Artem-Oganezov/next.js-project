# VPS deployment (Docker + HTTPS)

Self-hosted deployment guide: one VPS runs the app behind nginx/Caddy with TLS.

## Prerequisites

- Ubuntu 22.04+ (or any Linux with Docker)
- Domain pointing to the server (`A` record)
- MongoDB (Atlas recommended) — keep it **outside** the app VPS
- Optional: managed Redis; otherwise use the Redis service from `docker-compose.yml`

## 1. Server setup

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
# re-login so docker group applies
```

## 2. Clone and configure

```bash
git clone <your-repo> && cd <your-repo>
cp .env.example .env
```

Edit `.env`:

```env
MONGODB_URI=mongodb+srv://...
AUTH_SECRET=<openssl rand -base64 32>
REDIS_URL=redis://redis:6379
APP_URL=https://your-domain.com
TRUST_PROXY=true
ADMIN_SECRET=<openssl rand -base64 32>

# Email (password reset / verification)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=noreply@your-domain.com
```

`TRUST_PROXY=true` is required when nginx/Caddy terminates TLS — otherwise rate limits use `unknown` as the client IP (safe but coarse).

## 3. Start the stack

```bash
docker compose up -d --build
curl -s http://127.0.0.1:3000/api/health | jq
```

## 4. HTTPS with Caddy (simplest)

Install Caddy, then `/etc/caddy/Caddyfile`:

```
your-domain.com {
  reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo systemctl reload caddy
```

Caddy obtains Let's Encrypt certificates automatically.

## 5. HTTPS with nginx + certbot

See `nginx.example.conf` in the repo root. After editing:

```bash
sudo certbot --nginx -d your-domain.com
```

## 6. Async score worker (traffic spikes)

When `SCORE_ASYNC=true` in `.env`:

```bash
docker compose up -d --build   # starts app + redis + worker
```

The worker runs `node score-worker.cjs` (bundled at image build). Scale workers:

```bash
docker compose up -d --scale worker=2
```

Requires **TCP** `REDIS_URL` (shared across app nodes and workers). See [INFLUENCER-LAUNCH.md](INFLUENCER-LAUNCH.md).

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
