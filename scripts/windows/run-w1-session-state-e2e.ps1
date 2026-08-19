# Dedicated Windows VM session-state E2E.
# Requires env: W1_SESSION_VM_ENDPOINT, W1_SESSION_VM_USER_REF, W1_SESSION_VM_SNAPSHOT
# Does NOT run destructive lock tests on the developer desktop.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$reportJson = Join-Path $root 'docs\windows\W1_SESSION_STATE_E2E.json'
$reportMd = Join-Path $root 'docs\windows\W1_SESSION_STATE_E2E.md'

$endpoint = $env:W1_SESSION_VM_ENDPOINT
$snapshot = $env:W1_SESSION_VM_SNAPSHOT
$userRef = $env:W1_SESSION_VM_USER_REF

if (-not $endpoint -or -not $snapshot -or -not $userRef) {
  $blocked = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    status = 'BLOCKED'
    reason = 'No dedicated Windows session VM configured. Set W1_SESSION_VM_ENDPOINT, W1_SESSION_VM_SNAPSHOT, and W1_SESSION_VM_USER_REF. Hyper-V Get-VM was unavailable on this host.'
    lockedSession = 'BLOCKED'
    disconnectedSession = 'BLOCKED'
  }
  $blocked | ConvertTo-Json -Depth 5 | Set-Content $reportJson -Encoding utf8
  @(
    '# W1 Session State E2E',
    '',
    '**BLOCKED** — dedicated Windows VM not configured/available.',
    '',
    $blocked.reason
  ) | Set-Content $reportMd -Encoding utf8
  Write-Host $blocked.reason
  exit 2
}

throw 'VM automation provider wiring is configured via environment references but not implemented for this lab host. Keep READY_FOR_W2=false until a dedicated VM provider adapter is available.'
