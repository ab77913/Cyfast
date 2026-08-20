from __future__ import annotations

import hmac
import os
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from .extractor import DocumentExtractionError, extract_document


router = APIRouter(prefix="/v1/quality_documents", tags=["quality-documents"])


class ExtractDocumentRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(default="application/octet-stream", max_length=255)
    content_base64: str = Field(min_length=1, max_length=36_000_000)


@router.post("/extract")
def extract(payload: ExtractDocumentRequest, request: Request) -> dict[str, Any]:
    require_internal_auth(request)
    try:
        return extract_document(
            filename=payload.filename,
            content_type=payload.content_type,
            content_base64=payload.content_base64,
        ).to_dict()
    except DocumentExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": exc.code, "message": str(exc)},
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
