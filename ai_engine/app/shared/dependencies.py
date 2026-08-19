"""Optional internal auth for /v1 QA automation routes (set INTERNAL_API_KEY in production)."""

from fastapi import Header, HTTPException

from app.config import settings


async def verify_optional_internal_key(
    x_internal_key: str | None = Header(default=None, alias="X-Internal-Key"),
) -> None:
    expected = settings.internal_api_key
    if not expected:
        return
    if not x_internal_key or x_internal_key != expected:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing X-Internal-Key",
        )
