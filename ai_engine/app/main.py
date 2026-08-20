from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.requirements.router import router as requirements_router
from app.test_scenarios.router import router as test_scenarios_router
from app.routers import health, internal, rag
from app.test_cases.router import router as test_cases_router
from app.test_data.router import router as test_data_router
from app.test_scripts.router import router as test_script_router
from app.traceability.router import router as traceability_router
from app.generation_validation.router import router as generation_validation_router
from app.script_repair.router import router as script_repair_router
from app.quality_generation.router import router as quality_generation_router
from app.quality_document.router import router as quality_document_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


app = FastAPI(
    title="CyFast AI Engine",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(rag.router, prefix="/v1", tags=["rag"])
app.include_router(requirements_router, prefix="/v1", tags=["requirements"])
app.include_router(test_scenarios_router, prefix="/v1", tags=["test_scenarios"])
app.include_router(traceability_router, prefix="/v1", tags=["traceability"])
app.include_router(test_cases_router, prefix="/v1", tags=["test_cases"])
app.include_router(test_data_router, prefix="/v1", tags=["test_data"])
app.include_router(test_script_router, prefix="/v1", tags=["test_script"])
app.include_router(generation_validation_router, prefix="/v1", tags=["generation_validation"])
app.include_router(internal.router, prefix="/internal", tags=["internal"])


app.include_router(script_repair_router)
app.include_router(quality_generation_router)
app.include_router(quality_document_router)
@app.get("/")
async def root():
    return {"service": "cyfast-ai-engine", "docs": "/docs"}
