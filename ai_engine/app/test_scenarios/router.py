from fastapi import APIRouter, Depends

from app.shared.dependencies import verify_optional_internal_key
from app.shared.rate_limit import rate_limit_dependency
from app.test_scenarios.service import (
    GenerateScenariosFromRequirementsBody,
    RegenerateScenariosFromRequirementsBody,
    generate_test_scenarios_from_requirements,
    regenerate_test_scenarios_from_requirements,
)

router = APIRouter(
    dependencies=[Depends(verify_optional_internal_key), Depends(rate_limit_dependency)]
)


@router.post("/test_scenarios/generate_from_requirements")
async def test_scenarios_generate_from_requirements(
    body: GenerateScenariosFromRequirementsBody,
) -> dict:
    return await generate_test_scenarios_from_requirements(body)


@router.post("/test_scenarios/regenerate_from_requirements")
async def test_scenarios_regenerate_from_requirements(
    body: RegenerateScenariosFromRequirementsBody,
) -> dict:
    return await regenerate_test_scenarios_from_requirements(body)
