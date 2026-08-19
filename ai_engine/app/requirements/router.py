from fastapi import APIRouter, Depends

from app.requirements.service import (
    GenerateFromDocumentsBody,
    GenerateRequirementsBody,
    RegenerateFromDocumentsBody,
    generate_requirements,
    generate_requirements_from_documents,
    regenerate_requirements_from_documents,
)
from app.shared.dependencies import verify_optional_internal_key
from app.shared.rate_limit import rate_limit_dependency

router = APIRouter(
    dependencies=[Depends(verify_optional_internal_key), Depends(rate_limit_dependency)]
)


@router.post("/requirements/generate")
async def requirements_generate(body: GenerateRequirementsBody) -> dict:
    return await generate_requirements(body)


@router.post("/requirements/generate_from_documents")
async def requirements_generate_from_documents(body: GenerateFromDocumentsBody) -> dict:
    return await generate_requirements_from_documents(body)


@router.post("/requirements/regenerate_from_documents")
async def requirements_regenerate_from_documents(
    body: RegenerateFromDocumentsBody,
) -> dict:
    return await regenerate_requirements_from_documents(body)
