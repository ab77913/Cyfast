@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM CyFAST — start local services (separate consoles). Repo root = parent of utilities.
pushd "%~dp0.." 2>nul || exit /b 1
set "CYFAST_ROOT=%CD%"
popd

set "LOG_DIR=%CYFAST_ROOT%\utilities\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" 2>nul

echo ============================================
echo CyFAST start-services  (ROOT=%CYFAST_ROOT%)
echo ============================================

REM Docker databases: off by default (local MySQL/Mongo/etc.). Set CYFAST_USE_DOCKER=1 to run databases\docker-compose.yml
if /I not "%CYFAST_USE_DOCKER%"=="1" (
  echo [local] CYFAST_USE_DOCKER not set — skipping docker compose (local DBs assumed^)
  goto SkipDockerCompose
)

docker version >nul 2>&1
if errorlevel 1 (
  echo [skip] Docker not available — cannot run databases\docker-compose.yml
  goto SkipDockerCompose
)

docker network inspect cyfastnet >nul 2>&1
if errorlevel 1 (
  echo Creating docker network cyfastnet ...
  docker network create cyfastnet
)

docker compose version >nul 2>&1
if not errorlevel 1 (
  echo Starting databases (docker compose) ...
  docker compose -f "%CYFAST_ROOT%\databases\docker-compose.yml" up -d
) else (
  docker-compose version >nul 2>&1
  if not errorlevel 1 (
    docker-compose -f "%CYFAST_ROOT%\databases\docker-compose.yml" up -d
  ) else (
    echo [warn] Neither "docker compose" nor "docker-compose" found — skip DB stack.
  )
)

:SkipDockerCompose

REM --- Node APIs — start backends before gateway ---
call :launch "CyFAST - user_management"       "%CYFAST_ROOT%\apis\user_management"
call :launch "CyFAST - logger_service"        "%CYFAST_ROOT%\apis\logger_service"
call :launch "CyFAST - storage_service"       "%CYFAST_ROOT%\apis\storage_service"
call :launch "CyFAST - general_management"     "%CYFAST_ROOT%\apis\general_management"

timeout /t 3 /nobreak >nul

call :launch "CyFAST - api_gateway" "%CYFAST_ROOT%\apis\api_gateway"

REM --- UI (Vite) ---
call :launch "CyFAST - ui" "%CYFAST_ROOT%\ui"

REM --- AI engine (FastAPI) — ai_engine\.venv Python by default. Set SKIP_AI_ENGINE=1 to skip ---
if /I "%SKIP_AI_ENGINE%"=="1" (
  echo [skip] SKIP_AI_ENGINE=1 — ai_engine not started
) else (
  if not exist "%CYFAST_ROOT%\ai_engine" (
    echo [warn] ai_engine folder not found — skip
  ) else (
    if not exist "%CYFAST_ROOT%\ai_engine\.venv\Scripts\python.exe" (
      echo [warn] ai_engine: missing .venv\Scripts\python.exe — create venv in ai_engine and pip install -r requirements.txt
    ) else (
      REM cwd = ai_engine; relative .venv path avoids cmd nested-quote failures
      start "CyFAST - ai_engine" /D "%CYFAST_ROOT%\ai_engine" cmd /k .venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8099
      echo Started: CyFAST - ai_engine (venv python^)
    )
  )
)

echo.
echo Done. Gateway: http://localhost:8080  UI: usually http://localhost:5173
echo Stop with utilities\stop-services.bat
goto :eof

:launch
set "TITLE=%~1"
set "DIR=%~2"
if not exist "%DIR%\package.json" (
  echo [skip] Missing package.json: %DIR%
  goto :eof
)
REM START /D sets working dir — avoids "filename syntax incorrect" from nested quotes with pushd
start "%TITLE%" /D "%DIR%" cmd /k npm start
echo Started: %TITLE%
goto :eof
