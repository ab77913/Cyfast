#!/usr/bin/env bash
# CyFAST — stop processes on default CyFast dev ports (+ optional PID file from start-services.sh).

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="${ROOT}/utilities/logs"
PIDFILE="${LOG}/start-all.pids"

CYFAST_PORTS=(8080 8087 8088 8090 8092 8098 8099 5173)

echo "============================================"
echo "CyFAST stop-services"
echo "============================================"

kill_port () {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti ":${port}" 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      echo "${pids}" | tr ' ' '\n' | sort -u | while read -r pid; do
        [[ -z "$pid" ]] && continue
        echo "  stop PID ${pid} (port ${port})"
        kill "${pid}" 2>/dev/null || true
        sleep 0.3
        kill -9 "${pid}" 2>/dev/null || true
      done
    fi
    return 0
  fi
  if command -v fuser >/dev/null 2>&1; then
    echo "  fuser port ${port}"
    fuser -k "${port}/tcp" 2>/dev/null || true
  fi
}

if [[ -s "$PIDFILE" ]]; then
  echo "Stopping PIDs from ${PIDFILE} ..."
  while read -r pid; do
    [[ -z "$pid" ]] && continue
    echo "  kill ${pid}"
    kill "${pid}" 2>/dev/null || true
    sleep 0.2
    kill -9 "${pid}" 2>/dev/null || true
  done <"$PIDFILE"
  : >"$PIDFILE"
fi

echo "Clearing known CyFast listener ports ..."
for p in "${CYFAST_PORTS[@]}"; do
  kill_port "$p"
done

echo ""
echo "Done. Docker / database containers not stopped (use docker compose down if needed)."
