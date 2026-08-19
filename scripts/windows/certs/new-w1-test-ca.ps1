# Creates a LOCAL TEST CA for W1 Agent Gateway mTLS experiments.
# NOT FOR PRODUCTION. Generated material must stay out of git.
[CmdletBinding()]
param([string]$OutDir = '')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot '_openssl.ps1')
if (-not $OutDir) { $OutDir = Join-Path $PSScriptRoot '.generated' }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$openssl = Get-W1OpenSsl
$caKey = Join-Path $OutDir 'w1-test-ca.key.pem'
$caCert = Join-Path $OutDir 'w1-test-ca.cert.pem'
& $openssl genrsa -out $caKey 4096
if ($LASTEXITCODE) { throw 'openssl genrsa failed' }
& $openssl req -x509 -new -nodes -key $caKey -sha256 -days 30 -out $caCert -subj '/CN=CyFAST-W1-Test-CA/O=CyFAST-W1-TEST-ONLY'
if ($LASTEXITCODE) { throw 'openssl req CA failed' }
Write-Host "Created TEST-ONLY CA at $OutDir (do not use in production)."
