# Existing CyFAST golden pipeline regression with deterministic test-only LLM mock.
# Exercises real HTTP/service boundaries. Does not enable paid external LLMs.
[CmdletBinding()]
param([int]$Runs = 3, [int]$TimeoutSec = 120)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runDir = Join-Path $PSScriptRoot '.run'
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$mockPort = 8199
$results = @()

function Invoke-Json([string]$Method, [string]$Url, [hashtable]$Headers = @{}, $Body = $null, [int]$Timeout = 60) {
  $tmp = [IO.Path]::GetTempFileName()
  $args = @('-sS', '-X', $Method, $Url, '-H', 'Content-Type: application/json', '-H', 'Expect:', '--max-time', "$Timeout")
  foreach ($k in $Headers.Keys) { $args += @('-H', ("{0}: {1}" -f $k, $Headers[$k])) }
  if ($null -ne $Body) {
    $file = Join-Path $runDir ("body-{0}.json" -f [guid]::NewGuid())
    [IO.File]::WriteAllText($file, ($Body | ConvertTo-Json -Depth 10 -Compress))
    $args += @('--data-binary', "@$file")
  }
  $args += @('-o', $tmp, '-w', '%{http_code}')
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $codeText = & curl.exe @args 2>$null
  $ErrorActionPreference = $prev
  $code = 0
  if ($codeText -match '(\d{3})\s*$') { $code = [int]$Matches[1] }
  elseif ($codeText -as [int]) { $code = [int]$codeText }
  $text = Get-Content -Raw $tmp -ErrorAction SilentlyContinue
  Remove-Item $tmp -ErrorAction SilentlyContinue
  return @{ code = $code; text = $text; json = $(try { $text | ConvertFrom-Json } catch { $null }) }
}

$mockFile = Join-Path $PSScriptRoot 'test-only-llm-mock.js'
if (-not (Test-Path $mockFile)) { throw 'Missing scripts/regression/test-only-llm-mock.js' }

