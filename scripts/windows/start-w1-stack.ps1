[CmdletBinding()]
param(
  [switch]$WithUi,
  [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runDir = Join-Path $PSScriptRoot '.w1-run'
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

& (Join-Path $PSScriptRoot 'test-w1-prerequisites.ps1')
Push-Location $root
try {
  & docker compose -f 'databases/docker-compose.w1.yml' up -d
  if ($LASTEXITCODE) { throw 'Docker compose failed.' }

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $mysql = (& docker inspect --format '{{.State.Health.Status}}' cyfast-w1-mysql 2>$null)
    $rabbit = (& docker inspect --format '{{.State.Health.Status}}' cyfast-w1-rabbitmq 2>$null)
    if ($mysql -eq 'healthy' -and $rabbit -eq 'healthy') { break }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  if ($mysql -ne 'healthy' -or $rabbit -ne 'healthy') { throw "Dependencies did not become healthy (mysql=$mysql, rabbit=$rabbit)." }

  # Track migrations explicitly so repeat runs are safe even for scripts without IF NOT EXISTS.
  & docker exec cyfast-w1-mysql mysql -uroot -proot cyfast3 -e 'CREATE TABLE IF NOT EXISTS w1_schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at DATETIME NOT NULL);'
  $migrationDir = Join-Path $root 'databases\MYSQL\cyfast2\2.0.0'
  $migrations = Get-ChildItem -Path $migrationDir -File -Filter '*.sql' |
    # The dedicated W1 image is initialized from the current 01_schema.sql,
    # which already contains the 04-07 schema. Replaying those historical,
    # non-idempotent ALTER/rename migrations breaks a clean W1 startup.
    Where-Object { $_.Name -match '^(08|09|10)_' -and $_.Name -notmatch '_down\.sql$' } |
    Sort-Object Name
  foreach ($migration in $migrations) {
    $escapedName = $migration.Name.Replace("'", "''")
    $applied = & docker exec cyfast-w1-mysql mysql -N -s -uroot -proot cyfast3 -e "SELECT COUNT(*) FROM w1_schema_migrations WHERE name='$escapedName';"
    if ([int]($applied | Select-Object -First 1) -gt 0) { Write-Host "Migration already applied: $($migration.Name)"; continue }
    Write-Host "Applying $($migration.Name)"
    Get-Content -Raw -Path $migration.FullName | & docker exec -i cyfast-w1-mysql mysql -uroot -proot cyfast3
    if ($LASTEXITCODE) { throw "Migration failed: $($migration.Name)" }
    & docker exec cyfast-w1-mysql mysql -uroot -proot cyfast3 -e "INSERT INTO w1_schema_migrations (name, applied_at) VALUES ('$escapedName', UTC_TIMESTAMP());"
  }

  $serviceEnvironment = @{
    WINDOWS_AUTOMATION_ENABLED = 'true'; WINDOWS_ALLOW_DEV_SECRETS = 'true'
    ALLOW_INSECURE_LOCAL_TRANSPORT = 'true'; WINDOWS_INTERNAL_API_TOKEN = 'DEV-ONLY-WINDOWS-INTERNAL-TOKEN'
    WINDOWS_ENROLLMENT_PEPPER = 'DEV-ONLY-WINDOWS-ENROLLMENT-PEPPER'
    AGENT_GATEWAY_JWT_SECRET = 'DEV-ONLY-ROTATE-AGENT-GATEWAY-JWT-SECRET'
    STORAGE_SERVICE_URL = 'http://127.0.0.1:8092'
    NODE_ENV = 'local'; MESSAGING_TYPE = 'rabbitmq'; DATABASE_TYPE_PRIMARY = 'mysql'; DATABASE_TYPE_SECONDARY = ''
  }
  function Start-W1Process(
    [string]$Name,
    [string]$WorkingDirectory,
    [string]$Command,
    [string[]]$Arguments,
    [hashtable]$EnvironmentOverrides = @{}
  ) {
    $log = Join-Path $runDir "$Name.log"
    $errorLog = Join-Path $runDir "$Name.error.log"
    foreach ($key in $serviceEnvironment.Keys) {
      [Environment]::SetEnvironmentVariable($key, $serviceEnvironment[$key], 'Process')
    }
    foreach ($key in $EnvironmentOverrides.Keys) {
      [Environment]::SetEnvironmentVariable($key, $EnvironmentOverrides[$key], 'Process')
    }
    # Native Start-Process redirection is reliable on Windows PowerShell 5.1;
    # async Process output callbacks can run without a PowerShell runspace.
    $process = Start-Process -FilePath $Command -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory `
      -RedirectStandardOutput $log -RedirectStandardError $errorLog -PassThru -WindowStyle Hidden
    if (-not $process) { throw "Could not start $Name." }
    return [pscustomobject]@{ name = $Name; pid = $process.Id; log = $log; error_log = $errorLog }
  }

  $services = @(
    @{ name = 'user_management'; path = 'apis\user_management'; environment = @{} },
    @{ name = 'storage_service'; path = 'apis\storage_service'; environment = @{} },
    @{ name = 'general_management'; path = 'apis\general_management'; environment = @{ DATABASE_TYPE_SECONDARY = 'mongodb' } },
    @{ name = 'agent_gateway'; path = 'apis\agent_gateway'; environment = @{} },
    @{ name = 'api_gateway'; path = 'apis\api_gateway'; environment = @{} }
  )
  $started = foreach ($service in $services) {
    $directory = Join-Path $root $service.path
    if (-not (Test-Path (Join-Path $directory 'node_modules'))) { throw "$($service.name) dependencies are missing at $directory. Install them before starting W1." }
    Start-W1Process $service.name $directory 'node' @('index.js') $service.environment
  }
  if ($WithUi) {
    $ui = Join-Path $root 'ui'
    $serviceEnvironment['VITE_WINDOWS_AUTOMATION_ENABLED'] = 'true'
    $started += Start-W1Process 'ui' $ui 'cmd.exe' @('/c', 'yarn', 'start', '--host', '127.0.0.1')
  }
  $started | ConvertTo-Json -Depth 3 | Set-Content -Encoding utf8 (Join-Path $runDir 'pids.json')

  function Wait-Http([string]$Url, [string]$Name) {
    $until = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
      try { Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 | Out-Null; Write-Host "$Name ready"; return } catch { Start-Sleep -Seconds 2 }
    } while ((Get-Date) -lt $until)
    throw "$Name did not respond at $Url. See $runDir."
  }
  Wait-Http 'http://127.0.0.1:8092/health' 'storage_service'
  Wait-Http 'http://127.0.0.1:8094/health' 'agent_gateway'
  Wait-Http 'http://127.0.0.1:8080/health' 'api_gateway'
  Write-Host "W1 stack started. Logs and PIDs: $runDir"
  Write-Host 'Ports: API gateway 8080, user-management 8087, general-management 8088, storage 8092, agent gateway 8094.'
} finally { Pop-Location }
