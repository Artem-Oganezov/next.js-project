# Live production checklist

Use this after local dev works and before pointing a real domain at the game.

## Infrastructure

- [ ] MongoDB Atlas (or dedicated Mongo) — not on the app node
- [ ] Redis — compose sidecar for one VPS, or Upstash / dedicated Redis for scale-out
- [ ] `APP_URL=https://your-domain.com` — email links, Open Graph, verify/reset URLs
- [ ] `AUTH_SECRET` — `openssl rand -base64 32`, identical on every app node
- [ ] `ADMIN_SECRET` — ≥32 chars for `/admin` and protected metrics
- [ ] HTTPS in front of the app (nginx/Caddy + certbot)
- [ ] `TRUST_PROXY=true` when behind nginx so IP rate limits use the real client IP
- [ ] nginx overwrites `X-Forwarded-For` (see `nginx.example.conf`)

## Email (account recovery + verification)

- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` set
- [ ] Forgot password → link opens `/reset-password?token=…`
- [ ] Register → verify link → `/api/auth/verify-email` → `/verify-email?status=success`
- [ ] Test resend verification from profile while logged in

## Legal & store readiness

- [ ] Replace stub copy on `/privacy` and `/terms` (`lib/i18n/ui.ts` → `legal.*`)
- [ ] Update [LICENSE](../LICENSE) jurisdiction and operator name
- [ ] Uptime monitor on `GET /api/health` (expect `"status":"ok"`)

## Game & anti-cheat smoke test

- [ ] Register → play → first death → save score → leaderboard updates
- [ ] First death → watch ad (stub) → continue → second death → score saved with revive log
- [ ] Same `sessionId` resubmit rejected (403)
- [ ] Logs show no sustained `rate-limit ... Redis unavailable`

## Optional next (monetization)

- [ ] Real ad SDK (interstitial) wired to the revive button (`AD_STUB_MS` in `game/Game.tsx`)
- [ ] Privacy policy mentions ads / ad partners if applicable

See also: [DEPLOY.md](DEPLOY.md), [VPS-DEPLOY.md](VPS-DEPLOY.md).
