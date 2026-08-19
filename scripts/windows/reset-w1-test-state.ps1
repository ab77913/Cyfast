[CmdletBinding()]
param(
  [string]$MysqlContainer = $(if ($env:W1_MYSQL_CONTAINER) { $env:W1_MYSQL_CONTAINER } else { 'cyfast-mysql' }),
  [string]$MysqlUser = $(if ($env:W1_MYSQL_USER) { $env:W1_MYSQL_USER } else { 'root' }),
  [string]$MysqlPassword = $(if ($env:W1_MYSQL_PASSWORD) { $env:W1_MYSQL_PASSWORD } else { 'HeliConia6*' }),
  [string]$MysqlDatabase = $(if ($env:W1_MYSQL_DATABASE) { $env:W1_MYSQL_DATABASE } else { 'cyfast3' })
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$tables = @(
  'execution_evidence', 'execution_command_result', 'execution_command',
  'ui_element', 'ui_snapshot', 'interactive_session', 'windows_application_profile',
  'agent_health', 'agent_capability', 'agent_installation', 'agent_certificate',
  'windows_node', 'agent_identity', 'agent_enrollment_token',
  'windows_audit_event', 'windows_outbox_event'
)

Get-Process CyFast.Windows.Agent,CyFast.Windows.SessionHost,CyFast.Windows.TestFixture -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $env:LOCALAPPDATA 'CyFast\identity.bin') -ErrorAction SilentlyContinue

# Delete only tables that exist so mixed legacy/W1 schemas do not fail reset.
$existsSql = @"
SELECT table_name FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('$(($tables -join "','"))');
"@
$existing = & docker exec $MysqlContainer mysql -N -s "-u$MysqlUser" "-p$MysqlPassword" $MysqlDatabase -e $existsSql
if ($LASTEXITCODE) { throw "Could not list W1 tables in $MysqlContainer/$MysqlDatabase." }
$toDelete = @($existing | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() })
if ($toDelete.Count -eq 0) {
  Write-Host "No W1 tables found to reset in $MysqlContainer/$MysqlDatabase."
  exit 0
}
$sql = @(
  'SET FOREIGN_KEY_CHECKS=0;'
  ($toDelete | ForEach-Object { "DELETE FROM ``$_``;" })
  'SET FOREIGN_KEY_CHECKS=1;'
) -join [Environment]::NewLine
$sql | & docker exec -i $MysqlContainer mysql "-u$MysqlUser" "-p$MysqlPassword" $MysqlDatabase
if ($LASTEXITCODE) { throw "Could not reset W1-only MySQL data in container $MysqlContainer." }
Write-Host "Reset W1 tables ($($toDelete -join ', ')) in $MysqlContainer/$MysqlDatabase. Project/user data was not modified."
