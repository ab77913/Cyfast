[CmdletBinding()]
param([string]$Configuration = 'Debug', [string]$ServiceName = 'CyFastWindowsAgentDev')
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$project = Join-Path $root 'windows\src\CyFast.Windows.Agent\CyFast.Windows.Agent.csproj'
dotnet build $project -c $Configuration
if ($LASTEXITCODE) { throw 'Agent build failed.' }
$exe = Join-Path $root "windows\src\CyFast.Windows.Agent\bin\$Configuration\net9.0-windows\CyFast.Windows.Agent.exe"
if (-not (Test-Path $exe)) { throw "Agent executable not found: $exe" }
if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) { Stop-Service $ServiceName -Force; sc.exe delete $ServiceName | Out-Null }
New-Service -Name $ServiceName -BinaryPathName "`"$exe`"" -DisplayName 'CyFAST Windows Agent (Dev)' -StartupType Manual | Out-Null
Write-Host "Installed $ServiceName. Configure Agent settings before Start-Service."
