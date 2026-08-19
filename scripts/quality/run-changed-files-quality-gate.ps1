# Changed-files quality gate vs base commit.
[CmdletBinding()]
param([string]$BaseCommit = '6be343e')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runDir = Join-Path $PSScriptRoot '.run'
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
Push-Location $root
try {
  $files = @(git diff --name-only "$BaseCommit...HEAD" --)
  $w1Ui = @(
    $files | Where-Object {
      $_ -match '^ui/src/(views/windows-nodes|utils/windowsApi|utils/cyfastAxios|contexts/JWTContext|layouts/AdminLayout/NavBar/NavMiddleTabs|utils/locales|menu-items|routes)'
    }
  )
  $dirtyUi = @(
    git status --porcelain -- 'ui/src/views/windows-nodes' 'ui/src/utils/windowsApi.js' 'ui/src/utils/cyfastAxios.jsx' |
      ForEach-Object { ($_ -replace '^...', '').Trim() }
  )
  $checkUi = @($w1Ui + $dirtyUi | Select-Object -Unique | Where-Object { $_ -match '\.(js|jsx|mjs)$' })
  $errors = @()
  if ($checkUi.Count -gt 0) {
    Push-Location ui
    try {
      $eslintTargets = @($checkUi | ForEach-Object { $_ -replace '^ui/', '' })
      $prev = $ErrorActionPreference
      $ErrorActionPreference = 'Continue'
      & npx eslint @eslintTargets 2>&1 | Tee-Object (Join-Path $runDir 'eslint-w1.txt') | Out-Null
      if ($LASTEXITCODE) { $errors += "eslint exit $LASTEXITCODE" }
      $ErrorActionPreference = $prev
    } finally { Pop-Location }
  }

  Push-Location ui
  try {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    npm run lint 2>&1 | Tee-Object (Join-Path $runDir 'eslint-full.txt') | Out-Null
    $fullExit = $LASTEXITCODE
    $ErrorActionPreference = $prev
  } finally { Pop-Location }

  $head = (git rev-parse HEAD).Trim()
  $status = if ($errors.Count -eq 0) { 'PASS' } else { 'FAIL' }
  $report = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    baseCommit = $BaseCommit
    head = $head
    changedSourceFiles = $files.Count
    w1UiFilesChecked = $checkUi
    status = $status
    errors = $errors
    fullRepoLintExit = $fullExit
    note = 'Full-repo lint may contain pre-existing legacy debt unrelated to W1.'
  }
  $report | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $root 'docs\windows\W1_LINT_BASELINE.json') -Encoding utf8

  $md = New-Object System.Collections.Generic.List[string]
  [void]$md.Add('# W1 Lint Baseline')
  [void]$md.Add('')
  [void]$md.Add(("Base: {0}" -f $BaseCommit))
  [void]$md.Add(("HEAD: {0}" -f $head))
  [void]$md.Add(("Changed-files W1 UI eslint: **{0}**" -f $status))
  [void]$md.Add(("Full-repo npm run lint exit: **{0}** (legacy debt may predate W1)" -f $fullExit))
  [void]$md.Add('')
  [void]$md.Add('## W1 UI files checked')
  [void]$md.Add('')
  foreach ($f in $checkUi) { [void]$md.Add("- $f") }
  $md | Set-Content (Join-Path $root 'docs\windows\W1_LINT_BASELINE.md') -Encoding utf8

  if ($errors.Count) { exit 1 }
  Write-Host ("Changed-files quality gate {0}; full lint exit={1}" -f $status, $fullExit)
} finally { Pop-Location }
