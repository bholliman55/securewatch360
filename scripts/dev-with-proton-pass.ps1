param(
  [string]$EnvFile = ".env.protonrefs.local"
)

$ErrorActionPreference = "Stop"

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

Require-Command "pass-cli"
Require-Command "npm"

$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $workspaceRoot

$envFilePath = Join-Path $workspaceRoot $EnvFile
if (-not (Test-Path $envFilePath)) {
  throw "Missing env reference file at $envFilePath"
}

Write-Host "Checking Proton Pass login..."
pass-cli whoami | Out-Null

Write-Host "Starting Next.js dev server with Proton Pass injected env..."
Start-Process `
  -FilePath "pass-cli" `
  -ArgumentList @("run", "--env-file", $envFilePath, "--", "npm", "run", "dev") `
  -WorkingDirectory $workspaceRoot

Write-Host "Starting Inngest dev server with Proton Pass injected env..."
Start-Process `
  -FilePath "pass-cli" `
  -ArgumentList @("run", "--env-file", $envFilePath, "--", "npm", "run", "inngest:dev") `
  -WorkingDirectory $workspaceRoot

Write-Host ""
Write-Host "Launched both services in separate processes."
Write-Host "Use your terminal/process manager to stop them when done."
