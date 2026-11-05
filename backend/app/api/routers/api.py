"""
Combined API v1 Router.
Aggregates all control-plane, data-plane, and AI endpoints under /api/v1.
"""

from fastapi import APIRouter
from backend.app.api.routers import (
    systems,
)
from backend.app.api.routers import ai_assist, audit, auth, datasets, events, exceptions, health, lineage, manifests, mapping as legacy_mapping, mappings, ontologies, projects, rules, runs, seed

api_router = APIRouter()

# Core Lifecycle Endpoints (PRD Section 5)
api_router.include_router(auth.router, tags=["User Authentication & Security"])
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(events.router, tags=["Event-Driven Architecture & Stream"])
api_router.include_router(projects.router, tags=["Projects & Waves"])
api_router.include_router(systems.router, tags=["Systems & Endpoints"])
api_router.include_router(datasets.router, tags=["Datasets & Profiling"])
api_router.include_router(ontologies.router, tags=["Ontology & Semantic Bindings"])
api_router.include_router(mappings.router, tags=["Mapping Sets & Proposals"])
api_router.include_router(rules.router, tags=["Rule Packages & Transformation Engine"])
api_router.include_router(manifests.router, tags=["Manifests & Version Pinning"])
api_router.include_router(runs.router, tags=["Migration Runs & Execution"])
api_router.include_router(exceptions.router, tags=["Exception Cases & Dispositions"])
api_router.include_router(lineage.router, tags=["Lineage & Traceability"])
api_router.include_router(audit.router, tags=["Immutable Audit Trail"])
api_router.include_router(ai_assist.router, tags=["AI Assistance & Groq Pool"])
api_router.include_router(seed.router, tags=["Bootstrap & Simulation"])

# Legacy / existing UI compatibility router
api_router.include_router(legacy_mapping.router, prefix="/mapping", tags=["Legacy Mapping Workbench"])
