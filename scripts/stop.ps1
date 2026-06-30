param(
  [string]$InstallDir = "$env:USERPROFILE\vibe-ide"
)

$pidFile = Join-Path $InstallDir "run\vibeide.pid"

if (-not (Test-Path $pidFile)) {
  Write-Host "No PID file found at $pidFile"
  exit 0
}

$processId = Get-Content -LiteralPath $pidFile
if ($processId -and (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {
  Stop-Process -Id $processId -Force
  Write-Host "Stopped VibeIDE process $processId"
} else {
  Write-Host "VibeIDE process is not running"
}

Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
