# Final W1 readiness orchestrator. Returns 0 only when every mandatory item passes.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$runDir = Join-Path $PSScriptRoot ".w1-run\final-readiness-$stamp"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$checks = [System.Collections.Generic.List[object]]::new()

function Run-Check([string]$Id, [string]$Name, [scriptblock]$Action, [bool]$Mandatory = $true) {
  $started = Get-Date
  $status = 'PASS'
  $exitCode = 0
  $detail = ''
  $log = Join-Path $runDir "$Id.log"
  try {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $Action *>&1 | Tee-Object $log | Out-Null
    $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
    $ErrorActionPreference = $prev
    if ($exitCode -ne 0) {
      if ($exitCode -eq 2 -or (Select-String -Path $log -Pattern 'BLOCKED' -Quiet -ErrorAction SilentlyContinue)) {
        $status = 'BLOCKED'
        $detail = "exit $exitCode BLOCKED"
      } else {
        $status = 'FAIL'
        $detail = "exit $exitCode"
      }
    }
  } catch {
    $status = if ($_.Exception.Message -match 'BLOCKED') { 'BLOCKED' } else { 'FAIL' }
    $exitCode = 1
    $detail = $_.Exception.Message
    Set-Content -Path $log -Value $detail -Encoding utf8
  }
  $checks.Add([pscustomobject]@{
      id = $Id; name = $Name; mandatory = $Mandatory; status = $status; exitCode = $exitCode
      detail = $detail; durationMs = [int]((Get-Date) - $started).TotalMilliseconds; log = $log
    })
  Write-Host ("{0} {1}" -f $status, $Name)
  if ($Mandatory -and $status -ne 'PASS') {
    throw ("Mandatory check failed: {0} ({1}) {2}" -f $Name, $status, $detail)
  }
}

Push-Location $root
try {
  Run-Check 'clean-tree-start' 'Repository cleanliness (advisory at start)' {
    if (git status --porcelain) { Write-Host 'dirty working tree noted' }
  } -Mandatory $false
  Run-Check 'gm-unit' 'General Management Windows tests' {
    Push-Location apis\general_management
    node --test tests\windows\windows-w1.test.js
    $code = $LASTEXITCODE
    Pop-Location
    if ($code) { throw "General Management tests exited $code" }
  }
  Run-Check 'ag-unit' 'Agent Gateway tests' {
    Push-Location apis\agent_gateway
    node --test tests\gateway.test.js
    $code = $LASTEXITCODE
    Pop-Location
    if ($code) { throw "Agent Gateway tests exited $code" }
  }
  Run-Check 'quality' 'Changed-files quality gate' {
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\quality\run-changed-files-quality-gate.ps1
    if ($LASTEXITCODE) { throw "Changed-files quality exited $LASTEXITCODE" }
  }
  Run-Check 'pipeline' 'Existing CyFAST pipeline regression 3/3' {
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\regression\run-existing-cyfast-pipeline.ps1
    if ($LASTEXITCODE) { throw "Existing pipeline regression exited $LASTEXITCODE" }
  }
  Run-Check 'wss' 'WSS/mTLS E2E 3/3' {
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\run-w1-wss-e2e.ps1 -Runs 3
    if ($LASTEXITCODE) { throw "WSS/mTLS E2E exited $LASTEXITCODE" }
  }
  Run-Check 'session-vm' 'Dedicated VM session-state E2E' {
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\run-w1-session-state-e2e.ps1
    if ($LASTEXITCODE -eq 2) { throw 'BLOCKED: dedicated VM session-state E2E is not configured' }
    if ($LASTEXITCODE) { throw "Dedicated VM session-state E2E exited $LASTEXITCODE" }
  }
} catch {
  Write-Host $_.Exception.Message
} finally {
  Pop-Location
}

$mandatory = @($checks | Where-Object mandatory)
$passed = @($mandatory | Where-Object status -eq 'PASS').Count
$failed = @($mandatory | Where-Object status -eq 'FAIL').Count
$blocked = @($mandatory | Where-Object status -eq 'BLOCKED').Count
$ready = ($failed -eq 0 -and $blocked -eq 0 -and $passed -eq $mandatory.Count)
$commit = (git -C $root rev-parse HEAD).Trim()
$report = [ordered]@{
  branch = 'feature/windows-connect-w1'
  baseCommit = '6be343e'
  commit = $commit
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  runDir = $runDir
  mandatoryChecks = @{ total = $mandatory.Count; passed = $passed; failed = $failed; blocked = $blocked }
  checks = @{
    windowsUnitTests = ($checks | Where-Object id -eq 'gm-unit' | Select-Object -First 1)
    agentGatewayTests = ($checks | Where-Object id -eq 'ag-unit' | Select-Object -First 1)
    existingPipelineRegression = ($checks | Where-Object id -eq 'pipeline' | Select-Object -First 1)
    wssMtls = ($checks | Where-Object id -eq 'wss' | Select-Object -First 1)
    sessionStateVm = ($checks | Where-Object id -eq 'session-vm' | Select-Object -First 1)
    changedFilesQuality = ($checks | Where-Object id -eq 'quality' | Select-Object -First 1)
  }
  allChecks = $checks
  readyForW2 = [bool]$ready
  productionGaReady = $false
  legacyDebt = @(
    'Full-repo UI prettier/eslint failures predate W1 in many non-Windows files (see W1_LINT_BASELINE.json fullRepoLintExit)'
  )
  remainingProductionGaItems = @(
    'Dedicated locked/disconnected Windows VM lab proof',
    'Production CA operations / certificate rotation runbooks',
    'Deep document-to-execution golden path with seeded agents when available'
  )
}
$report | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $root 'docs\windows\W1_ACCEPTANCE_REPORT.json') -Encoding utf8
$report | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $root 'docs\windows\W1_READINESS.json') -Encoding utf8
$lines = New-Object System.Collections.Generic.List[string]
[void]$lines.Add('# W1 Acceptance / Readiness Report')
[void]$lines.Add('')
[void]$lines.Add(("Commit: {0}" -f $commit))
[void]$lines.Add(("READY_FOR_W2={0}" -f $ready.ToString().ToLower()))
[void]$lines.Add(("PRODUCTION_GA_READY=false"))
[void]$lines.Add('')
[void]$lines.Add(("Mandatory: passed={0} failed={1} blocked={2} total={3}" -f $passed, $failed, $blocked, $mandatory.Count))
[void]$lines.Add('')
[void]$lines.Add('| Id | Name | Status | Detail |')
[void]$lines.Add('|---|---|---|---|')
foreach ($c in $checks) {
  [void]$lines.Add(("| {0} | {1} | {2} | {3} |" -f $c.id, $c.name, $c.status, ($c.detail -replace '\|', '/')))
}
$lines | Set-Content (Join-Path $root 'docs\windows\W1_ACCEPTANCE_REPORT.md') -Encoding utf8
Copy-Item (Join-Path $root 'docs\windows\W1_ACCEPTANCE_REPORT.md') (Join-Path $root 'docs\windows\W1_READINESS.md') -Force
if (-not $ready) { exit 1 }
