from __future__ import annotations

import argparse
import hmac
import json
import logging
import os
import re
import signal
import ssl
import sys
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Mapping
from urllib.parse import urlparse

from .contracts import ExecutionRequest, Platform, redact, utc_now
from .executors import ExecutorRegistry, create_default_registry
from .job_manager import JobManager
from .package import PackageValidationError


LOGGER = logging.getLogger("cyfast.platform_runtime")
MAX_REQUEST_BYTES = 2 * 1024 * 1024
_EXECUTION_PATH = re.compile(
    r"^/v1/(windows|linux|android|embedded)/executions(?:/([A-Za-z0-9._:-]{1,128})(/cancel)?)?$",
    re.I,
)
_RUNTIME_PATH = re.compile(r"^/v1/(windows|linux|android|embedded)/runtime/check$", re.I)


class RuntimeServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(
        self,
        address: tuple[str, int],
        *,
        registry: ExecutorRegistry,
        jobs: JobManager,
        bearer_token: str,
    ) -> None:
        if len(bearer_token) < 32:
            raise ValueError("CYFAST_AGENT_TOKEN must contain at least 32 characters")
        super().__init__(address, RuntimeRequestHandler)
        self.registry = registry
        self.jobs = jobs
        self.bearer_token = bearer_token


class RuntimeRequestHandler(BaseHTTPRequestHandler):
    server: RuntimeServer
    protocol_version = "HTTP/1.1"

    def do_GET(self) -> None:  # noqa: N802
        try:
            if not self._authorized():
                return
            path = urlparse(self.path).path
            if path in {"/health", "/v1/health"}:
                return self._json(
                    HTTPStatus.OK,
                    {
                        "status": "ONLINE",
                        "real_execution": True,
                        "simulated": False,
                        "platforms": [platform.value for platform in self.server.registry.platforms()],
                        "checked_at": utc_now(),
                    },
                )
            match = _EXECUTION_PATH.fullmatch(path)
            if match and match.group(2) and not match.group(3):
                platform = Platform.parse(match.group(1))
                snapshot = self.server.jobs.get(match.group(2))
                if snapshot is None or snapshot.platform is not platform:
                    return self._error(HTTPStatus.NOT_FOUND, "EXECUTION_NOT_FOUND", "Execution was not found")
                return self._json(HTTPStatus.OK, snapshot.to_dict(include_result=True))
            return self._error(HTTPStatus.NOT_FOUND, "ROUTE_NOT_FOUND", "Route was not found")
        except Exception as exc:
            self._unexpected(exc)

    def do_POST(self) -> None:  # noqa: N802
        try:
            if not self._authorized():
                return
            path = urlparse(self.path).path
            runtime_match = _RUNTIME_PATH.fullmatch(path)
            if runtime_match:
                platform = Platform.parse(runtime_match.group(1))
                payload = self._read_json()
                runtime = payload.get("configuration") if isinstance(payload.get("configuration"), Mapping) else payload.get("runtime")
                runtime = runtime if isinstance(runtime, Mapping) else {}
                health = self.server.registry.get(platform).check(runtime)
                return self._json(HTTPStatus.OK, health.to_dict())

            execution_match = _EXECUTION_PATH.fullmatch(path)
            if execution_match:
                platform = Platform.parse(execution_match.group(1))
                execution_id = execution_match.group(2)
                cancel = execution_match.group(3)
                if execution_id and cancel:
                    snapshot = self.server.jobs.cancel(execution_id)
                    if snapshot is None or snapshot.platform is not platform:
                        return self._error(HTTPStatus.NOT_FOUND, "EXECUTION_NOT_FOUND", "Execution was not found")
                    return self._json(HTTPStatus.ACCEPTED, snapshot.to_dict(include_result=False))
                if execution_id:
                    return self._error(HTTPStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED", "Use GET for execution status")
                request = ExecutionRequest.from_mapping(self._read_json(), platform)
                snapshot = self.server.jobs.create(request)
                return self._json(
                    HTTPStatus.ACCEPTED,
                    {
                        "execution_id": snapshot.execution_id,
                        "status": snapshot.state.value,
                        "platform": snapshot.platform.value,
                        "real_execution": False,
                        "simulated": False,
                        "target_connected": False,
                        "session_created": False,
                        "accepted_at": snapshot.created_at,
                    },
                )
            return self._error(HTTPStatus.NOT_FOUND, "ROUTE_NOT_FOUND", "Route was not found")
        except PackageValidationError as exc:
            self._error(HTTPStatus.UNPROCESSABLE_ENTITY, exc.code, str(exc))
        except ValueError as exc:
            self._error(HTTPStatus.BAD_REQUEST, "INVALID_REQUEST", str(exc))
        except Exception as exc:
            self._unexpected(exc)

    def log_message(self, fmt: str, *args: Any) -> None:
        LOGGER.info("%s - %s", self.client_address[0], fmt % args)

    def _authorized(self) -> bool:
        supplied = self.headers.get("authorization", "")
        expected = f"Bearer {self.server.bearer_token}"
        if not hmac.compare_digest(supplied.encode("utf-8"), expected.encode("utf-8")):
            self._error(HTTPStatus.UNAUTHORIZED, "UNAUTHORIZED", "Valid bearer authentication is required")
            return False
        return True

    def _read_json(self) -> dict[str, Any]:
        content_type = self.headers.get("content-type", "").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            raise ValueError("content-type must be application/json")
        raw_length = self.headers.get("content-length")
        try:
            length = int(raw_length or "0")
        except ValueError as exc:
            raise ValueError("content-length is invalid") from exc
        if length <= 0:
            return {}
        if length > MAX_REQUEST_BYTES:
            raise RequestTooLargeError()
        body = self.rfile.read(length)
        try:
            value = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("request body must be valid UTF-8 JSON") from exc
        if not isinstance(value, dict):
            raise ValueError("request body must be a JSON object")
        return value

    def _json(self, status: HTTPStatus, value: Mapping[str, Any]) -> None:
        body = json.dumps(redact(dict(value)), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(int(status))
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.send_header("cache-control", "no-store")
        self.send_header("x-content-type-options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status: HTTPStatus, code: str, message: str) -> None:
        self._json(status, {"code": code, "message": message})

    def _unexpected(self, exc: Exception) -> None:
        if isinstance(exc, RequestTooLargeError):
            self._error(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "REQUEST_TOO_LARGE", str(exc))
            return
        LOGGER.exception("Unhandled platform runtime request failure")
        self._error(HTTPStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Internal execution target error")


class RequestTooLargeError(ValueError):
    def __init__(self) -> None:
        super().__init__(f"request exceeds the {MAX_REQUEST_BYTES}-byte limit")


def build_server(
    *,
    host: str,
    port: int,
    token: str,
    registry: ExecutorRegistry | None = None,
    jobs: JobManager | None = None,
) -> RuntimeServer:
    registry_value = registry or create_default_registry()
    jobs_value = jobs or JobManager(registry_value)
    return RuntimeServer((host, port), registry=registry_value, jobs=jobs_value, bearer_token=token)


def serve() -> None:
    parser = argparse.ArgumentParser(description="CyFAST secure cross-platform execution runtime")
    parser.add_argument("--host", default=os.environ.get("CYFAST_AGENT_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("CYFAST_AGENT_PORT", "8095")))
    parser.add_argument("--cert", default=os.environ.get("CYFAST_AGENT_TLS_CERT"))
    parser.add_argument("--key", default=os.environ.get("CYFAST_AGENT_TLS_KEY"))
    parser.add_argument("--log-level", default=os.environ.get("CYFAST_AGENT_LOG_LEVEL", "INFO"))
    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, str(args.log_level).upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    token = os.environ.get("CYFAST_AGENT_TOKEN", "")
    loopback = args.host in {"127.0.0.1", "localhost", "::1"}
    if not loopback and not (args.cert and args.key):
        raise SystemExit("Remote binding requires CYFAST_AGENT_TLS_CERT and CYFAST_AGENT_TLS_KEY")
    server = build_server(host=args.host, port=args.port, token=token)
    if args.cert and args.key:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(args.cert, args.key)
        server.socket = context.wrap_socket(server.socket, server_side=True)

    stopped = threading.Event()

    def stop(_signum: int, _frame: Any) -> None:
        if stopped.is_set():
            return
        stopped.set()
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    LOGGER.info("CyFAST platform runtime listening on %s:%d", args.host, args.port)
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        server.jobs.close()
        server.server_close()


if __name__ == "__main__":
    serve()
