from fastapi import APIRouter, Depends

from app.shared.dependencies import verify_optional_internal_key
from app.shared.rate_limit import rate_limit_dependency
from app.test_cases.service import (
    GenerateTestCasesBody,
    GenerateTestCasesFromScenariosBody,
    RegenerateTestCasesFromScenariosBody,
    generate_test_cases,
    generate_test_cases_from_scenarios,
    regenerate_test_cases_from_scenarios,
)

router = APIRouter(
    dependencies=[Depends(verify_optional_internal_key), Depends(rate_limit_dependency)]
)


@router.post("/test_cases/generate")
async def test_cases_generate(body: GenerateTestCasesBody) -> dict:
    return await generate_test_cases(body)


@router.post("/test_cases/generate_from_scenarios")
async def test_cases_generate_from_scenarios(
    body: GenerateTestCasesFromScenariosBody,
) -> dict:
    return await generate_test_cases_from_scenarios(body)


@router.post("/test_cases/regenerate_from_scenarios")
async def test_cases_regenerate_from_scenarios(
    body: RegenerateTestCasesFromScenariosBody,
) -> dict:
    return await regenerate_test_cases_from_scenarios(body)
