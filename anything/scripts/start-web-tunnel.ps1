param(
  [int]$Port = 4000
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $repoRoot 'apps\web'
$mobileDir = Join-Path $repoRoot 'apps\mobile'
$ngrokScript = Join-Path $mobileDir 'scripts\start-ngrok-tunnel.cjs'

if (-not $env:DATABASE_URL) {
  throw 'DATABASE_URL is not set in the current shell.'
}

if (-not $env:AUTH_SECRET) {
  throw 'AUTH_SECRET is not set in the current shell.'
}

if (-not $env:AUTH_URL) {
  Write-Warning 'AUTH_URL is not set. Set it to the public tunnel URL after ngrok starts.'
}

function Test-HttpServer {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 3
  )

  try {
    Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec $TimeoutSeconds | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Wait-ForHttpServer {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 75
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    if (Test-HttpServer -Url $Url) {
      return $true
    }

    Start-Sleep -Seconds 1
  } while ((Get-Date) -lt $deadline)

  return $false
}

function Start-NgrokTunnel {
  param([int]$TunnelPort)

  if (-not (Test-Path $ngrokScript)) {
    throw "ngrok helper script not found at $ngrokScript."
  }

  $outLog = Join-Path $mobileDir "ngrok-backend-$TunnelPort.out.log"
  $errLog = Join-Path $mobileDir "ngrok-backend-$TunnelPort.err.log"

  Remove-Item $outLog, $errLog -Force -ErrorAction SilentlyContinue

  $regionArg = if ($env:NGROK_REGION) { " ""$($env:NGROK_REGION)""" } else { '' }
  $cmdArgument = "node `"$ngrokScript`" $TunnelPort$regionArg > `"$outLog`" 2> `"$errLog`""
  Start-Process `
    -FilePath 'cmd.exe' `
    -ArgumentList '/c', $cmdArgument `
    -WorkingDirectory $mobileDir

  $deadline = (Get-Date).AddSeconds(35)
  do {
    Start-Sleep -Seconds 1

    if (Test-Path $outLog) {
      $url = Select-String -Path $outLog -Pattern 'https?://\S+' | Select-Object -First 1
      if ($url) {
        return @{
          Url = $url.Matches[0].Value.Trim()
          OutLog = $outLog
          ErrLog = $errLog
        }
      }
    }
  } while ((Get-Date) -lt $deadline)

  $stdout = if (Test-Path $outLog) { Get-Content $outLog -Raw } else { '' }
  $stderr = if (Test-Path $errLog) { Get-Content $errLog -Raw } else { '' }
  throw "Timed out waiting for ngrok tunnel.`nSTDOUT:`n$stdout`nSTDERR:`n$stderr"
}

Write-Host "Starting ParkMate web backend on port $Port ..."
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "npm run dev -- --port $Port" -WorkingDirectory $webDir

Write-Host "Waiting for backend on http://127.0.0.1:$Port ..."
if (-not (Wait-ForHttpServer -Url "http://127.0.0.1:$Port")) {
  throw "Web backend did not become reachable on port $Port."
}

Write-Host "Starting ngrok tunnel for port $Port ..."
$tunnel = Start-NgrokTunnel -TunnelPort $Port
$tunnelUrl = $tunnel.Url

Write-Host ''
Write-Host "Tunnel URL: $tunnelUrl"
Write-Host ''
Write-Host 'Next steps:'
Write-Host "1. Set AUTH_URL=$tunnelUrl in the shell running the backend."
Write-Host "2. Set EXPO_PUBLIC_BASE_URL=$tunnelUrl in apps/mobile/.env"
Write-Host "3. Set EXPO_PUBLIC_APP_URL=$tunnelUrl in apps/mobile/.env"
Write-Host '4. Restart the web backend.'
Write-Host '5. Restart Expo with cache clear.'
Write-Host ''
Write-Host 'Tunnel logs:'
Write-Host $tunnel.OutLog
Write-Host $tunnel.ErrLog
