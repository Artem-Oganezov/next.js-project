# Influencer / traffic spike launch

Checklist before sharing your game link with a large audience. This doc describes **how to scale** — not fixed capacity numbers (measure on your own stack).

## 1. Infrastructure (prepare ahead of launch)

- [ ] Production on VPS with HTTPS — [VPS-DEPLOY.md](VPS-DEPLOY.md)
- [ ] **Cloudflare** in front of the domain (caches static JS/CSS)
- [ ] **Second app node** in nginx upstream (same `.env`, shared Mongo + Redis)
- [ ] MongoDB Atlas (or dedicated Mongo) and Redis sized for your deployment; Redis **shared** across app nodes (not per-node compose Redis in prod)
- [ ] `TRUST_PROXY=true`, `RATE_LIMIT_FAIL_CLOSED=true`
- [ ] `SCORE_ASYNC=true` on **all app nodes**
- [ ] Score worker running: `docker compose up -d worker` — add replicas as queue depth grows

## 2. Smoke test

- [ ] Play → death → see **“Saving score…”** briefly → rank on game over
- [ ] `curl https://your-domain.com/api/health` → `"status":"ok"`
- [ ] Optional: small concurrent smoke test (friends, staging, or load tool) before the post goes live

## 3. Day of post

- Prefer **feed post / stories** over a synchronized “everyone plays at once” moment unless app capacity behind the load balancer is already scaled
- Watch server CPU, Mongo/Redis metrics, and worker logs (`docker compose logs -f worker`)
- If score saves slow down: add **app nodes** first; add **worker replicas** if the async queue backs up

## 4. Scale playbook

| Signal | Action |
|--------|--------|
| High CPU on app nodes | Add app instance to nginx upstream |
| Score jobs stay `pending` / queue grows | Scale worker replicas (`docker compose … --scale worker=<n>`) |
| Static assets slow | Cloudflare cache / orange cloud |
| Mongo connection pressure | Raise Atlas tier or tune `MONGODB_MAX_POOL_SIZE` |

There is no single “max online” figure baked into the template — gameplay is mostly client-side; server load concentrates on **death** (`POST /api/game/score`). Scale based on your metrics.

## 5. Architecture reminder

- Gameplay runs in the browser — players are not hammering the API every frame
- Server load spikes on **death** (`POST /api/game/score`)
- With `SCORE_ASYNC=true`, API returns **202** immediately; worker runs replay + DB update
- Client polls `GET /api/game/score/status/:jobId` until completed
- Horizontal scale: more app nodes for API, more workers for the score queue, larger Mongo/Redis as observability indicates

See also: [PRODUCTION.md](PRODUCTION.md), [VPS-DEPLOY.md](VPS-DEPLOY.md).
