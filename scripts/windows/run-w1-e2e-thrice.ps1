[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$results = @()
for ($run = 1; $run -le 3; $run++) {
  Write-Host "Starting W1 live API E2E run $run of 3."
  & (Join-Path $PSScriptRoot 'reset-w1-test-state.ps1') -ErrorAction SilentlyContinue
  Get-Process CyFast.Windows.Agent,CyFast.Windows.SessionHost,CyFast.Windows.TestFixture -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'run-w1-live-api-e2e.ps1')
  $code = $LASTEXITCODE
  $results += [pscustomobject]@{ run = $run; exitCode = $code; passed = ($code -eq 0) }
  if ($code) { throw "W1 live API E2E run $run failed with exit $code." }
}
Write-Host 'All three W1 live API E2E runs passed.'
$results | ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot '.w1-run\e2e-thrice.json') -Encoding utf8
