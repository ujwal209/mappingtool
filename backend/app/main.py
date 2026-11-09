"""
AI-Powered Ontology-Driven Data Migration Platform — FastAPI Application Entrypoint.

Routers are mounted directly in this file. No aggregator, no app/api/v1/.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.errors import PlatformException
from app.api.middleware.correlation import CorrelationIdMiddleware
from app.api.middleware.error_handler import (
    platform_exception_handler,
    global_exception_handler,
)

# ── Routers ──────────────────────────────────────────────────
from app.api.routers import (
    health,
    auth,
    projects,
    systems,
    datasets,
    ontologies,
    rag,
    rules,
    runs,
    exceptions,
    manifests,
    lineage,
    events,
    audit,
    ai_assist,
    seed,
    items,
    demo,
    table_matching,
    pair_mapping,
    transformations,
    migrations
)

app = FastAPI(
    title="AI-Powered Ontology-Driven Data Migration Platform",
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Exception handlers ───────────────────────────────────────
app.add_exception_handler(PlatformException, platform_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)

# ── Middleware ───────────────────────────────────────────────
app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:\d+|http://127\.0\.0\.1:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Correlation-Id", "X-Tenant-Id", "ETag"],
)

# ── Mount all routers at API_V1_STR ──────────────────────────
PREFIX = settings.API_V1_STR  # typically "/api/v1"

app.include_router(health.router,        prefix=PREFIX, tags=["Health"])
app.include_router(auth.router,          prefix=PREFIX, tags=["User Authentication & Security"])
app.include_router(projects.router,      prefix=PREFIX, tags=["Projects & Waves"])
app.include_router(systems.router,       prefix=PREFIX, tags=["Systems & Endpoints"])
app.include_router(datasets.router,      prefix=PREFIX, tags=["Datasets & Profiling"])
app.include_router(ontologies.router,    prefix=PREFIX, tags=["Ontology & Semantic Bindings"])
app.include_router(rag.router,           prefix=PREFIX, tags=["Ontology RAG"])
app.include_router(rules.router,         prefix=PREFIX, tags=["Rule Packages & Transformation Engine"])
app.include_router(manifests.router,     prefix=PREFIX, tags=["Manifests & Version Pinning"])
app.include_router(runs.router,          prefix=PREFIX, tags=["Migration Runs & Execution"])
app.include_router(exceptions.router,    prefix=PREFIX, tags=["Exception Cases & Dispositions"])
app.include_router(lineage.router,       prefix=PREFIX, tags=["Lineage & Traceability"])
app.include_router(events.router,        prefix=PREFIX, tags=["Immutable Audit Trail"])
app.include_router(audit.router,         prefix=PREFIX, tags=["Immutable Audit Trail"])
app.include_router(ai_assist.router,     prefix=PREFIX, tags=["AI Assistance & Groq Pool"])
app.include_router(seed.router,          prefix=PREFIX, tags=["Bootstrap & Simulation"])
app.include_router(items.router,         prefix=PREFIX, tags=["Health"])
app.include_router(demo.router, prefix=PREFIX, tags=["Demo & Simulation"])
app.include_router(table_matching.router, prefix=PREFIX, tags=["Table Pair Matching"])
app.include_router(pair_mapping.router, prefix=PREFIX, tags=["Pair Matching"])
app.include_router(
    transformations.router,
    prefix=PREFIX,
    tags=["Transformations"],
)
app.include_router(
    migrations.router,
    prefix=PREFIX,
    tags=["Migrations"],
)


# ── Root ─────────────────────────────────────────────────────
@app.get("/", tags=["Health"], summary="API Root & Service Discovery")
def root():
    return {
        "platform": "AI-Powered Ontology-Driven Data Migration Platform",
        "version": settings.VERSION,
        "docs": "/docs",
        "redoc": "/redoc",
        "api_v1": settings.API_V1_STR,
        "openapi": f"{settings.API_V1_STR}/openapi.json",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)