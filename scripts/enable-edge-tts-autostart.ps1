param(
    [ValidateSet('install', 'remove')]
    [string]$Action = 'install'
)

$ErrorActionPreference = 'Stop'
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$EntryName = 'RemNote Edge TTS'
$Launcher = Join-Path $PSScriptRoot 'start-edge-tts.ps1'

if ($Action -eq 'install') {
    $command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Launcher`""
    New-Item -Path $RunKey -Force | Out-Null
    Set-ItemProperty -Path $RunKey -Name $EntryName -Value $command
    Write-Host "Autostart installed: $EntryName"
    Write-Host "Command: $command"
}
else {
    Remove-ItemProperty -Path $RunKey -Name $EntryName -ErrorAction SilentlyContinue
    Write-Host "Autostart removed: $EntryName"
}
