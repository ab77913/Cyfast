# Removes generated W1 TEST-ONLY certificates and keys from the local machine.
[CmdletBinding()]
param(
  [string]$OutDir = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $OutDir) { $OutDir = Join-Path $PSScriptRoot '.generated' }
if (Test-Path $OutDir) {
  Remove-Item -Recurse -Force $OutDir
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Write-Host "Cleared TEST-ONLY cert material under $OutDir"
