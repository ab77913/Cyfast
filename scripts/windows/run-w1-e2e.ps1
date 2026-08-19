[CmdletBinding()]
param([string]$GatewayUrl = 'http://127.0.0.1:8080')

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runDir = Join-Path $PSScriptRoot '.w1-run'
$jsonPath = Join-Path $root 'docs\windows\W1_ACCEPTANCE_REPORT.json'
$mdPath = Join-Path $root 'docs\windows\W1_ACCEPTANCE_REPORT.md'
$checks = [System.Collections.Generic.List[object]]::new()
$gm = "$GatewayUrl/services/general-management"
$um = "$GatewayUrl/services/user-management"
function Check([string]$Name, [scriptblock]$Action) {
  try { & $Action; $checks.Add([pscustomobject]@{ step=$checks.Count+1; name=$Name; passed=$true; detail='Passed' }) }
  catch { $checks.Add([pscustomobject]@{ step=$checks.Count+1; name=$Name; passed=$false; detail=$_.Exception.Message }) }
}
function Api([string]$Method, [string]$Url, $Body, [hashtable]$Headers) {
  $params = @{ Method=$Method; Uri=$Url; ContentType='application/json'; TimeoutSec=20 }
  if ($null -ne $Body) { $params.Body = $Body | ConvertTo-Json -Depth 12 -Compress }
  if ($Headers) { $params.Headers = $Headers }
  Invoke-RestMethod @params
}
function Wait-Until([string]$Name, [scriptblock]$Predicate, [int]$Seconds = 45) {
  $end = (Get-Date).AddSeconds($Seconds)
  do { try { $value = & $Predicate; if ($value) { return $value } } catch {}; Start-Sleep 2 } while ((Get-Date) -lt $end)
  throw "Timed out waiting for $Name."
}
function Write-Report {
  $passed = @($checks | Where-Object passed).Count
  $report = [ordered]@{ generated_at=(Get-Date).ToUniversalTime().ToString('o'); gateway_url=$GatewayUrl; total=$checks.Count; passed=$passed; failed=$checks.Count-$passed; passed_all=($passed -eq $checks.Count); checks=$checks }
  $report | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $jsonPath
  @('# W1 Acceptance Report','',"Generated: $($report.generated_at)",'',"Result: **$passed/$($checks.Count) checks passed**",'','| # | Check | Result | Detail |','|---:|---|---|---|') +
    ($checks | ForEach-Object { "| $($_.step) | $($_.name) | $(if ($_.passed){'PASS'}else{'FAIL'}) | $($_.detail -replace '\|','/') |" }) |
    Set-Content -Encoding utf8 $mdPath
  return $report
}

