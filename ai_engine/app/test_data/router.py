from fastapi import APIRouter, Depends

from app.shared.dependencies import verify_optional_internal_key
from app.shared.rate_limit import rate_limit_dependency
from app.test_data.service import GenerateTestDataBody, generate_test_data

router = APIRouter(
    dependencies=[Depends(verify_optional_internal_key), Depends(rate_limit_dependency)]
)


@router.post("/test_data/generate")
async def test_data_generate(body: GenerateTestDataBody) -> dict:
    return await generate_test_data(body)
