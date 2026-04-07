param(
  [int]$Port = 4000
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $repoRoot 'apps\web'
$mobileDir = Join-Path $repoRoot 'apps\mobile'

if (-not $env:DATABASE_URL) {
  throw 'DATABASE_URL is not set in the current shell.'
}

if (-not $env:AUTH_SECRET) {
  throw 'AUTH_SECRET is not set in the current shell.'
}

if (-not $env:AUTH_URL) {
  Write-Warning 'AUTH_URL is not set. Set it to the public tunnel URL after ngrok starts.'
}

Write-Host "Starting ParkMate web backend on port $Port ..."
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "npm run dev -- --port $Port" -WorkingDirectory $webDir

Start-Sleep -Seconds 5

$ngrokScript = @"
const ngrok = require('@expo/ngrok');
(async () => {
  const url = await ngrok.connect({ addr: $Port });
  console.log(url);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
"@

Write-Host "Starting ngrok tunnel for port $Port ..."
$tunnelUrl = node -e $ngrokScript

Write-Host ''
Write-Host "Tunnel URL: $tunnelUrl"
Write-Host ''
Write-Host 'Next steps:'
Write-Host "1. Set AUTH_URL=$tunnelUrl in the shell running the backend."
Write-Host "2. Set EXPO_PUBLIC_BASE_URL=$tunnelUrl in apps/mobile/.env"
Write-Host '3. Restart the web backend.'
Write-Host '4. Restart Expo with cache clear.'
