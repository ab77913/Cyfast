"""Mongo access for project document chunks (PageIndex tree nodes)."""

from __future__ import annotations

from typing import Any

from pymongo import MongoClient

from app.config import settings

_client: MongoClient | None = None


def get_db():
    global _client
    if _client is None:
        _client = MongoClient(settings.mongodb_uri)
    return _client.get_database()


def chunks_coll():
    return get_db()[settings.chunks_collection]


def get_children(project_document_id: int, parent_node_id: str | None) -> list[dict[str, Any]]:
    q: dict = {"project_document_id": project_document_id, "parent_node_id": parent_node_id}
    return list(
        chunks_coll()
        .find(q)
        .sort([("order_index", 1), ("node_id", 1)])
    )


def get_root(project_document_id: int) -> dict[str, Any] | None:
    return chunks_coll().find_one(
        {"project_document_id": project_document_id, "node_type": "DOCUMENT"}
    )


def text_search_chunks(
    query: str,
    project_id: int,
    organization_id: int | None,
    doc_types: list[str] | None,
    project_document_ids: list[int] | None,
    limit: int,
) -> list[dict]:
    """
    Strategy A: MongoDB $text over heading/summary/content with structural filters.
    """
    filt: dict = {
        "project_id": project_id,
        "node_type": "CHUNK",
        "$text": {"$search": query},
    }
    if organization_id is not None:
        filt["organization_id"] = organization_id
    if doc_types:
        filt["doc_type"] = {"$in": doc_types}
    if project_document_ids:
        filt["project_document_id"] = {"$in": project_document_ids}

    cur = chunks_coll().find(
        filt,
        {"score": {"$meta": "textScore"}},
    ).sort([("score", {"$meta": "textScore"})]).limit(limit)
    return list(cur)
