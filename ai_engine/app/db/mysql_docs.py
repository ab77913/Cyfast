"""MySQL: resolve which project documents are INDEXED (metadata not stored on every chunk)."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any

import pymysql

from app.config import settings


@contextmanager
def _conn():
    c = pymysql.connect(
        host=settings.mysql_host,
        port=settings.mysql_port,
        user=settings.mysql_user,
        password=settings.mysql_password,
        database=settings.mysql_database,
        cursorclass=pymysql.cursors.DictCursor,
    )
    try:
        yield c
    finally:
        c.close()


def fetch_indexed_documents(
    project_id: int,
    organization_id: int | None,
    doc_types: list[str] | None,
    project_document_ids: list[int] | None,
    limit: int,
) -> list[dict[str, Any]]:
    """Rows from project_document suitable for candidate doc list (+ UI parity with Node)."""
    cond = ["pd.project_id = %s", "pd.status = %s", "pd.deleted_date IS NULL"]
    params: list[Any] = [project_id, "INDEXED"]
    if organization_id is not None:
        cond.append("pd.organization_id = %s")
        params.append(organization_id)
    if doc_types:
        placeholders = ",".join(["%s"] * len(doc_types))
        cond.append(f"pd.doc_type IN ({placeholders})")
        params.extend(doc_types)
    if project_document_ids:
        placeholders = ",".join(["%s"] * len(project_document_ids))
        cond.append(f"pd.project_document_id IN ({placeholders})")
        params.extend(project_document_ids)

    sql = f"""
        SELECT pd.project_document_id, pd.title, pd.original_filename, pd.doc_type,
               pd.version, pd.status
        FROM project_document pd
        WHERE {' AND '.join(cond)}
        ORDER BY pd.modified_date DESC
        LIMIT %s
    """
    params.append(limit)
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(sql, params)
            return list(cur.fetchall())
