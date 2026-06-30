param(
  [string]$RepoUrl = "https://github.com/kantaevsherhan/vibe-ide.git",
  [string]$Branch = "main",
  [string]$InstallDir = "$env:USERPROFILE\vibe-ide",
  [int]$Port = 8080,
  [string]$WorkspaceDir = ""
)

$ErrorActionPreference = "Stop"

if (-not $WorkspaceDir) {
  $WorkspaceDir = Join-Path $InstallDir "workspace"
}

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name. Install it and run this installer again."
  }
}

Require-Command git
Require-Command node
Require-Command npm.cmd

$nodeMajor = [int](& node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 20) {
  throw "Node.js 20+ is required. Current version: $(& node -v)"
}

if (Test-Path (Join-Path $InstallDir ".git")) {
  Write-Host "Updating VibeIDE in $InstallDir"
  git -C $InstallDir fetch origin $Branch
  git -C $InstallDir checkout $Branch
  git -C $InstallDir pull --ff-only origin $Branch
} else {
  Write-Host "Cloning VibeIDE into $InstallDir"
  New-Item -ItemType Directory -Force -Path (Split-Path $InstallDir) | Out-Null
  git clone --branch $Branch $RepoUrl $InstallDir
}

Set-Location $InstallDir
New-Item -ItemType Directory -Force -Path $WorkspaceDir, "logs", "run", "config" | Out-Null

Write-Host "Installing dependencies"
npm.cmd install

Write-Host "Building VibeIDE"
npm.cmd run build

Write-Host "Writing config"
$configPath = Join-Path $InstallDir "config\vibeide.config.json"
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$config.server.host = if ($config.server.host) { $config.server.host } else { "0.0.0.0" }
$config.server.port = $Port
$config.workspace.path = $WorkspaceDir
[System.IO.File]::WriteAllText($configPath, (($config | ConvertTo-Json -Depth 10) + [Environment]::NewLine), [System.Text.UTF8Encoding]::new($false))

$pidFile = Join-Path $InstallDir "run\vibeide.pid"
$logFile = Join-Path $InstallDir "logs\vibeide.out.log"
$errorLogFile = Join-Path $InstallDir "logs\vibeide.err.log"
$frontendDist = Join-Path $InstallDir "apps\frontend\dist"
$backendEntry = Join-Path $InstallDir "apps\backend\dist\main.js"

if (-not (Test-Path (Join-Path $frontendDist "index.html"))) {
  throw "Frontend build was not found at $frontendDist\index.html. The build step failed or did not produce frontend assets."
}

if (-not (Test-Path $backendEntry)) {
  throw "Backend entry was not found at $backendEntry. The build step failed or did not produce backend assets."
}

if (Test-Path $pidFile) {
  $oldPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue
  if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
    Write-Host "Stopping old VibeIDE process $oldPid"
    Stop-Process -Id $oldPid -Force
    Start-Sleep -Seconds 2
  }
}

Write-Host "Starting VibeIDE in background"
$env:PORT = [string]$Port
$env:HOST = "0.0.0.0"
$env:WORKSPACE_DIR = $WorkspaceDir
$env:FRONTEND_DIST = $frontendDist
if (-not $env:NODE_ENV) {
  $env:NODE_ENV = "development"
}

$process = Start-Process -FilePath "node" `
  -ArgumentList @($backendEntry) `
  -WorkingDirectory $InstallDir `
  -RedirectStandardOutput $logFile `
  -RedirectStandardError $errorLogFile `
  -WindowStyle Hidden `
  -PassThru

$process.Id | Set-Content -LiteralPath $pidFile -Encoding ASCII

Write-Host "Waiting for VibeIDE health check"
$healthy = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
  if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
    Write-Host "VibeIDE failed to start."
    if (Test-Path $logFile) { Get-Content -LiteralPath $logFile -Tail 80 }
    if (Test-Path $errorLogFile) { Get-Content -LiteralPath $errorLogFile -Tail 80 }
    throw "Backend process exited before becoming healthy."
  }

  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 2
    $frontPage = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 2
    if ($health.ok -and $frontPage.StatusCode -eq 200) {
      $healthy = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}

if (-not $healthy) {
  Write-Host "VibeIDE did not become healthy on http://127.0.0.1:$Port"
  if (Test-Path $logFile) { Get-Content -LiteralPath $logFile -Tail 80 }
  if (Test-Path $errorLogFile) { Get-Content -LiteralPath $errorLogFile -Tail 80 }
  throw "Health check failed."
}

Write-Host "VibeIDE is running."
Write-Host "URL: http://127.0.0.1:$Port"
Write-Host "PID: $($process.Id)"
Write-Host "Log: $logFile"
Write-Host "Error log: $errorLogFile"
Write-Host "Config: $configPath"
Write-Host "Workspace: $WorkspaceDir"
Write-Host ""
Write-Host "Default login is admin / change-me. Change it in config/vibeide.config.json."
