# Issues a TEST-ONLY agent client certificate signed by the local W1 test CA.
# NOT FOR PRODUCTION.
[CmdletBinding()]
param(
  [string]$OutDir = '',
  [Parameter(Mandatory = $true)][string]$AgentId
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot '_openssl.ps1')
if (-not $OutDir) { $OutDir = Join-Path $PSScriptRoot '.generated' }
$openssl = Get-W1OpenSsl
$caKey = Join-Path $OutDir 'w1-test-ca.key.pem'
$caCert = Join-Path $OutDir 'w1-test-ca.cert.pem'
if (-not (Test-Path $caKey)) { throw 'Run new-w1-test-ca.ps1 first.' }
$key = Join-Path $OutDir 'w1-agent.key.pem'
$csr = Join-Path $OutDir 'w1-agent.csr.pem'
$cert = Join-Path $OutDir 'w1-agent.cert.pem'
$namedCert = Join-Path $OutDir "w1-agent-$AgentId.cert.pem"
$namedKey = Join-Path $OutDir "w1-agent-$AgentId.key.pem"
$ext = Join-Path $OutDir 'w1-agent.ext'
@(
  'authorityKeyIdentifier=keyid,issuer'
  'basicConstraints=CA:FALSE'
  'keyUsage = digitalSignature, keyEncipherment'
  'extendedKeyUsage = clientAuth'
  'subjectAltName = @alt_names'
  '[alt_names]'
  "DNS.1 = $AgentId"
  "URI.1 = urn:cyfast:agent:$AgentId"
) | Set-Content -Path $ext -Encoding ascii
& $openssl genrsa -out $key 2048
& $openssl req -new -key $key -out $csr -subj "/CN=$AgentId/O=CyFAST-W1-TEST-ONLY"
& $openssl x509 -req -in $csr -CA $caCert -CAkey $caKey -CAcreateserial -out $cert -days 14 -sha256 -extfile $ext
if ($LASTEXITCODE) { throw 'openssl agent cert failed' }
Copy-Item $cert $namedCert -Force
Copy-Item $key $namedKey -Force
Write-Host "Created TEST-ONLY agent cert for $AgentId"
