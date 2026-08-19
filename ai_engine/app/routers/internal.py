"""
Optional HTTP trigger after general_management finishes indexing a document.

Use when you want the AI engine to run follow-on work (metrics, cache warm, optional
re-summary) without coupling to RabbitMQ. Idempotent by design.
"""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class DocumentIndexedPayload(BaseModel):
    event: str = "DOCUMENT_INDEXED"
    project_id: int
    organization_id: int | None = None
    project_document_id: int
    doc_type: str | None = None


@router.post("/documents/indexed")
async def document_indexed(payload: DocumentIndexedPayload) -> dict[str, Any]:
    """
    Called by apis/general_management after Mongo chunk replace + MySQL status=INDEXED.

    Extend this handler to enqueue enrichment jobs, update caches, or schedule LLM
    section-summary refresh for PageIndex.
    """
    return {
        "received": True,
        "project_document_id": payload.project_document_id,
        "note": "No async work configured; hook for future enrichment.",
    }
