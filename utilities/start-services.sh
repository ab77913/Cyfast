#!/usr/bin/env bash
# CyFAST — start local services in background with logs under utilities/logs/.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="${ROOT}/utilities/logs"
PIDFILE="${LOG}/start-all.pids"

mkdir -p "$LOG"
: >"$PIDFILE"

echo "============================================"
echo "CyFAST start-services (ROOT=$ROOT)"
echo "============================================"

if [[ "${CYFAST_USE_DOCKER:-}" == "1" ]] && command -v docker >/dev/null 2>&1; then
  if docker network inspect cyfastnet >/dev/null 2>&1; then
    :
  else
    echo "Creating docker network cyfastnet ..."
    docker network create cyfastnet || true
  fi
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "${ROOT}/databases/docker-compose.yml" up -d || echo "[warn] docker compose up failed"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "${ROOT}/databases/docker-compose.yml" up -d || echo "[warn] docker-compose up failed"
  else
    echo "[warn] Neither 'docker compose' nor 'docker-compose' — skip DB stack."
  fi
else
  echo "[local] CYFAST_USE_DOCKER not set to 1 — skipping docker compose (local DB assumed)"
fi

run_svc() {
  local title="$1"
  local dir="$2"
  if [[ ! -f "${dir}/package.json" ]]; then
    echo "[skip] Missing package.json: $dir"
    return 0
  fi
  echo "Starting ${title} ..."
  (
    cd "$dir" && exec npm start
  ) >>"${LOG}/${title}.log" 2>&1 &
  echo "$!" >>"$PIDFILE"
}

run_svc "user_management" "${ROOT}/apis/user_management"
run_svc "logger_service" "${ROOT}/apis/logger_service"
run_svc "storage_service" "${ROOT}/apis/storage_service"
run_svc "general_management" "${ROOT}/apis/general_management"

sleep 2

run_svc "api_gateway" "${ROOT}/apis/api_gateway"
run_svc "ui" "${ROOT}/ui"

AE="${ROOT}/ai_engine"
VPY="${AE}/.venv/bin/python"
if [[ "${SKIP_AI_ENGINE:-}" == "1" ]]; then
  echo "[skip] SKIP_AI_ENGINE=1 — ai_engine not started"
elif [[ ! -d "$AE" ]]; then
  echo "[warn] ai_engine folder missing — skip"
elif [[ ! -f "$VPY" ]]; then
  echo "[warn] ai_engine: missing .venv/bin/python — create venv in ai_engine and pip install -r requirements.txt"
else
  echo "Starting ai_engine (venv python, uvicorn :8099) ..."
  (
    cd "$AE"
    exec "$VPY" -m uvicorn app.main:app --host 0.0.0.0 --port 8099
  ) >>"${LOG}/ai_engine.log" 2>&1 &
  echo "$!" >>"$PIDFILE"
fi

echo ""
echo "PIDs appended to ${PIDFILE} (parents of npm)." 
echo "Logs: ${LOG}/"
echo "Gateway: http://localhost:8080  UI: http://localhost:5173"
echo "Stop: utilities/stop-services.sh"
