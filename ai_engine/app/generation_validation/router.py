"""HTTP routes for validating AI-generated drafts before human approval."""

from fastapi import APIRouter, Depends

from app.shared.dependencies import verify_optional_internal_key
from app.shared.rate_limit import rate_limit_dependency
from app.generation_validation.service import (
    ValidateGeneratedRequirementsBody,
    ValidateGeneratedTestCasesBody,
    ValidateGeneratedTestScenariosBody,
    ValidateGenericArtifactBody,
    validate_generated_requirements,
    validate_generated_test_cases,
    validate_generated_test_scenarios,
    validate_generic_artifact,
)

router = APIRouter(
    dependencies=[Depends(verify_optional_internal_key), Depends(rate_limit_dependency)]
)


@router.post("/generation_validation/requirements")
async def generation_validate_requirements(
    body: ValidateGeneratedRequirementsBody,
) -> dict:
    return await validate_generated_requirements(body)


@router.post("/generation_validation/test_cases")
async def generation_validate_test_cases(
    body: ValidateGeneratedTestCasesBody,
) -> dict:
    return await validate_generated_test_cases(body)


@router.post("/generation_validation/test_scenarios")
async def generation_validate_test_scenarios(
    body: ValidateGeneratedTestScenariosBody,
) -> dict:
    return await validate_generated_test_scenarios(body)


@router.post("/generation_validation/other")
async def generation_validate_other(
    body: ValidateGenericArtifactBody,
) -> dict:
    return await validate_generic_artifact(body)
