# Shared PEM export helpers for W1 TEST-ONLY certificates. NOT FOR PRODUCTION.
function Export-PemCert([System.Security.Cryptography.X509Certificates.X509Certificate2]$Cert, [string]$Path) {
  $b64 = [Convert]::ToBase64String($Cert.RawData)
  $lines = for ($i = 0; $i -lt $b64.Length; $i += 64) {
    $b64.Substring($i, [Math]::Min(64, $b64.Length - $i))
  }
  @('-----BEGIN CERTIFICATE-----') + $lines + @('-----END CERTIFICATE-----') |
    Set-Content -Path $Path -Encoding ascii
}

function Export-PemKey([System.Security.Cryptography.RSA]$Rsa, [string]$Path) {
  $bytes = $Rsa.ExportRSAPrivateKey()
  $b64 = [Convert]::ToBase64String($bytes)
  $lines = for ($i = 0; $i -lt $b64.Length; $i += 64) {
    $b64.Substring($i, [Math]::Min(64, $b64.Length - $i))
  }
  @('-----BEGIN RSA PRIVATE KEY-----') + $lines + @('-----END RSA PRIVATE KEY-----') |
    Set-Content -Path $Path -Encoding ascii
}