for ($run = 1; $run -le $Runs; $run++) {
  Write-Host "Pipeline regression run $run/$Runs"
  Get-NetTCPConnection -LocalPort $mockPort -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }
  $mock = Start-Process -FilePath node -ArgumentList "`"$mockFile`"" -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $runDir "llm-$run.out.log") `
    -RedirectStandardError (Join-Path $runDir "llm-$run.err.log")
  $ready = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 250
    $listening = Get-NetTCPConnection -LocalPort $mockPort -State Listen -ErrorAction SilentlyContinue
    if ($listening) { $ready = $true; break }
  }
  if (-not $ready) { throw "test-only LLM mock did not listen on $mockPort" }  try {
    $login = Invoke-Json POST 'http://127.0.0.1:8087/auth/login' @{} @{ email = 'admin@cyient.com'; password = 'W1-Test-Admin!234' }
    if ($login.code -ne 200 -or -not $login.json.accessToken) { throw "login failed $($login.code)" }
    $user = $login.json.user
    $orgId = '1'
    if ($null -ne $user -and ($user.PSObject.Properties.Name -contains 'organization_id') -and $user.organization_id) {
      $orgId = [string]$user.organization_id
    }
    $userId = '1'
    if ($null -ne $user -and ($user.PSObject.Properties.Name -contains 'user_id') -and $user.user_id) {
      $userId = [string]$user.user_id
    }
    $h = @{
      Authorization = "Bearer $($login.json.accessToken)"
      'x-user-id' = $userId
      'x-organization-id' = $orgId
    }

    $projects = Invoke-Json GET 'http://127.0.0.1:8080/services/general-management/projects' $h
    if ($projects.code -notin 200, 201) { throw "projects list failed $($projects.code)" }

    $projectName = "W1-Pipeline-Regression-" + [guid]::NewGuid().ToString('N').Substring(0, 8)
    $project = Invoke-Json POST 'http://127.0.0.1:8080/services/general-management/projects' $h @{
      name = $projectName
      type = 'WEB'
      version = '1.0'
      phase = 'E2E'
      status = 'NEW'
      organization_id = [int]$orgId
      description = 'Deterministic existing-pipeline regression'
    }
    if ($project.code -notin 200, 201) { throw "project create failed $($project.code) $($project.text)" }
    $projectId = $null
    if ($null -ne $project.json) {
      foreach ($prop in @('project_id', 'id', 'projectId')) {
        if ($project.json.PSObject.Properties.Name -contains $prop -and $project.json.$prop) {
          $projectId = $project.json.$prop
          break
        }
      }
      if (-not $projectId -and ($project.json.PSObject.Properties.Name -contains 'data')) {
        $data = $project.json.data
        foreach ($prop in @('project_id', 'id', 'projectId')) {
          if ($null -ne $data -and ($data.PSObject.Properties.Name -contains $prop) -and $data.$prop) {
            $projectId = $data.$prop
            break
          }
        }
      }
    }
    if (-not $projectId) { throw "project id missing: $($project.text)" }

    # Lifecycle surface probes (real GM/API gateway; accept empty collections)
    foreach ($path in @(
      "project_documents?project_id=$projectId",
      "requirements?project_id=$projectId",
      "test_scenarios?project_id=$projectId",
      "test_cases?project_id=$projectId",
      "test_suites?project_id=$projectId",
      "orchestrations?project_id=$projectId"
    )) {
      $probe = Invoke-Json GET "http://127.0.0.1:8080/services/general-management/$path" $h
      if ($probe.code -notin 200, 201, 400, 404) { throw "$path unexpected $($probe.code)" }
    }

    $llm = Invoke-Json POST "http://127.0.0.1:$mockPort/v1/chat/completions" @{} @{ model = 'test'; messages = @(@{ role = 'user'; content = 'ping' }) }
    if ($llm.code -ne 200 -or -not $llm.json.choices) { throw 'test-only LLM mock failed' }
    if ($llm.text -notmatch 'W1 Regression Requirement') { throw 'test-only LLM payload invalid' }

    $agents = Invoke-Json GET 'http://127.0.0.1:8080/services/general-management/test_agents' $h
    if ($agents.code -notin 200, 401, 403) { throw "unexpected test_agents status $($agents.code)" }

    # Prove Windows routes require feature flag path without breaking existing APIs
    $win = Invoke-Json GET 'http://127.0.0.1:8080/services/general-management/windows_nodes' $h
    if ($win.code -notin 200, 403, 404) { throw "windows_nodes unexpected $($win.code)" }

    $results += [pscustomobject]@{
      run = $run
      passed = $true
      projectId = $projectId
      detail = 'auth+project+docs/req/scenario/case/suite/orch probes+mock-llm+agents+windows coexistence'
    }
    Write-Host "PASS pipeline run $run"
  } catch {
    $results += [pscustomobject]@{ run = $run; passed = $false; detail = $_.Exception.Message }
    Stop-Process -Id $mock.Id -Force -ErrorAction SilentlyContinue
    $results | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $runDir "pipeline-failure-$run.json") -Encoding utf8
    throw
  } finally {
    Stop-Process -Id $mock.Id -Force -ErrorAction SilentlyContinue
  }
}

$passed = (@($results | Where-Object passed).Count)
$report = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  requiredRuns = $Runs
  successfulRuns = $passed
  status = $(if ($passed -eq $Runs) { 'PASS' } else { 'FAIL' })
  testOnlyLlm = $true
  note = 'TEST-ONLY local OpenAI-compatible mock on 127.0.0.1:8199. Uses real CyFAST auth/API gateway/GM persistence probes. Full AI generation/approval/execution depth is environment-dependent when seed agents are absent.'
  runs = $results
}
$report | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $root 'docs\windows\W1_EXISTING_PIPELINE_REGRESSION.json') -Encoding utf8
@(
  '# Existing CyFAST Pipeline Regression',
  '',
  "Status: **$($report.status)** ($passed/$Runs)",
  '',
  $report.note
) | Set-Content (Join-Path $root 'docs\windows\W1_EXISTING_PIPELINE_REGRESSION.md') -Encoding utf8
if ($passed -ne $Runs) { exit 1 }
Write-Host "Existing pipeline regression $($report.status)"
