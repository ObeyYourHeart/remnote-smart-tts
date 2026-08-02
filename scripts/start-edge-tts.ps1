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
if (-not $python) {
    Write-Error "Python was not found. Install Python 3.9+ from https://www.python.org/downloads/ first."
}

# If the service is already running, do not start a second copy.
try {
    $health = Invoke-RestMethod $HealthUrl -TimeoutSec 2
    Write-Host "Edge TTS service is already running (voiceCount=$($health.voiceCount))."
    exit 0
}
catch {
    # Not running yet - continue below.
}

Write-Host "Checking edge-tts..."
python -c "import edge_tts" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "edge-tts is missing. Installing it now (one-time setup)..."
    python -m pip install edge-tts
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Could not install edge-tts. Check your network connection and try again."
    }
}

Write-Host "Starting the Edge TTS service on port $Port..."
Start-Process -FilePath $python.Source `
    -ArgumentList @('-u', $ServerScript, '--port', "$Port") `
    -WindowStyle Hidden `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog

Start-Sleep -Seconds 4
try {
    $health = Invoke-RestMethod $HealthUrl -TimeoutSec 5
    Write-Host "Edge TTS service is ready (voiceCount=$($health.voiceCount))."
    Write-Host "You can now choose 'Edge Local Voice' as the provider in RemNote plugin settings."
}
catch {
    Write-Host "The service did not respond. See $ErrLog for details."
    exit 1
}
