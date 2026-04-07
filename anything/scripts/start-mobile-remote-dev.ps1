param(
  [int]$MetroPort = 4000,
  [int]$BackendPort = 4001,
  [switch]$PrintOnly
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileDir = Join-Path $repoRoot 'apps\mobile'
$webDir = Join-Path $repoRoot 'apps\web'
$ltCmd = Join-Path $webDir 'node_modules\.bin\lt.cmd'
$mobileConfig = Get-Content (Join-Path $mobileDir 'app.json') -Raw | ConvertFrom-Json
$mobileScheme = $mobileConfig.expo.scheme

if (-not $mobileScheme) {
  throw "Missing expo.scheme in $($mobileDir)\app.json."
}

if (-not (Test-Path $ltCmd)) {
  throw "localtunnel binary not found at $ltCmd. Run npm install in apps/web first."
}

function Start-LocalTunnel {
  param(
    [string]$Name,
    [int]$Port,
    [string]$WorkingDirectory
  )

  $outLog = Join-Path $WorkingDirectory "$Name.out.log"
  $errLog = Join-Path $WorkingDirectory "$Name.err.log"

  Remove-Item $outLog, $errLog -Force -ErrorAction SilentlyContinue

  $cmdArgument = "$ltCmd --port $Port > $outLog 2> $errLog"
  Start-Process `
    -FilePath 'cmd.exe' `
    -ArgumentList '/c', $cmdArgument `
    -WorkingDirectory $WorkingDirectory

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
  throw "Timed out waiting for $Name tunnel.`nSTDOUT:`n$stdout`nSTDERR:`n$stderr"
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
    [int]$TimeoutSeconds = 60
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

function Start-ExpoServer {
  param(
    [int]$Port,
    [string]$Scheme,
    [string]$PackagerProxyUrl,
    [string]$BackendUrl,
    [string]$BackendHost
  )

  $outLog = Join-Path $mobileDir 'expo-proxy.out.log'
  $errLog = Join-Path $mobileDir 'expo-proxy.err.log'

  Remove-Item $outLog, $errLog -Force -ErrorAction SilentlyContinue

  $cmdParts = @(
    'set "CI=1"',
    "set ""EXPO_PACKAGER_PROXY_URL=$PackagerProxyUrl""",
    "set ""RCT_METRO_PORT=$Port"""
  )

  if ($BackendUrl) {
    $cmdParts += "set ""EXPO_PUBLIC_BASE_URL=$BackendUrl"""
    $cmdParts += "set ""EXPO_PUBLIC_APP_URL=$BackendUrl"""
  }

  if ($BackendHost) {
    $cmdParts += "set ""EXPO_PUBLIC_HOST=$BackendHost"""
  }

  $cmdParts += "npx expo start --dev-client --scheme ""$Scheme"" --port $Port --lan --clear > ""$outLog"" 2> ""$errLog"""

  Start-Process `
    -FilePath 'cmd.exe' `
    -ArgumentList '/c', ($cmdParts -join ' && ') `
    -WorkingDirectory $mobileDir

  return @{
    OutLog = $outLog
    ErrLog = $errLog
  }
}

$selectedMetroPort = $MetroPort
if (Test-PortListening -Port $selectedMetroPort) {
  throw "Metro port $selectedMetroPort is already in use. Stop the existing Expo/Metro session and rerun this script. The remote-dev tunnel flow must launch Expo on the same port it tunnels."
}

if ($PrintOnly) {
  Write-Host "Run 'npm run dev:remote' from $mobileDir to start Expo with a public Metro tunnel."
  Write-Host "If your backend needs to work off-network, start it on port $BackendPort before running that command."
  return
}

Write-Host "Starting Metro tunnel on port $selectedMetroPort ..."
$metroTunnel = Start-LocalTunnel -Name "lt-metro-$selectedMetroPort" -Port $selectedMetroPort -WorkingDirectory $mobileDir

$encodedMetroUrl = [Uri]::EscapeDataString($metroTunnel.Url)
$devClientUrl = "${mobileScheme}://expo-development-client/?url=$encodedMetroUrl"
$backendTunnel = $null
$mobileEnvPath = Join-Path $mobileDir '.env'
$backendHost = $null
$backendUrl = $null

if (Test-PortListening -Port $BackendPort) {
  Write-Host "Starting backend tunnel on port $BackendPort ..."
  $backendTunnel = Start-LocalTunnel -Name "lt-backend-$BackendPort" -Port $BackendPort -WorkingDirectory $mobileDir
  $backendHost = ([Uri]$backendTunnel.Url).Authority
  $backendUrl = $backendTunnel.Url
} else {
  Write-Warning "Nothing is listening on backend port $BackendPort. Metro tunnel is ready, but API calls from the phone will still fail until your backend is publicly reachable."
}

$expoLogs = Start-ExpoServer `
  -Port $selectedMetroPort `
  -Scheme $mobileScheme `
  -PackagerProxyUrl $metroTunnel.Url `
  -BackendUrl $backendUrl `
  -BackendHost $backendHost

Write-Host "Waiting for Expo to respond on http://127.0.0.1:$selectedMetroPort ..."
if (-not (Wait-ForHttpServer -Url "http://127.0.0.1:$selectedMetroPort" -TimeoutSeconds 75)) {
  $stdout = if (Test-Path $expoLogs.OutLog) { Get-Content $expoLogs.OutLog -Raw } else { '' }
  $stderr = if (Test-Path $expoLogs.ErrLog) { Get-Content $expoLogs.ErrLog -Raw } else { '' }
  throw "Expo did not become reachable on port $selectedMetroPort.`nSTDOUT:`n$stdout`nSTDERR:`n$stderr"
}

Write-Host "Expo is responding locally. Checking the public Metro tunnel ..."
if (-not (Wait-ForHttpServer -Url $metroTunnel.Url -TimeoutSeconds 20)) {
  Write-Warning "The public Metro tunnel did not answer immediately. The local dev server is up, but remote devices may still fail until the tunnel finishes propagating."
}

Write-Host ''
Write-Host 'Remote dev tunnels are ready:'
Write-Host "Metro:   $($metroTunnel.Url)"
if ($backendTunnel) {
  Write-Host "Backend: $($backendTunnel.Url)"
}
Write-Host ''
if ($backendTunnel) {
  $backendHost = ([Uri]$backendTunnel.Url).Authority
  Write-Host 'Backend env overrides for this session:'
  Write-Host "EXPO_PUBLIC_BASE_URL=$($backendTunnel.Url)"
  Write-Host "EXPO_PUBLIC_APP_URL=$($backendTunnel.Url)"
  Write-Host "EXPO_PUBLIC_HOST=$backendHost"
  Write-Host ''
} else {
  $currentBaseUrl = Get-EnvFileValue -FilePath $mobileEnvPath -Name 'EXPO_PUBLIC_BASE_URL'
  Write-Host 'Current apps/mobile/.env backend URL:'
  Write-Host "EXPO_PUBLIC_BASE_URL=$currentBaseUrl"
  Write-Host ''
}
Write-Host 'Expo launch env for this session:'
Write-Host "`$env:EXPO_PACKAGER_PROXY_URL='$($metroTunnel.Url)'"
Write-Host "`$env:RCT_METRO_PORT='$selectedMetroPort'"
Write-Host "npx expo start --dev-client --scheme $mobileScheme --port $selectedMetroPort --lan --clear"
Write-Host ''
Write-Host 'Open this URL on the phone to launch the dev client:'
Write-Host $devClientUrl
Write-Host ''
Write-Host 'Tunnel logs:'
if ($backendTunnel) {
  Write-Host $backendTunnel.OutLog
  Write-Host $backendTunnel.ErrLog
}
Write-Host $metroTunnel.OutLog
Write-Host $metroTunnel.ErrLog
Write-Host $expoLogs.OutLog
Write-Host $expoLogs.ErrLog
