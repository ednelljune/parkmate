param(
  [int]$MetroPort = 8082,
  [int]$BackendPort = 4000,
  [ValidateSet('ngrok', 'localtunnel')]
  [string]$TunnelProvider = 'ngrok',
  [switch]$PrintOnly
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileDir = Join-Path $repoRoot 'apps\mobile'
$webDir = Join-Path $repoRoot 'apps\web'
$ltCmd = Join-Path $webDir 'node_modules\.bin\lt.cmd'
$ngrokScript = Join-Path $mobileDir 'scripts\start-ngrok-tunnel.cjs'

function Wait-ForTunnelUrl {
  param(
    [string]$Name,
    [string]$OutLog,
    [string]$ErrLog,
    [int]$TimeoutSeconds = 35
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    Start-Sleep -Seconds 1

    if (Test-Path $OutLog) {
      $url = Select-String -Path $OutLog -Pattern 'https?://\S+' | Select-Object -First 1
      if ($url) {
        return @{
          Url = $url.Matches[0].Value.Trim()
          OutLog = $OutLog
          ErrLog = $ErrLog
        }
      }
    }
  } while ((Get-Date) -lt $deadline)

  $stdout = if (Test-Path $OutLog) { Get-Content $OutLog -Raw } else { '' }
  $stderr = if (Test-Path $ErrLog) { Get-Content $ErrLog -Raw } else { '' }
  throw "Timed out waiting for $Name tunnel.`nSTDOUT:`n$stdout`nSTDERR:`n$stderr"
}

function Start-LocalTunnel {
  param(
    [string]$Name,
    [int]$Port,
    [string]$WorkingDirectory
  )

  if (-not (Test-Path $ltCmd)) {
    throw "localtunnel binary not found at $ltCmd. Run npm install in apps/web first."
  }

  $outLog = Join-Path $WorkingDirectory "$Name.out.log"
  $errLog = Join-Path $WorkingDirectory "$Name.err.log"

  Remove-Item $outLog, $errLog -Force -ErrorAction SilentlyContinue

  $cmdArgument = "`"$ltCmd`" --port $Port > `"$outLog`" 2> `"$errLog`""
  Start-Process `
    -FilePath 'cmd.exe' `
    -ArgumentList '/c', $cmdArgument `
    -WorkingDirectory $WorkingDirectory

  return Wait-ForTunnelUrl -Name $Name -OutLog $outLog -ErrLog $errLog
}

function Start-NgrokTunnel {
  param(
    [string]$Name,
    [int]$Port,
    [string]$WorkingDirectory
  )

  if (-not (Test-Path $ngrokScript)) {
    throw "ngrok helper script not found at $ngrokScript."
  }

  $outLog = Join-Path $WorkingDirectory "$Name.out.log"
  $errLog = Join-Path $WorkingDirectory "$Name.err.log"

  Remove-Item $outLog, $errLog -Force -ErrorAction SilentlyContinue

  $regionArg = if ($env:NGROK_REGION) { " ""$($env:NGROK_REGION)""" } else { '' }
  $cmdArgument = "node `"$ngrokScript`" $Port$regionArg > `"$outLog`" 2> `"$errLog`""
  Start-Process `
    -FilePath 'cmd.exe' `
    -ArgumentList '/c', $cmdArgument `
    -WorkingDirectory $WorkingDirectory

  return Wait-ForTunnelUrl -Name $Name -OutLog $outLog -ErrLog $errLog
}

function Start-Tunnel {
  param(
    [ValidateSet('ngrok', 'localtunnel')]
    [string]$Provider,
    [string]$Name,
    [int]$Port,
    [string]$WorkingDirectory
  )

  if ($Provider -eq 'ngrok') {
    return Start-NgrokTunnel -Name $Name -Port $Port -WorkingDirectory $WorkingDirectory
  }

  return Start-LocalTunnel -Name $Name -Port $Port -WorkingDirectory $WorkingDirectory
}

function Test-PortListening {
  param([int]$Port)

  $matches = netstat -ano | Select-String ":$Port\s+.*LISTENING"
  return [bool]$matches
}

function Get-EnvFileValue {
  param(
    [string]$FilePath,
    [string]$Name
  )

  if (-not (Test-Path $FilePath)) {
    return $null
  }

  $pattern = "^$([regex]::Escape($Name))=(.*)$"
  $match = Get-Content $FilePath | Select-String -Pattern $pattern | Select-Object -First 1
  if (-not $match) {
    return $null
  }

  return ($match.Matches[0].Groups[1].Value).Trim()
}

if ($PrintOnly) {
  Write-Host "Run 'npm run dev:go' from $mobileDir to start Expo Go through a public Metro tunnel."
  Write-Host "Use 'npm run dev:go:lan' when the phone and laptop are on the same trusted network."
  Write-Host "The default tunnel provider is $TunnelProvider. Set -TunnelProvider localtunnel to use the old flow."
  return
}

if (Test-PortListening -Port $MetroPort) {
  throw "Metro port $MetroPort is already in use. Stop the existing Expo/Metro session and rerun this script."
}

Write-Host "Starting $TunnelProvider Metro tunnel on port $MetroPort ..."
$metroTunnel = Start-Tunnel -Provider $TunnelProvider -Name "$TunnelProvider-metro-$MetroPort" -Port $MetroPort -WorkingDirectory $mobileDir
$metroAuthority = ([Uri]$metroTunnel.Url).Authority
# Expo CLI converts the proxy URL into the `exp://` URL shown in Expo Go.
# Using `http://host` keeps the Android websocket URL on the default port path.
$metroProxyUrl = "http://$metroAuthority"

$mobileEnvPath = Join-Path $mobileDir '.env'
$backendTunnel = $null
$backendHost = $null
$backendUrl = $null

if (Test-PortListening -Port $BackendPort) {
  Write-Host "Starting $TunnelProvider backend tunnel on port $BackendPort ..."
  $backendTunnel = Start-Tunnel -Provider $TunnelProvider -Name "$TunnelProvider-backend-$BackendPort" -Port $BackendPort -WorkingDirectory $mobileDir
  $backendHost = ([Uri]$backendTunnel.Url).Authority
  $backendUrl = $backendTunnel.Url
} else {
  Write-Warning "Nothing is listening on backend port $BackendPort. Expo Go will start, but API calls from the phone will still fail until your backend is reachable."
}

$env:EXPO_PACKAGER_PROXY_URL = $metroProxyUrl
$env:RCT_METRO_PORT = "$MetroPort"
$env:EXPO_NO_DEPENDENCY_VALIDATION = 'true'

if ($backendUrl) {
  $env:EXPO_PUBLIC_BASE_URL = $backendUrl
  $env:EXPO_PUBLIC_APP_URL = $backendUrl
}

if ($backendHost) {
  $env:EXPO_PUBLIC_HOST = $backendHost
}

Write-Host ''
Write-Host 'Expo Go remote session:'
Write-Host "Metro tunnel:   $($metroTunnel.Url)"
Write-Host "Metro proxy:    $metroProxyUrl"
if ($backendTunnel) {
  Write-Host "Backend tunnel: $($backendTunnel.Url)"
} else {
  $currentBaseUrl = Get-EnvFileValue -FilePath $mobileEnvPath -Name 'EXPO_PUBLIC_BASE_URL'
  Write-Host "Backend URL:    $currentBaseUrl"
}
Write-Host ''
Write-Host 'Starting Expo Go server...'
Write-Host "Logs: $($metroTunnel.OutLog)"
Write-Host "Logs: $($metroTunnel.ErrLog)"
if ($backendTunnel) {
  Write-Host "Logs: $($backendTunnel.OutLog)"
  Write-Host "Logs: $($backendTunnel.ErrLog)"
}
Write-Host ''
Write-Host "If Expo Go does not open automatically, scan the QR code that Expo prints below."
Write-Host ''

Push-Location $mobileDir
try {
  cmd /c "npx expo start --go --lan --port $MetroPort --clear"
} finally {
  Pop-Location
}
