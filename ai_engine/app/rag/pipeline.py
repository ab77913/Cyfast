"""
Hybrid vectorless RAG:
  A — MongoDB $text on chunks + structural filters (project_id, organization_id, doc_type, …)
  C — PageIndex tree traversal with optional LLM branch scoring

Merged, deduped, re-ranked for the API response shape expected by CyFast UI / GM.
"""

from __future__ import annotations

from typing import Any

from app.config import settings
from app.db import mongo
from app.db.mysql_docs import fetch_indexed_documents
from app.rag.lexical import score_node, tokenize
from app.rag.tree_walk import walk_document_tree


def _norm_doc(row: dict) -> dict[str, Any]:
    return {
        "project_document_id": row["project_document_id"],
        "title": row.get("title") or row.get("original_filename"),
        "doc_type": row["doc_type"],
        "version": row.get("version"),
        "status": row["status"],
    }


def _format_chunk(c: dict, title: str, doc_type: str) -> dict[str, Any]:
    return {
        "project_document_id": c["project_document_id"],
        "project_document_title": title,
        "project_document_doc_type": doc_type,
        "node_id": c["node_id"],
        "section_path": c.get("section_path"),
        "heading": c.get("heading"),
        "page_number": c.get("page_number"),
        "content": c.get("content"),
        "summary": c.get("summary"),
        "score": round(float(c.get("_score", 0)), 3),
    }


async def hybrid_search(
    *,
    project_id: int,
    organization_id: int | None,
    query: str,
    doc_types: list[str] | None,
    project_document_ids: list[int] | None,
    top_k: int,
    max_branch: int,
    max_depth: int,
    candidate_doc_limit: int,
    per_doc_chunk_limit: int,
    use_llm_tree: bool,
) -> dict[str, Any]:
    q = (query or "").strip()
    if not q:
        return {"chunks": [], "traversal": [], "documents": [], "sources": {}}

    # --- indexed candidates from MySQL (same contract as Node pickCandidateDocuments)
    docs = fetch_indexed_documents(
        project_id, organization_id, doc_types, project_document_ids, candidate_doc_limit
    )
    if not docs:
        return {"chunks": [], "traversal": [], "documents": [], "sources": {}}

    doc_meta = {d["project_document_id"]: d for d in docs}
    candidate_ids = list(doc_meta.keys())
    qt = tokenize(q)

    # --- A: full-text on chunks (high recall)
    text_hits: list[dict] = []
    try:
        text_hits = mongo.text_search_chunks(
            q,
            project_id,
            organization_id,
            doc_types,
            candidate_ids,
            limit=max(top_k * 4, 40),
        )
    except Exception:
        text_hits = []

    merged: dict[str, dict] = {}

    def add_chunk(c: dict, base_score: float, source: str):
        key = f"{c['project_document_id']}#{c['node_id']}"
        row = doc_meta.get(c["project_document_id"], {})
        title = row.get("title") or row.get("original_filename") or ""
        dtyp = row.get("doc_type") or ""
        sc = base_score + score_node(c, qt) * 0.15
        prev = merged.get(key)
        if prev is None or sc > prev["_score"]:
            merged[key] = {
                **c,
                "_score": sc,
                "_sources": {source},
                "_title": title,
                "_dtype": dtyp,
            }
        else:
            prev["_sources"].add(source)
            prev["_score"] = max(prev["_score"], sc)

    for h in text_hits:
        ts = float(h.pop("score", 1.0) if "score" in h else 1.0)
        add_chunk(h, ts * settings.rag_text_weight, "text")

    # --- C: tree walk per document (precision / structure)
    traversal_out: list[dict] = []
    for d in docs:
        pid = d["project_document_id"]
        tw_chunks, path = await walk_document_tree(
            project_document_id=pid,
            query=q,
            max_branch=max_branch,
            max_depth=max_depth,
            per_doc_chunk_limit=per_doc_chunk_limit,
            use_llm=use_llm_tree,
        )
        if path:
            traversal_out.append(
                {
                    "project_document_id": pid,
                    "title": d.get("title") or d.get("original_filename"),
                    "doc_type": d["doc_type"],
                    "path": path,
                }
            )
        for ch in tw_chunks:
            add_chunk(ch, float(ch.get("_score", 0)), "tree")

    ranked = sorted(merged.values(), key=lambda x: x["_score"], reverse=True)[:top_k]

    chunks_fmt: list[dict[str, Any]] = []
    for c in ranked:
        raw = {k: v for k, v in c.items() if not str(k).startswith("_")}
        out = _format_chunk(raw, c.get("_title", ""), c.get("_dtype", ""))
        out["score"] = round(float(c["_score"]), 3)
        chunks_fmt.append(out)

    return {
        "chunks": chunks_fmt,
        "traversal": traversal_out,
        "documents": [_norm_doc(d) for d in docs],
        "sources": {
            "strategy": "hybrid_text_plus_pageindex",
            "text_hits": len(text_hits),
            "tree_walk": True,
        },
    }
