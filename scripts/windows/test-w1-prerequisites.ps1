[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$failures = [System.Collections.Generic.List[string]]::new()
function Test-Requirement([string]$Name, [scriptblock]$Check) {
  try { & $Check; Write-Host "[PASS] $Name" -ForegroundColor Green }
  catch { $failures.Add("${Name}: $($_.Exception.Message)"); Write-Host "[FAIL] $Name - $($_.Exception.Message)" -ForegroundColor Red }
}
function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "Command '$Name' is unavailable." }
}

Test-Requirement 'Windows host' {
  $runningOnWindows = ($env:OS -eq 'Windows_NT') -or ($PSVersionTable.PSEdition -eq 'Desktop')
  if (-not $runningOnWindows) { throw 'W1 requires Windows.' }
}
Test-Requirement 'Interactive Windows session' {
  Require-Command quser
  $active = (& quser 2>$null | Select-String -Pattern '\bActive\b')
  if (-not $active) { throw 'No Active session was returned by quser.' }
}
Test-Requirement '.NET SDK' { Require-Command dotnet; & dotnet --info | Out-Null }
Test-Requirement 'Node and npm' { Require-Command node; Require-Command npm; & node --version | Out-Null; & npm --version | Out-Null }
Test-Requirement 'Docker' { Require-Command docker; & docker version --format '{{.Server.Version}}' | Out-Null }
Test-Requirement 'Writable W1 result directory' {
  $dir = Join-Path $PSScriptRoot '.w1-run'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $probe = Join-Path $dir ".write-$PID.tmp"
  Set-Content -Path $probe -Value 'ok' -Encoding ascii
  Remove-Item -Force $probe
}
Test-Requirement 'Required Docker ports' {
  $owners = @{}
  foreach ($container in (& docker ps --format '{{.Names}}' 2>$null)) {
    if ($container -in @('cyfast-w1-mysql', 'cyfast-w1-rabbitmq')) {
      $owners[$container] = (& docker port $container 2>$null) -join "`n"
    }
  }
  # W1 compose publishes MySQL on host 3307 (container 3306) to avoid colliding with shared cyfast-mysql:3306.
  foreach ($port in 3307, 5672) {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listener) {
      $allowed = ($owners.Values -join "`n") -match ":$port->" -or ($owners.Values -join "`n") -match "0.0.0.0:$port->" -or ($owners.Values -join "`n") -match ":$port$"
      # docker port output looks like: 3306/tcp -> 0.0.0.0:3307
      if (-not $allowed) {
        $portText = ($owners.Values -join "`n")
        $allowed = $portText -match [regex]::Escape("0.0.0.0:$port") -or $portText -match [regex]::Escape("::$port") -or $portText -match [regex]::Escape("127.0.0.1:$port")
      }
      if (-not $allowed) { throw "Port $port is in use by a non-W1 process." }
    }
  }
}
Test-Requirement 'No stale Windows Agent / Session Host process' {
  $stale = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -in @('CyFast.Windows.Agent.exe', 'CyFast.Windows.SessionHost.exe') })
  if ($stale.Count -gt 0) {
    $detail = ($stale | ForEach-Object { '{0}={1}' -f $_.Name, $_.ProcessId }) -join ', '
    throw "Stop stale W1 process(es): $detail."
  }
}
Test-Requirement 'No stale test fixture process' {
  $stale = Get-CimInstance Win32_Process -Filter "Name = 'CyFast.Windows.TestFixture.exe'" -ErrorAction SilentlyContinue
  if ($stale) { throw "Stop stale CyFast.Windows.TestFixture process(es): $($stale.ProcessId -join ', ')." }
}

if ($failures.Count) {
  Write-Error ("W1 prerequisites failed:`n - " + ($failures -join "`n - "))
  exit 1
}
Write-Host 'W1 prerequisites passed.'
