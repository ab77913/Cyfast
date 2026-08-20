from __future__ import annotations

import hmac
import os
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from .policy import RepairPolicyError, validate_repair
from .service import (
    ScriptRepairResponseError,
    ScriptRepairUnavailable,
    get_script_repair_service,
)


router = APIRouter(prefix="/v1/script_repairs", tags=["script-repairs"])


class RepairRequest(BaseModel):
    failure_classification: str = Field(min_length=1, max_length=64)
    attempt_number: int = Field(ge=1, le=3)
    platform: str = Field(min_length=1, max_length=32)
    before_script: str = Field(min_length=1, max_length=225_280)
    failure_message: str = Field(min_length=1, max_length=16_384)
    evidence_summary: dict[str, Any] = Field(default_factory=dict)
    target_context: dict[str, Any] = Field(default_factory=dict)


class ValidateRepairRequest(BaseModel):
    failure_classification: str = Field(min_length=1, max_length=64)
    attempt_number: int = Field(ge=1, le=3)
    before_script: str = Field(min_length=1, max_length=225_280)
    after_script: str = Field(min_length=1, max_length=225_280)
    proposed_changes: list[str] = Field(default_factory=list, max_length=100)


@router.post("/propose")
def propose_repair(payload: RepairRequest, request: Request) -> dict[str, Any]:
    require_internal_auth(request)
    try:
        proposal = get_script_repair_service().propose(
            failure_classification=payload.failure_classification,
            attempt_number=payload.attempt_number,
            platform=payload.platform,
            before_script=payload.before_script,
            failure_message=payload.failure_message,
            evidence_summary=payload.evidence_summary,
            target_context=payload.target_context,
        )
        return proposal.to_dict()
    except RepairPolicyError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "REPAIR_POLICY_REJECTED", "errors": exc.errors},
        ) from exc
    except ScriptRepairUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "SCRIPT_REPAIR_MODEL_UNAVAILABLE", "message": str(exc)},
        ) from exc
    except ScriptRepairResponseError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "SCRIPT_REPAIR_RESPONSE_INVALID", "message": str(exc)},
        ) from exc


@router.post("/validate")
def validate_repair_endpoint(payload: ValidateRepairRequest, request: Request) -> dict[str, Any]:
    require_internal_auth(request)
    result = validate_repair(
        failure_classification=payload.failure_classification,
        attempt_number=payload.attempt_number,
        before_script=payload.before_script,
        after_script=payload.after_script,
        proposed_changes=payload.proposed_changes,
    )
    return result.to_dict()


def require_internal_auth(request: Request) -> None:
    expected = os.environ.get("CYFAST_INTERNAL_API_TOKEN", "")
    if len(expected) < 32:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "INTERNAL_AUTH_NOT_CONFIGURED"},
        )
    supplied = request.headers.get("authorization", "")
    if not hmac.compare_digest(supplied.encode("utf-8"), f"Bearer {expected}".encode("utf-8")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED"},
        )
