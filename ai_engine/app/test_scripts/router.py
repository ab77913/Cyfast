"""Routes merged from Test_Automator: ``/v1/test_script/generate`` and ``regenerate``."""

from fastapi import APIRouter, Depends, HTTPException

from app.shared.dependencies import verify_optional_internal_key
from app.shared.llm import LLMConfigurationError, LLMTransportError
from app.shared.rate_limit import rate_limit_dependency
from app.test_scripts.schemas import GenerateRequest, GenerateResponse, RegenerateRequest
from app.test_scripts.service import (
    generate_test_script_flow,
    regenerate_test_script_flow,
)

router = APIRouter(
    dependencies=[Depends(verify_optional_internal_key), Depends(rate_limit_dependency)]
)


@router.post("/test_script/generate", response_model=GenerateResponse)
async def test_script_generate(request: GenerateRequest) -> GenerateResponse:
    """Two-phase generation: planned steps, then executable script (Selenium / Playwright / Robot)."""
    try:
        return await generate_test_script_flow(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except LLMConfigurationError as e:
        raise HTTPException(
            status_code=503,
            detail=str(e),
        ) from e
    except LLMTransportError as e:
        raise HTTPException(
            status_code=503,
            detail=f"LLM unreachable ({e}). Check LLM_PROVIDER and endpoint.",
        ) from e


@router.post("/test_script/regenerate", response_model=GenerateResponse)
async def test_script_regenerate(request: RegenerateRequest) -> GenerateResponse:
    """Refine script using feedback; optional ``session_id`` from ``/generate`` for multi-turn."""
    try:
        return await regenerate_test_script_flow(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except LLMConfigurationError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except LLMTransportError as e:
        raise HTTPException(
            status_code=503,
            detail=f"LLM unreachable ({e}). Check LLM_PROVIDER and endpoint.",
        ) from e
