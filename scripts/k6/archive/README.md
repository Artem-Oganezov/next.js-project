# k6 load-test archive

Scripts used for local smoke/load verification (Jul 2026).
Not part of the app runtime — keep for future VPS load tests.

Run examples (from project root):

```powershell
k6 run scripts/k6/archive/01-revive-flow.js
powershell -File scripts/k6/archive/run-smoke.ps1
```

One-off data cleanup after tests:

```bash
node scripts/cleanup-load-test-data.mjs
```
