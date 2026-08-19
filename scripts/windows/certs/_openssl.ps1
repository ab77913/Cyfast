# Locates openssl for W1 TEST-ONLY certificate scripts.
function Get-W1OpenSsl {
  $candidates = @(
    (Get-Command openssl -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source),
    'C:\Program Files\Git\usr\bin\openssl.exe',
    'C:\Program Files (x86)\Git\usr\bin\openssl.exe'
  ) | Where-Object { $_ -and (Test-Path $_) }
  $path = $candidates | Select-Object -First 1
  if (-not $path) { throw 'openssl is required (install Git for Windows or OpenSSL).' }
  return $path
}
