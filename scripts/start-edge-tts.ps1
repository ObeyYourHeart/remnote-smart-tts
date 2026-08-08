param(
    [int]$Port = 8765
)

$ErrorActionPreference = 'Stop'
$ServerScript = Join-Path $PSScriptRoot 'edge-tts-server.py'
$OutLog = Join-Path $PSScriptRoot 'edge-tts-server.log'
$ErrLog = Join-Path $PSScriptRoot 'edge-tts-server.err.log'
$HealthUrl = "http://127.0.0.1:$Port/health"

Write-Host "Checking Python..."
$python = Get-Command python -ErrorAction SilentlyContinue
$pythonArguments = @()
if ($python) {
    $pythonFile = $python.Source
}
else {
    $pythonLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($pythonLauncher) {
        $pythonFile = $pythonLauncher.Source
        $pythonArguments = @('-3')
    }
}
if (-not $pythonFile) {
    Write-Error "Python was not found. Install Python 3.9+ from https://www.python.org/downloads/ first."
}

# If the service is already running, do not start a second copy.
$health = $null
try {
    $health = Invoke-RestMethod $HealthUrl -TimeoutSec 2
}
catch {
    # Not running yet - continue below.
}
if ($health) {
    if ($health.ok -and $health.service -eq 'edge-tts') {
        Write-Host "Edge TTS service is already running."
        exit 0
    }
    Write-Error "Port $Port is already used by another local service. Choose another port."
}

Write-Host "Checking edge-tts and aiohttp..."
& $pythonFile @pythonArguments -c "import edge_tts, aiohttp" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "A speech dependency is missing. Installing it now (one-time setup)..."
    & $pythonFile @pythonArguments -m pip install edge-tts aiohttp
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Could not install the speech dependencies. Check your network connection and try again."
    }
}

Write-Host "Starting the Edge TTS service on port $Port..."
# Start-Process joins ArgumentList into one command line. Quote the script path
# explicitly so an extracted folder such as "My RemNote Plugins" still works.
$quotedServerScript = '"' + $ServerScript + '"'
$startArguments = $pythonArguments + @('-u', $quotedServerScript, '--port', "$Port")
Start-Process -FilePath $pythonFile `
    -ArgumentList $startArguments `
    -WindowStyle Hidden `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog

Start-Sleep -Seconds 4
try {
    $health = Invoke-RestMethod $HealthUrl -TimeoutSec 5
    if (-not $health.ok -or $health.service -ne 'edge-tts') {
        throw "The port answered, but it is not the Edge TTS service."
    }
    Write-Host "Edge TTS service is ready (voiceCount=$($health.voiceCount))."
    Write-Host "You can now choose 'Edge Local Voice' as the provider in RemNote plugin settings."
}
catch {
    Write-Host "The service did not respond. See $ErrLog for details."
    exit 1
}
