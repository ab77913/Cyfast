@echo off
setlocal EnableExtensions

REM CyFAST — kill processes listening on default local dev ports.

echo ============================================
echo CyFAST stop-services (default local ports)
echo ============================================

REM CyFast app listeners only (gateway, backends, UI, ai_engine). Docker DB ports not touched.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ports=@(8080,8087,8088,8090,8092,8098,8099,5173);" ^
  "foreach ($port in $ports) {" ^
  "  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue;" ^
  "  foreach ($c in $conns) {" ^
  "    $procId = $c.OwningProcess;" ^
  "    if ($procId -and $procId -gt 0) { Write-Host \"Stopping PID $procId (port $port)\"; Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue }" ^
  "  }" ^
  "}"

echo.
echo Ports cleared (best-effort). Docker / MySQL / Elasticsearch containers were NOT stopped.
goto :eof
