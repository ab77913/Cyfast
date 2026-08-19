[CmdletBinding()]
param([string]$ServiceName = 'CyFastWindowsAgentDev')
$ErrorActionPreference = 'Stop'
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service) {
  if ($service.Status -ne 'Stopped') { Stop-Service -Name $ServiceName -Force }
  sc.exe delete $ServiceName | Out-Null
  Write-Host "Removed $ServiceName."
} else { Write-Host "$ServiceName is not installed." }
