"""Strategy C: PageIndex-style tree walk. Optional LLM chooses branches; else lexical scores."""

from __future__ import annotations

import json
from typing import Any, Awaitable, Callable

from app.config import settings
from app.db.mongo import get_children
from app.rag.lexical import score_node, tokenize
from app.shared.llm import chat_completion, rag_tree_llm_ready
from app.shared.llm_profiles import LLMProfile

LlmRouter = Callable[..., Awaitable[float]]


async def llm_score_section(
    *,
    query: str,
    section: dict,
    parent: dict | None,
) -> float:
    if not rag_tree_llm_ready():
        return score_node(section, tokenize(query))

    sys = (
        "You are routing a user question through a document outline. "
        "Score how likely this section is relevant (0.0 to 10.0). Reply with JSON only: "
        '{"score": number}'
    )
    user = json.dumps(
        {
            "query": query,
            "section_heading": section.get("heading"),
            "section_summary": (section.get("summary") or "")[:600],
            "section_path": section.get("section_path"),
            "parent_heading": (parent or {}).get("heading"),
        }
    )

    try:
        text = await chat_completion(
            messages=[
                {"role": "system", "content": sys},
                {"role": "user", "content": user},
            ],
            temperature=0,
            max_tokens=80,
            json_object=False,
            profile=LLMProfile.RAG_TREE,
        )
    except Exception:
        return score_node(section, tokenize(query))

    try:
        j = json.loads(text)
        s = float(j.get("score", 0))
        return max(0.0, min(15.0, s * 1.5))
    except (json.JSONDecodeError, ValueError, TypeError):
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                j = json.loads(text[start:end])
                s = float(j.get("score", 0))
                return max(0.0, min(15.0, s * 1.5))
            except (json.JSONDecodeError, ValueError, TypeError):
                pass
    return score_node(section, tokenize(query))


async def walk_document_tree(
    *,
    project_document_id: int,
    query: str,
    max_branch: int,
    max_depth: int,
    per_doc_chunk_limit: int,
    use_llm: bool,
) -> tuple[list[dict], list[dict]]:
    """
    Returns (chunk_nodes_with__score, traversal_path_nodes).
    """
    from app.db.mongo import get_root

    root = get_root(project_document_id)
    if not root:
        return [], []

    q_tokens = tokenize(query)
    trajectory: list[dict] = []
    collected: list[dict] = []

    async def visit(node: dict, depth: int, parent: dict | None) -> None:
        if depth > max_depth:
            return

        trajectory.append(
            {
                "node_id": node.get("node_id"),
                "heading": node.get("heading"),
                "depth": node.get("depth"),
                "section_path": node.get("section_path"),
            }
        )

        parent_id = node.get("node_id")
        children = get_children(project_document_id, parent_id)
        if not children:
            return

        sections = [c for c in children if c.get("node_type") == "SECTION"]
        chunks = [c for c in children if c.get("node_type") == "CHUNK"]

        for ch in chunks:
            sc = score_node(ch, q_tokens) + 0.5
            ch = {**ch, "_score": sc * settings.rag_tree_weight}
            collected.append(ch)

        if not sections:
            return

        ranked: list[tuple[dict, float]] = []
        for sec in sections:
            if use_llm and rag_tree_llm_ready():
                s = await llm_score_section(
                    query=query, section=sec, parent=parent
                )
            else:
                s = score_node(sec, q_tokens)
            ranked.append((sec, s))

        ranked.sort(key=lambda x: x[1], reverse=True)
        # Mirror Node: take branches with score>0, or at root allow first max_branch by order
        picked: list[dict] = []
        for idx, (sec, sc) in enumerate(ranked):
            if sc > 0 or (depth == 0 and idx < max_branch):
                picked.append(sec)
        picked = picked[:max_branch]

        for sec in picked:
            await visit(sec, depth + 1, node)

    await visit(root, 0, None)

    collected.sort(key=lambda c: c.get("_score", 0), reverse=True)
    return collected[:per_doc_chunk_limit], trajectory
