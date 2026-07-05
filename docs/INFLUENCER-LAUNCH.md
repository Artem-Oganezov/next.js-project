# Influencer / traffic spike launch

Checklist before asking a large account to share your game link.

## 1. Infrastructure (24–48h before)

- [ ] Production on VPS with HTTPS — [VPS-DEPLOY.md](VPS-DEPLOY.md)
- [ ] **Cloudflare** in front of the domain (caches static JS/CSS)
- [ ] **Second app node** in `nginx.example.conf` (same `.env`, shared Mongo + Redis)
- [ ] MongoDB Atlas **M10+**, Redis **shared** (not per-node compose Redis in prod)
- [ ] `TRUST_PROXY=true`, `RATE_LIMIT_FAIL_CLOSED=true`
- [ ] `SCORE_ASYNC=true` in `.env` on **all app nodes**
- [ ] Score worker running: `docker compose up -d worker` (one or more replicas)

## 2. Smoke test

- [ ] Play → death → see **“Saving score…”** briefly → rank on game over
- [ ] `curl https://your-domain.com/api/health` → `"status":"ok"`
- [ ] Optional: 10–20 friends open the game at the same time

## 3. Day of post

- Prefer **feed post / stories** over “everyone join live stream now” unless you have 3+ app nodes
- Watch server CPU and worker logs (`docker compose logs -f worker`)
- If score saves slow down: scale **app nodes** first; add **worker replicas** if queue grows

## 4. Scale playbook

| Signal | Action |
|--------|--------|
| High CPU on app nodes | Add app VPS to nginx upstream |
| Jobs stay `pending` > 10s | `docker compose up -d --scale worker=2` |
| Static assets slow | Cloudflare cache / orange cloud |
| Mongo connections | Atlas tier up |

## 5. Architecture reminder

- Gameplay runs in the browser — “10k online” is mostly client-side
- Server load spikes on **death** (`POST /api/game/score`)
- With `SCORE_ASYNC=true`, API returns **202** immediately; worker runs replay + DB update
- Client polls `GET /api/game/score/status/:jobId` until completed

See also: [PRODUCTION.md](PRODUCTION.md), [VPS-DEPLOY.md](VPS-DEPLOY.md).
