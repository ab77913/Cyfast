# W1 secure WSS/mTLS E2E (TEST-ONLY CA via openssl + Node TLS client).
[CmdletBinding()]
param([int]$Runs = 3)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runDir = Join-Path $PSScriptRoot '.w1-run\wss-e2e'
$certDir = Join-Path $PSScriptRoot 'certs\.generated'
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$results = [System.Collections.Generic.List[object]]::new()

function Assert-True([bool]$Value, [string]$Name) {
  $results.Add([pscustomobject]@{ name = $Name; passed = [bool]$Value })
  if (-not $Value) { throw "FAIL $Name" }
  Write-Host "PASS $Name"
}

function Invoke-NodeTls([string]$Script) {
  $tmp = Join-Path $runDir ("tls-" + [guid]::NewGuid().ToString('N') + '.js')
  Set-Content -Path $tmp -Value $Script -Encoding utf8
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $out = & node $tmp 2>&1 | ForEach-Object { "$_" } | Out-String
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  Remove-Item $tmp -ErrorAction SilentlyContinue
  return @{ code = $code; text = $out.Trim() }
}

. (Join-Path $PSScriptRoot 'certs\_openssl.ps1')
$openssl = Get-W1OpenSsl
$env:Path = "$(Split-Path $openssl);$env:Path"
# Never allow insecure TLS for this secure transport proof.
Remove-Item Env:NODE_TLS_REJECT_UNAUTHORIZED -ErrorAction SilentlyContinue
$env:NODE_TLS_REJECT_UNAUTHORIZED = '1'

& (Join-Path $PSScriptRoot 'certs\remove-w1-test-certs.ps1') -OutDir $certDir
& (Join-Path $PSScriptRoot 'certs\new-w1-test-ca.ps1') -OutDir $certDir
& (Join-Path $PSScriptRoot 'certs\new-w1-gateway-cert.ps1') -OutDir $certDir
& (Join-Path $PSScriptRoot 'certs\new-w1-agent-cert.ps1') -OutDir $certDir -AgentId 'w1-test-agent'

Push-Location $root
try {
  $neg = & node -e "process.env.WINDOWS_ALLOW_DEV_SECRETS='true'; const {assertAgentTransportAllowed}=require('./apis/general_management/services/windows/windows-security-config'); try { assertAgentTransportAllowed({protocol:'ws', peerHost:'10.0.0.8', allowInsecureFlag:true}); console.log('FAIL'); process.exit(2);} catch(e){ console.log(e.code||e.message); }"
  Assert-True ([bool]($neg -match 'INSECURE_TRANSPORT_REJECTED')) 'Reject insecure non-loopback ws'

  $prodFail = & node -e "process.env.AGENT_GATEWAY_REQUIRE_TLS='true'; delete process.env.AGENT_GATEWAY_TLS_KEY_PATH; delete process.env.AGENT_GATEWAY_TLS_CERT_PATH; try { require('./apis/agent_gateway/config'); console.log('FAIL'); process.exit(2);} catch(e){ console.log(e.code||e.message); }"
  Assert-True ([bool]($prodFail -match 'CONFIGURATION_ERROR|requires AGENT_GATEWAY_TLS')) 'Production startup fails without TLS config'
} finally { Pop-Location }

