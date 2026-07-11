# Smoke verification after security/rate-limit fixes.
# Requires: dev server on localhost:3000, k6 installed.

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $ProjectRoot

$BaseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { "http://127.0.0.1:3000" }
$K6 = "k6"

function Invoke-K6($script, $extraEnv = @{}) {
  $env:BASE_URL = $BaseUrl
  foreach ($k in $extraEnv.Keys) { Set-Item -Path "env:$k" -Value $extraEnv[$k] }
  & $K6 run $script
  if ($LASTEXITCODE -ne 0) { throw "k6 failed: $script" }
}

Write-Host "=== [1/4] Revive challenge flow ===" -ForegroundColor Cyan
Invoke-K6 "scripts/k6/01-revive-flow.js"

Write-Host "=== [2/4] Leaderboard rate limit ===" -ForegroundColor Cyan
Invoke-K6 "scripts/k6/02-leaderboard-ratelimit.js"

Write-Host "=== [3/4] FAIL_CLOSED with broken Redis ===" -ForegroundColor Cyan
$envPath = Join-Path $ProjectRoot ".env.local"
$backupPath = "$envPath.k6-backup"
Copy-Item $envPath $backupPath -Force
try {
  $lines = Get-Content $envPath
  $lines = $lines | ForEach-Object {
    if ($_ -match "^UPSTASH_REDIS_REST_TOKEN=") {
      "UPSTASH_REDIS_REST_TOKEN=invalid-token-for-k6-smoke"
    } else { $_ }
  }
  Set-Content -Path $envPath -Value $lines -Encoding utf8

  Write-Host "Restarting dev server to pick up broken Redis token..." -ForegroundColor Yellow
  $conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) {
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
  $dev = Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev" -WorkingDirectory $ProjectRoot -PassThru -WindowStyle Hidden
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    try {
      $h = Invoke-WebRequest -Uri "$BaseUrl/api/health" -UseBasicParsing -TimeoutSec 3
      if ($h.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
  }
  if (-not $ready) { throw "Dev server did not become ready after Redis token break" }

  Invoke-K6 "scripts/k6/03-fail-closed.js"
}
finally {
  Copy-Item $backupPath $envPath -Force
  Remove-Item $backupPath -Force -ErrorAction SilentlyContinue
  if ($dev) {
    Stop-Process -Id $dev.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
  Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev" -WorkingDirectory $ProjectRoot -WindowStyle Hidden | Out-Null
  Write-Host "Restored .env.local and restarted dev server." -ForegroundColor Green
}

Write-Host "Waiting for healthy Redis after restore..." -ForegroundColor Yellow
Start-Sleep -Seconds 12
for ($i = 0; $i -lt 30; $i++) {
  try {
    $h = Invoke-RestMethod -Uri "$BaseUrl/api/health" -TimeoutSec 3
    if ($h.redis -eq "connected") { break }
  } catch {}
  Start-Sleep -Seconds 2
}

Write-Host "=== [4/4] Full cycle (50 VUs) ===" -ForegroundColor Cyan
Invoke-K6 "scripts/k6/04-full-cycle.js" @{ VUS = "50" }

Write-Host "All smoke k6 checks completed." -ForegroundColor Green
