from pydantic import BaseModel, Field


class ProjectScopedBody(BaseModel):
    """Common scope for QA automation endpoints (mirrors RAG-style project isolation)."""

    project_id: int = Field(..., ge=1)
    organization_id: int | None = None