$ca = (Join-Path $certDir 'w1-test-ca.cert.pem').Replace('\','/')
$gatewayCert = (Join-Path $certDir 'w1-gateway.cert.pem').Replace('\','/')
$gatewayKey = (Join-Path $certDir 'w1-gateway.key.pem').Replace('\','/')
$agentCert = (Join-Path $certDir 'w1-agent.cert.pem').Replace('\','/')
$agentKey = (Join-Path $certDir 'w1-agent.key.pem').Replace('\','/')

for ($i = 1; $i -le $Runs; $i++) {
  Write-Host "WSS run $i/$Runs"
  $securePort = 8095
  Get-NetTCPConnection -LocalPort $securePort -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep 1
  $env:WINDOWS_ALLOW_DEV_SECRETS = 'true'
  $env:ALLOW_INSECURE_LOCAL_TRANSPORT = 'false'
  $env:WINDOWS_INTERNAL_API_TOKEN = 'DEV-ONLY-WINDOWS-INTERNAL-TOKEN'
  $env:AGENT_GATEWAY_JWT_SECRET = 'DEV-ONLY-ROTATE-AGENT-GATEWAY-JWT-SECRET'
  $env:GENERAL_MANAGEMENT_URL = 'http://127.0.0.1:8088'
  $env:AGENT_GATEWAY_PORT = "$securePort"
  $env:AGENT_GATEWAY_TLS_KEY_PATH = (Join-Path $certDir 'w1-gateway.key.pem')
  $env:AGENT_GATEWAY_TLS_CERT_PATH = (Join-Path $certDir 'w1-gateway.cert.pem')
  $env:AGENT_GATEWAY_TLS_CA_PATH = (Join-Path $certDir 'w1-test-ca.cert.pem')
  $env:AGENT_GATEWAY_TLS_REQUIRE_CLIENT_CERT = 'true'
  $env:AGENT_GATEWAY_REQUIRE_TLS = 'true'
  $log = Join-Path $runDir "gateway-secure-$i.out.log"
  $errLog = Join-Path $runDir "gateway-secure-$i.err.log"
  $proc = Start-Process -FilePath node -ArgumentList 'index.js' -WorkingDirectory (Join-Path $root 'apis\agent_gateway') -RedirectStandardOutput $log -RedirectStandardError $errLog -PassThru -WindowStyle Hidden
  Start-Sleep 4
  try {
    $ok = Invoke-NodeTls @"
const https=require('https'); const fs=require('fs');
const opts={ca:fs.readFileSync('$ca'),cert:fs.readFileSync('$agentCert'),key:fs.readFileSync('$agentKey'),servername:'localhost',rejectUnauthorized:true};
https.get('https://127.0.0.1:$securePort/health',opts,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{console.log(d); process.exit(res.statusCode===200&&d.includes('"ok":true')?0:2);});}).on('error',e=>{console.error(e.message); process.exit(2);});
"@
    Assert-True ($ok.code -eq 0) "WSS health with client cert run $i"

    $badTrust = Invoke-NodeTls @"
const https=require('https'); const fs=require('fs');
const opts={ca:fs.readFileSync('$gatewayCert'),cert:fs.readFileSync('$agentCert'),key:fs.readFileSync('$agentKey'),servername:'localhost',rejectUnauthorized:true};
https.get('https://127.0.0.1:$securePort/health',opts,res=>{process.exit(2);}).on('error',e=>{console.log(e.code||e.message); process.exit(0);});
"@
    Assert-True ($badTrust.code -eq 0) "Untrusted/invalid server trust rejected run $i"

    $badHost = Invoke-NodeTls @"
const https=require('https'); const fs=require('fs');
const opts={ca:fs.readFileSync('$ca'),cert:fs.readFileSync('$agentCert'),key:fs.readFileSync('$agentKey'),servername:'wrong.host.invalid',rejectUnauthorized:true};
https.get('https://127.0.0.1:$securePort/health',opts,res=>{process.exit(2);}).on('error',e=>{console.log(e.code||e.message); process.exit(0);});
"@
    Assert-True ($badHost.code -eq 0) "Hostname mismatch rejected run $i"

    $noClient = Invoke-NodeTls @"
const https=require('https'); const fs=require('fs');
const opts={ca:fs.readFileSync('$ca'),servername:'localhost',rejectUnauthorized:true};
https.get('https://127.0.0.1:$securePort/health',opts,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{console.log('unexpected',d); process.exit(2);});}).on('error',e=>{console.log(e.code||e.message); process.exit(0);});
"@
    Assert-True ($noClient.code -eq 0) "Missing client certificate rejected run $i"
  } finally {
    if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  }
}

& (Join-Path $PSScriptRoot 'certs\remove-w1-test-certs.ps1') -OutDir $certDir
$report = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  runs = $Runs
  passed = (@($results | Where-Object passed).Count -eq $results.Count)
  checks = $results
}
$report | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $root 'docs\windows\W1_WSS_E2E.json') -Encoding utf8
@(
  '# W1 WSS E2E',
  '',
  "Result: $(if($report.passed){'PASS'}else{'FAIL'}) ($Runs runs)",
  ''
) + ($results | ForEach-Object { "- $(if($_.passed){'PASS'}else{'FAIL'}) $($_.name)" }) |
  Set-Content (Join-Path $root 'docs\windows\W1_WSS_E2E.md') -Encoding utf8
if (-not $report.passed) { exit 1 }
Write-Host 'WSS E2E complete.'
