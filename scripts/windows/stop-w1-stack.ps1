[CmdletBinding()]
param([switch]$All)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runDir = Join-Path $PSScriptRoot '.w1-run'
$pidPath = Join-Path $runDir 'pids.json'
if (Test-Path $pidPath) {
  foreach ($entry in @(Get-Content -Raw $pidPath | ConvertFrom-Json)) {
    $process = Get-Process -Id $entry.pid -ErrorAction SilentlyContinue
    if ($process) {
      Stop-Process -Id $entry.pid -Force -ErrorAction SilentlyContinue
      Write-Host "Stopped $($entry.name) ($($entry.pid))."
    }
  }
  Remove-Item -Force $pidPath
}

# These are exclusively local W1 test executables; do not broadly kill node or dotnet.
Get-CimInstance Win32_Process | Where-Object {
  $_.Name -in @('CyFast.Windows.TestFixture.exe', 'CyFast.Windows.SessionHost.exe', 'CyFast.Windows.Agent.exe') -or
  $_.CommandLine -match 'CyFast\.Windows\.(TestFixture|SessionHost|Agent)'
} | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  Write-Host "Stopped W1 process $($_.Name) ($($_.ProcessId))."
}
if ($All) {
  Push-Location $root
  try { & docker compose -f 'databases/docker-compose.w1.yml' down } finally { Pop-Location }
} else {
  Write-Host 'Docker dependencies left running. Use -All to stop them.'
}
