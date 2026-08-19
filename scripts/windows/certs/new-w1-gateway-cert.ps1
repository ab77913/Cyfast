# Issues a TEST-ONLY gateway server certificate signed by the local W1 test CA.
# NOT FOR PRODUCTION.
[CmdletBinding()]
param(
  [string]$OutDir = '',
  [string]$DnsName = 'localhost'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot '_openssl.ps1')
if (-not $OutDir) { $OutDir = Join-Path $PSScriptRoot '.generated' }
$openssl = Get-W1OpenSsl
$caKey = Join-Path $OutDir 'w1-test-ca.key.pem'
$caCert = Join-Path $OutDir 'w1-test-ca.cert.pem'
if (-not (Test-Path $caKey)) { throw 'Run new-w1-test-ca.ps1 first.' }
$key = Join-Path $OutDir 'w1-gateway.key.pem'
$csr = Join-Path $OutDir 'w1-gateway.csr.pem'
$cert = Join-Path $OutDir 'w1-gateway.cert.pem'
$ext = Join-Path $OutDir 'w1-gateway.ext'
@(
  'authorityKeyIdentifier=keyid,issuer'
  'basicConstraints=CA:FALSE'
  'keyUsage = digitalSignature, keyEncipherment'
  'extendedKeyUsage = serverAuth'
  "subjectAltName = @alt_names"
  '[alt_names]'
  "DNS.1 = $DnsName"
  'DNS.2 = localhost'
  'IP.1 = 127.0.0.1'
  'IP.2 = ::1'
) | Set-Content -Path $ext -Encoding ascii
& $openssl genrsa -out $key 2048
& $openssl req -new -key $key -out $csr -subj "/CN=$DnsName/O=CyFAST-W1-TEST-ONLY"
& $openssl x509 -req -in $csr -CA $caCert -CAkey $caKey -CAcreateserial -out $cert -days 14 -sha256 -extfile $ext
if ($LASTEXITCODE) { throw 'openssl gateway cert failed' }
Write-Host "Created TEST-ONLY gateway cert for $DnsName"
