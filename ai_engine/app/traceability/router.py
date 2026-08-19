from fastapi import APIRouter, Depends

from app.shared.dependencies import verify_optional_internal_key
from app.shared.rate_limit import rate_limit_dependency
from app.traceability.service import (
    TraceabilityAnalyzeBody,
    TraceabilityGenerateBody,
    analyze_traceability,
    generate_traceability,
)

router = APIRouter(
    dependencies=[Depends(verify_optional_internal_key), Depends(rate_limit_dependency)]
)


@router.post("/traceability/analyze")
async def traceability_analyze(body: TraceabilityAnalyzeBody) -> dict:
    return await analyze_traceability(body)


@router.post("/traceability/generate")
async def traceability_generate(body: TraceabilityGenerateBody) -> dict:
    return await generate_traceability(body)
