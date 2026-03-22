$ErrorActionPreference = 'Continue'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiDir = Resolve-Path (Join-Path $root '..')
$port = 3000
$checkIntervalSeconds = 5
$restartCooldownSeconds = 20
$lastStartAttempt = [datetime]::MinValue

Write-Host "[API Watchdog] Starting. Watching port $port in $apiDir"

function Test-ApiUp {
  try {
    $resp = Invoke-RestMethod -Uri "http://localhost:$port/health" -Method Get -TimeoutSec 3
    return $resp.status -eq 'ok'
  } catch {
    return $false
  }
}

function Start-Api {
  $elapsed = ([datetime]::UtcNow - $lastStartAttempt).TotalSeconds
  if ($elapsed -lt $restartCooldownSeconds) {
    return
  }

  $script:lastStartAttempt = [datetime]::UtcNow
  Write-Host "[API Watchdog] API down. Starting npm run dev..."
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory $apiDir -WindowStyle Hidden | Out-Null
}

while ($true) {
  if (-not (Test-ApiUp)) {
    Start-Api
    Start-Sleep -Seconds 2
  }
  Start-Sleep -Seconds $checkIntervalSeconds
}
