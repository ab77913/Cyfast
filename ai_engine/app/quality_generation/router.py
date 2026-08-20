from __future__ import annotations

import hmac
import os
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from .schemas import GenerationStage, GenerationValidationError
from .service import (
    QualityGenerationResponseError,
    QualityGenerationUnavailable,
    get_quality_generation_service,
)


router = APIRouter(prefix="/v1/quality_generation", tags=["quality-generation"])


class SourceItem(BaseModel):
    item_type: str = Field(min_length=1, max_length=64)
    resource_id: str = Field(min_length=1, max_length=128)
    resource_version: str = Field(default="current", min_length=1, max_length=128)
    title: str = Field(default="", max_length=512)
    source_anchor: dict[str, Any] = Field(default_factory=dict)
    content: Any


class GenerateRequest(BaseModel):
    stage: str = Field(min_length=1, max_length=64)
    platform: str | None = Field(default=None, max_length=32)
    source_items: list[SourceItem] = Field(min_length=1, max_length=500)
    context: dict[str, Any] = Field(default_factory=dict)
    generation_policy: dict[str, Any] = Field(default_factory=dict)


@router.post("/generate")
def generate(payload: GenerateRequest, request: Request) -> dict[str, Any]:
    require_internal_auth(request)
    try:
        result = get_quality_generation_service().generate(
            stage=GenerationStage.parse(payload.stage),
            platform=payload.platform,
            source_items=[item.model_dump() for item in payload.source_items],
            context=payload.context,
            generation_policy=payload.generation_policy,
        )
        return result.to_dict()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "QUALITY_GENERATION_INPUT_INVALID", "message": str(exc)},
        ) from exc
    except GenerationValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "QUALITY_GENERATION_SCHEMA_INVALID", "errors": exc.errors},
        ) from exc
    except QualityGenerationUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "QUALITY_GENERATION_MODEL_UNAVAILABLE", "message": str(exc)},
        ) from exc
    except QualityGenerationResponseError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "QUALITY_GENERATION_RESPONSE_INVALID", "message": str(exc)},
        ) from exc


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
