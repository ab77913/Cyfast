[CmdletBinding()]
param([string]$Configuration = 'Debug')
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$project = Join-Path $root 'windows\src\CyFast.Windows.SessionHost\CyFast.Windows.SessionHost.csproj'
dotnet run --project $project -c $Configuration
exit $LASTEXITCODE
