"""RAG-grounded chat: retrieval via hybrid_search, then LLM synthesis or extractive fallback."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.rag.pipeline import hybrid_search
from app.shared.llm import chat_completion, rag_synthesis_ready
from app.shared.llm_profiles import LLMProfile


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class RagChatBody(BaseModel):
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
    use_llm_tree: bool = Field(default=True)
    conversation_history: list[ChatTurn] = Field(default_factory=list, max_length=24)


SYSTEM_PROMPT = """You are a precise assistant for software verification & validation project documents.
Answer ONLY using the CONTEXT excerpts. If the answer is not supported by the context, say you cannot find it in the indexed documents and suggest what to upload or clarify.
Use short sections or bullet lists when helpful. Mention document titles naturally when citing facts."""


def _build_context(chunks: list[dict[str, Any]], max_chars: int = 14000) -> str:
    parts: list[str] = []
    used = 0
    for c in chunks[:12]:
        title = c.get("project_document_title") or "Document"
        path = (c.get("section_path") or c.get("heading") or "").strip()
        snippet = (
            (c.get("content") or c.get("summary") or "").strip().replace("\r\n", "\n")
        )
        snippet = snippet[:3500]
        block = (
            f"--- Document: {title}"
            + (f" | Section: {path}" if path else "")
            + f"\n{snippet}"
        )
        if used + len(block) > max_chars:
            break
        parts.append(block)
        used += len(block)
    return "\n\n".join(parts) if parts else "(No passages retrieved)"


def _extractive_answer(query: str, chunks: list[dict[str, Any]]) -> str:
    q = (query or "").strip()
    if not chunks:
        return (
            "No indexed passages matched this question yet. Upload documents "
            "(PDF, DOCX, etc.) and wait until indexing completes, then ask again."
        )
    heading = (
        "Below are the best-matching excerpts from indexed project documents. "
        "Configure LLM_PROVIDER=ollama or set OPENAI_API_KEY for natural-language answers.\n\n"
    )
    blocks: list[str] = []
    for c in chunks[:8]:
        title = c.get("project_document_title") or "Document"
        path = (c.get("section_path") or c.get("heading") or "").strip()
        body = (
            (c.get("summary") or c.get("content") or "").strip().replace("\r\n", "\n")
        )[:2400]
        label = f"**{title}**"
        if path:
            label += f" — _{path}_"
        blocks.append(f"{label}\n{body}")
    footer = ""
    if q:
        footer = f'\n---\n_Your question:_ "{q}"'
    return heading + "\n\n---\n\n".join(blocks) + footer


def _summarize_citations(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for c in chunks[:10]:
        pid = c.get("project_document_id")
        nk = f"{pid}#{c.get('node_id')}"
        if nk in seen:
            continue
        seen.add(nk)
        out.append(
            {
                "project_document_id": pid,
                "title": c.get("project_document_title"),
                "doc_type": c.get("project_document_doc_type"),
                "section_path": c.get("section_path"),
                "heading": c.get("heading"),
                "score": c.get("score"),
            }
        )
    return out


async def _openai_answer(
    *,
    query: str,
    context_text: str,
    history: list[ChatTurn],
) -> str:
    trimmed: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for turn in history[-12:]:
        trimmed.append({"role": turn.role, "content": turn.content})
    trimmed.append(
        {
            "role": "user",
            "content": (
                "CONTEXT (excerpts from project documents):\n"
                f"{context_text}\n\n"
                f'QUESTION:\n"{query}"\n'
                "Answer grounded in CONTEXT only."
            ),
        }
    )

    text = await chat_completion(
        messages=trimmed,
        temperature=0.2,
        json_object=False,
        profile=LLMProfile.RAG_CHAT,
    )
    return text.strip() or "No response returned from language model."


async def rag_chat(body: RagChatBody) -> dict[str, Any]:
    q = (body.query or "").strip()
    if not q:
        return {
            "answer": "",
            "citations": [],
            "chunks": [],
            "sources": {},
        }

    retrieval = await hybrid_search(
        project_id=body.project_id,
        organization_id=body.organization_id,
        query=q,
        doc_types=body.doc_types,
        project_document_ids=body.project_document_ids,
        top_k=body.top_k,
        max_branch=body.max_branch,
        max_depth=body.max_depth,
        candidate_doc_limit=body.candidate_doc_limit,
        per_doc_chunk_limit=body.per_doc_chunk_limit,
        use_llm_tree=body.use_llm_tree,
    )
    chunks: list[dict[str, Any]] = list(retrieval.get("chunks") or [])
    citations = _summarize_citations(chunks)

    hist = [
        ChatTurn(role=t.role, content=t.content) for t in body.conversation_history
    ]

    ctx = _build_context(chunks)
    if rag_synthesis_ready():
        try:
            answer = await _openai_answer(
                query=q, context_text=ctx, history=[*hist]
            )
        except Exception:
            answer = _extractive_answer(q, chunks)
            mode = "extractive_fallback"
        else:
            mode = "llm"
    else:
        answer = _extractive_answer(q, chunks)
        mode = "extractive"

    return {
        "answer": answer,
        "citations": citations,
        "chunks": chunks[:8],
        "traversal": retrieval.get("traversal") or [],
        "documents": retrieval.get("documents") or [],
        "sources": {**(retrieval.get("sources") or {}), "answer_mode": mode},
    }
