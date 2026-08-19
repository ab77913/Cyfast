[CmdletBinding()]
param([string]$OutputPath = (Join-Path $PSScriptRoot '..\..\docs\windows\W1_DIAGNOSTICS.json'))
$ErrorActionPreference = 'Stop'
function Redact([object]$Value) {
  if ($Value -is [string]) { return ($Value -replace '(?i)(token|password|secret|authorization|api[_-]?key)\s*[:=]\s*[^\s,;]+', '$1=REDACTED') }
  if ($Value -is [System.Collections.IDictionary]) { $copy = @{}; foreach ($key in $Value.Keys) { $copy[$key] = if ($key -match '(?i)token|password|secret|key|authorization') { 'REDACTED' } else { Redact $Value[$key] } }; return $copy }
  if ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [string]) { return @($Value | ForEach-Object { Redact $_ }) }
  return $Value
}
$result = [ordered]@{
  collected_at = (Get-Date).ToUniversalTime().ToString('o')
  host = Redact @{ computer = $env:COMPUTERNAME; os = (Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber); dotnet = (& dotnet --info 2>&1 | Out-String); services = (Get-Service 'CyFastWindowsAgentDev' -ErrorAction SilentlyContinue | Select-Object Name,Status) }
  windows_events = Get-WinEvent -LogName Application -MaxEvents 100 -ErrorAction SilentlyContinue | Where-Object ProviderName -like '*CyFast*' | Select-Object TimeCreated,LevelDisplayName,ProviderName,Message
}
$dir = Split-Path -Parent $OutputPath; New-Item -ItemType Directory -Force -Path $dir | Out-Null
(Redact $result | ConvertTo-Json -Depth 8) | Set-Content -Encoding utf8 $OutputPath
Write-Host "Wrote redacted diagnostics: $OutputPath"
