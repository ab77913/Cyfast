# Reset isolated existing-pipeline regression artifacts (mock LLM + temp bodies).
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$runDir = Join-Path $PSScriptRoot '.run'
if (Test-Path $runDir) {
  Get-NetTCPConnection -LocalPort 8199 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Recurse -Force $runDir
}
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
Write-Host 'Existing CyFAST pipeline regression workspace reset.'