$agentProcess = $null; $hostProcess = $null
try {
  Check 'Prerequisites' { & (Join-Path $PSScriptRoot 'test-w1-prerequisites.ps1') }
  Check 'API gateway health' { (Invoke-RestMethod "$GatewayUrl/health" -TimeoutSec 5).status -eq 'ok' -or (throw 'Gateway health response was invalid.') }
  Check 'Bootstrap deterministic local W1 admin password' {
    $password = 'W1-Local-Admin!2026'
    Push-Location (Join-Path $root 'apis\user_management')
    try { $hash = & node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" $password }
    finally { Pop-Location }
    if ($LASTEXITCODE -or -not $hash) { throw 'Could not generate bcrypt password hash with user-management dependencies.' }
    $sql = "UPDATE user SET password_hash='$hash' WHERE email='admin@cyient.com';"
    $sql | & docker exec -i cyfast-w1-mysql mysql -uroot -proot cyfast3
    if ($LASTEXITCODE) { throw 'Could not update W1 seed admin password.' }
  }
  $auth = $null
  Check 'Login through API Gateway' {
    $auth = Api POST "$um/auth/login" @{ email='admin@cyient.com'; password='W1-Local-Admin!2026' } $null
    if (-not $auth.accessToken) { throw 'Login returned no access token.' }
  }
  if (-not $auth) { throw 'Cannot continue the API flow because gateway login failed.' }
  $headers = @{ Authorization = "Bearer $($auth.accessToken)" }
  Check 'Bootstrap W1 permissions' { Api POST "$gm/windows_permissions/bootstrap" @{} $headers | Out-Null }
  $enrollment = $null
  Check 'Create enrollment token' {
    $enrollment = Api POST "$gm/agent_enrollments" @{ expires_at=(Get-Date).ToUniversalTime().AddMinutes(10).ToString('o'); allowed_platform='windows' } $headers
    if (-not $enrollment.token) { throw 'Enrollment endpoint returned no token.' }
  }
  Check 'Build agent, session host, and fixture' {
    & dotnet build 'windows\CyFast.Windows.sln' --nologo
    if ($LASTEXITCODE) { throw 'Windows solution build failed.' }
  }
  Check 'Start interactive SessionHost and enrolled Agent' {
    $env:Agent__AgentGatewayUrl = 'ws://127.0.0.1:8094/'
    $env:Agent__ControlPlaneUrl = 'http://127.0.0.1:8088/'
    $env:Agent__AllowInsecureLocalTransport = 'true'
    $env:Agent__EnrollmentToken = $enrollment.token
    $env:Agent__Organization = '1'
    $hostProcess = Start-Process dotnet -WorkingDirectory $root -ArgumentList 'run','--no-build','--project','windows/src/CyFast.Windows.SessionHost/CyFast.Windows.SessionHost.csproj' -PassThru -RedirectStandardOutput (Join-Path $runDir 'session-host.log') -RedirectStandardError (Join-Path $runDir 'session-host.error.log')
    $agentProcess = Start-Process dotnet -WorkingDirectory $root -ArgumentList 'run','--no-build','--project','windows/src/CyFast.Windows.Agent/CyFast.Windows.Agent.csproj' -PassThru -RedirectStandardOutput (Join-Path $runDir 'agent.log') -RedirectStandardError (Join-Path $runDir 'agent.error.log')
  }
  $node = $null
  Check 'Agent enrollment and online heartbeat' {
    $node = Wait-Until 'enrolled online node' { @((Api GET "$gm/windows_nodes" $null $headers) | Where-Object { $_.status -eq 'ONLINE' }) | Select-Object -First 1 }
    if (-not $node) { throw 'No ONLINE node.' }
  }
  $profile = $null
  Check 'Create fixture application profile' {
    $fixture = Join-Path $root 'windows\tests\fixtures\CyFast.Windows.TestFixture\bin\Debug\net9.0-windows\CyFast.Windows.TestFixture.exe'
    if (-not (Test-Path $fixture)) { throw "Fixture executable missing: $fixture" }
    $profile = Api POST "$gm/windows_application_profiles" @{ name='W1 E2E Fixture'; executable_path=$fixture; allowlist=@($fixture); configuration=@{ expected_process_name='CyFast.Windows.TestFixture'; allow_terminate=$true } } $headers
  }
  $session = $null
  Check 'Create interactive session' { $session = Api POST "$gm/windows_nodes/$($node.windows_node_id)/sessions" @{ application_profile_id=$profile.windows_application_profile_id } $headers }
  $commands = @()
  function Issue([string]$Path, $Payload) { $commands += Api POST "$gm/windows_sessions/$($session.interactive_session_id)/$Path" @{ payload=$Payload } $headers }
  Check 'Launch fixture and inspect UI' {
    Issue 'launch' @{ id="$($profile.windows_application_profile_id)"; executablePath=$profile.executable_path; allowUncPaths=$false }
    Start-Sleep 2
    Issue 'inspect' @{}
  }
  Check 'Execute fixture actions' {
    Issue 'actions' @{ action='set_value'; automationId='CyFastFixture.TextInput'; value='W1-E2E' }
    Issue 'actions' @{ action='select'; automationId='CyFastFixture.ComboBox'; value='Two' }
    Issue 'actions' @{ automationId='CyFastFixture.ActionButton' }
  }
  Check 'Capture screenshot command and persisted evidence' {
    Issue 'screenshots' @{}
    Wait-Until 'command result' { (Api GET "$gm/windows_sessions/$($session.interactive_session_id)" $null $headers) | Out-Null } 10 | Out-Null
    $evidence = Api GET "$gm/windows_sessions/$($session.interactive_session_id)/evidence" $null $headers
    if (-not @($evidence).Count) { throw 'No persisted evidence was returned. W1 screenshot persistence is not implemented by the agent/control-plane contract.' }
  }
  Check 'Reject enrollment-token reuse' {
    try { Api POST "$GatewayUrl/services/agent-gateway/v1/enroll" @{ token=$enrollment.token; agent_id=[guid]::NewGuid().ToString('N'); public_key='invalid'; agent_version='e2e'; os='windows'; architecture='x64' } $null | Out-Null; throw 'Enrollment token reuse unexpectedly succeeded.' }
    catch { if ($_.Exception.Message -match 'unexpectedly succeeded') { throw }; if ($_.Exception.Response.StatusCode.value__ -notin 400,401,409,500) { throw } }
  }
} finally {
  if ($hostProcess -and -not $hostProcess.HasExited) { Stop-Process -Id $hostProcess.Id -Force }
  if ($agentProcess -and -not $agentProcess.HasExited) { Stop-Process -Id $agentProcess.Id -Force }
  $report = Write-Report
  Write-Host "Wrote $jsonPath and $mdPath"
}
if (-not $report.passed_all) { exit 1 }
