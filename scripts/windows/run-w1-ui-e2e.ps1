[CmdletBinding()]
param([string]$UiUrl = 'http://127.0.0.1:3000')

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ui = Join-Path $root 'ui'
$runDir = Join-Path $PSScriptRoot '.w1-run'
$artifactDir = Join-Path $runDir 'ui-e2e'
$logDir = Join-Path $runDir 'logs'
New-Item -ItemType Directory -Force -Path $artifactDir, $logDir | Out-Null

Write-Host 'Preparing W1 API baseline (node ONLINE + fixture profile)...'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'run-w1-live-api-e2e.ps1')
if ($LASTEXITCODE) { throw "API baseline E2E failed: $LASTEXITCODE" }

# Re-enroll agent for interactive UI after E2E process cleanup.
$sessionHost = Join-Path $root 'windows\src\CyFast.Windows.SessionHost\bin\Debug\net9.0-windows\CyFast.Windows.SessionHost.exe'
if (-not (Test-Path $sessionHost)) { $sessionHost = Join-Path $root 'windows\src\CyFast.Windows.SessionHost\bin\Debug\net9.0\CyFast.Windows.SessionHost.exe' }
$agentDllDir = Join-Path $root 'windows\src\CyFast.Windows.Agent\bin\Debug\net9.0-windows'
Get-Process CyFast.Windows.Agent,CyFast.Windows.SessionHost,CyFast.Windows.TestFixture -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Process -FilePath $sessionHost -WindowStyle Hidden | Out-Null
Remove-Item (Join-Path $env:LOCALAPPDATA 'CyFast\identity.bin') -ErrorAction SilentlyContinue

$fixture = Join-Path $root 'windows\tests\fixtures\CyFast.Windows.TestFixture\bin\Debug\net9.0-windows\CyFast.Windows.TestFixture.exe'
$prepareJs = @'
const http=require('http'); const {spawn}=require('child_process'); const fs=require('fs'); const path=require('path');
function req(method,url,headers,body){return new Promise((resolve,reject)=>{const u=new URL(url);const data=body?JSON.stringify(body):null;const r=http.request({hostname:u.hostname,port:u.port,path:u.pathname+u.search,method,headers:{'Content-Type':'application/json',...(headers||{}),...(data?{'Content-Length':Buffer.byteLength(data)}:{})}},res=>{let b='';res.on('data',d=>b+=d);res.on('end',()=>resolve({status:res.statusCode,body:b,json:(()=>{try{return JSON.parse(b)}catch{return null}})()}));});r.on('error',reject); if(data)r.write(data); r.end();});}
(async()=>{
  const root=process.argv[2]; const agentDir=process.argv[3]; const fixture=process.argv[4];
  const login=await req('POST','http://127.0.0.1:8087/auth/login',{},{email:'admin@cyient.com',password:'W1-Test-Admin!234'});
  if(!login.json?.accessToken) throw new Error('login failed '+login.body);
  const h={Authorization:'Bearer '+login.json.accessToken,'x-user-id':String(login.json.user.user_id),'x-organization-id':'1'};
  await req('POST','http://127.0.0.1:8080/services/general-management/windows_permissions/bootstrap',h,{assignToRoleName:'Super Admin'});
  const created=await req('POST','http://127.0.0.1:8080/services/general-management/agent_enrollments',h,{expires_at:new Date(Date.now()+3600e3).toISOString(),allowed_platform:'windows'});
  if(!created.json?.token) throw new Error('token failed '+created.body);
  const profile=await req('POST','http://127.0.0.1:8080/services/general-management/windows_application_profiles',h,{
    name:'W1 UI Fixture', executable_path:fixture, project_id:1, allowlist:[fixture],
    configuration:{allow_terminate:true, expected_process_name:'CyFast.Windows.TestFixture', allow_unc_paths:false}
  });
  console.log('profile', profile.status, profile.json?.windows_application_profile_id);
  const ag=spawn(path.join(agentDir,'CyFast.Windows.Agent.exe'),[],{cwd:agentDir,env:{...process.env,Agent__ControlPlaneUrl:'http://127.0.0.1:8088/',Agent__AgentGatewayUrl:'ws://127.0.0.1:8094/',Agent__Organization:'1',Agent__EnrollmentToken:created.json.token,Agent__AllowInsecureLocalTransport:'true'},detached:true,stdio:'ignore'});
  ag.unref();
  for(let i=0;i<30;i++){
    await new Promise(r=>setTimeout(r,2000));
    const nodes=await req('GET','http://127.0.0.1:8088/windows_nodes',h);
    const online=(Array.isArray(nodes.json)?nodes.json:[]).find(n=>n.status==='ONLINE'||n.status==='READY');
    if(online){ console.log('ONLINE', online.windows_node_id); process.exit(0);} 
    console.log('waiting', i);
  }
  throw new Error('agent did not come ONLINE for UI E2E');
})().catch(e=>{console.error(e); process.exit(1);});
'@
$prepareFile = Join-Path $artifactDir 'prepare-ui-agent.js'
Set-Content -Path $prepareFile -Value $prepareJs -Encoding utf8
& node $prepareFile $root $agentDllDir $fixture
if ($LASTEXITCODE) { throw 'Could not prepare ONLINE agent for UI E2E.' }

$listening = Get-NetTCPConnection -LocalPort ([uri]$UiUrl).Port -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','set VITE_WINDOWS_AUTOMATION_ENABLED=true&& npm start -- --host 127.0.0.1 --port 3000' -WorkingDirectory $ui -RedirectStandardOutput (Join-Path $logDir 'ui.out.log') -RedirectStandardError (Join-Path $logDir 'ui.err.log') -WindowStyle Hidden | Out-Null
  $deadline = (Get-Date).AddSeconds(120)
  do {
    try { Invoke-WebRequest -Uri $UiUrl -UseBasicParsing -TimeoutSec 3 | Out-Null; break } catch { Start-Sleep 3 }
  } while ((Get-Date) -lt $deadline)
}

Push-Location $ui
try {
  if (-not (Test-Path 'node_modules\@playwright\test')) { throw 'Playwright missing. Run npm ci in ui/.' }
  & npx playwright install chromium
  $env:W1_UI_URL = $UiUrl
  $env:W1_E2E_EMAIL = 'admin@cyient.com'
  $env:W1_E2E_PASSWORD = 'W1-Test-Admin!234'
  $env:W1_UI_ARTIFACT_DIR = $artifactDir
  & npm run test:windows-e2e
  if ($LASTEXITCODE) { throw "Windows Playwright E2E failed with exit $LASTEXITCODE." }
} finally { Pop-Location }
