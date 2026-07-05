# Production deployment checklist

Use this after code is ready and before pointing a real domain at the game.

## 1. Environment (`.env` on server)

Copy `.env.production.example` and fill every required value:

- `MONGODB_URI` — Atlas or dedicated Mongo (not on the app node)
- `AUTH_SECRET` — `openssl rand -base64 32` (identical on all app nodes)
- `REDIS_URL` or Upstash REST credentials (shared across nodes)
- `ADMIN_SECRET` — ≥32 chars for `/admin` and metrics
- `APP_URL=https://your-domain.com`
- `TRUST_PROXY=true` behind nginx/Caddy
- `RATE_LIMIT_FAIL_CLOSED=true`
- `SCORE_ASYNC=true` + score worker for traffic spikes (see [INFLUENCER-LAUNCH.md](INFLUENCER-LAUNCH.md))
- SMTP variables for password reset and email verification
- `NEXT_PUBLIC_REVIVE_AD_PROVIDER=none` (soft launch) or `slot` with ad network

## 2. Infrastructure

- [ ] VPS with Docker, or Vercel + Upstash
- [ ] HTTPS (Caddy or nginx + certbot) — see [VPS-DEPLOY.md](VPS-DEPLOY.md)
- [ ] nginx overwrites `X-Forwarded-For` (`nginx.example.conf`)
- [ ] MongoDB IP whitelist / strong credentials
- [ ] Uptime monitor on `GET /api/health` → `"status":"ok"`

## 3. Smoke tests (production URL)

- [ ] Register → verify email → login
- [ ] Play → crash → save score → leaderboard updates
- [ ] Revive flow (if ads enabled): ad → continue → second death → score saved
- [ ] Duplicate submit same session → 403
- [ ] `/admin` with `ADMIN_SECRET` — suspicious log visible
- [ ] Logs show no sustained `Redis unavailable`

## 4. Legal

- [ ] Review `/privacy` and `/terms` (`lib/i18n/ui.ts` → `legal.*`)
- [ ] Add operator contact email in privacy section
- [ ] Update [LICENSE](../LICENSE) if needed

## 5. Release

```bash
npm test
npm run build
git push origin main   # CI must pass
docker compose up -d --build
curl -s https://your-domain.com/api/health
```

See also: [DEPLOY.md](DEPLOY.md), [LIVE-PROD.md](LIVE-PROD.md), [ADS.md](ADS.md).
