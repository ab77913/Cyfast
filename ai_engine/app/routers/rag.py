from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.rag.chat import RagChatBody, rag_chat
from app.rag.pipeline import hybrid_search

router = APIRouter()


class RagSearchRequest(BaseModel):
    project_id: int
    organization_id: int | None = None
    query: str
    doc_types: list[str] | None = None
    project_document_ids: list[int] | None = None
    top_k: int = Field(default=8, ge=1, le=50)
    max_branch: int = Field(default=3, ge=1, le=10)
    max_depth: int = Field(default=5, ge=1, le=20)
    candidate_doc_limit: int = Field(default=25, ge=1, le=100)
    per_doc_chunk_limit: int = Field(default=4, ge=1, le=20)
    use_llm_tree: bool = Field(
        default=True,
        description="If true and an LLM is configured (see LLM_PROVIDER), use LLM for PageIndex branch scoring; else lexical.",
    )


@router.post("/rag/chat")
async def rag_chat_route(body: RagChatBody) -> dict[str, Any]:
    """
    Retrieve with hybrid vectorless RAG, then synthesize with the configured LLM
    (OpenAI-compatible or Ollama) when available; otherwise return extractive excerpts.
    """
    return await rag_chat(body)


@router.post("/rag/search")
async def rag_search(body: RagSearchRequest) -> dict[str, Any]:
    """
    Hybrid vectorless RAG:
      A) MongoDB `$text` on chunk nodes + metadata filters
      C) PageIndex tree traversal with optional LLM branch selection
    """
    return await hybrid_search(
        project_id=body.project_id,
        organization_id=body.organization_id,
        query=body.query,
        doc_types=body.doc_types,
        project_document_ids=body.project_document_ids,
        top_k=body.top_k,
        max_branch=body.max_branch,
        max_depth=body.max_depth,
        candidate_doc_limit=body.candidate_doc_limit,
        per_doc_chunk_limit=body.per_doc_chunk_limit,
        use_llm_tree=body.use_llm_tree,
    )
