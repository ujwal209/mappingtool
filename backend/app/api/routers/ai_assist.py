"""
Groq AI Key Management & Round-Robin Telemetry API.
Directly implements user requirements for managing multiple Groq API keys in round-robin format
with rich OpenAPI documentation.
"""

from fastapi import APIRouter, Depends
from typing import Dict, Any, List
from app.models.schemas import UpdateGroqKeysRequest, GroqPoolMetricsResponse
from app.core.groq_manager import groq_manager
from app.api.middleware.auth_rbac import get_auth_context, AuthContext
from app.core.security import mask_secret

router = APIRouter()


@router.get(
    "/ai/groq-pool",
    response_model=GroqPoolMetricsResponse,
    summary="Get Groq Round-Robin Key Pool Telemetry",
    response_description="Metrics showing total keys, active call counts, success/failure counts, and masked keys",
)
def get_groq_pool_metrics(auth: AuthContext = Depends(get_auth_context)):
    """
    **Retrieve real-time metrics and health tracking for the Groq API key pool** (User Requirement).

    ### Features:
    - Displays active key count in the round-robin rotation.
    - Tracks per-key invocation volume, successful completions, and failure counts.
    - Zero Secret Leakage (TA-008): All keys are strictly masked (e.g. `gsk_...xxxx`).
    """
    metrics = groq_manager.get_metrics()
    return GroqPoolMetricsResponse(
        total_keys=groq_manager.get_keys_count(),
        active_keys_metrics=metrics,
        round_robin_strategy="ThreadSafeRoundRobinWithFailover",
    )


@router.post(
    "/ai/groq-pool/keys",
    response_model=Dict[str, Any],
    status_code=201,
    summary="Add API Keys to Groq Round-Robin Pool",
    response_description="Confirmation of added keys and updated total pool size",
)
def add_groq_keys(req: UpdateGroqKeysRequest, auth: AuthContext = Depends(get_auth_context)):
    """
    **Dynamically register multiple Groq API keys into the active round-robin pool** (User Requirement).

    Added keys immediately participate in load-distributed inference and failover rotation.
    """
    added_count = groq_manager.add_keys(req.keys)
    return {
        "status": "SUCCESS",
        "added_count": added_count,
        "total_active_keys": groq_manager.get_keys_count(),
        "keys_preview": [mask_secret(k) for k in req.keys],
    }


@router.post(
    "/ai/groq-pool/test",
    response_model=Dict[str, Any],
    summary="Test Groq Round-Robin Connectivity",
    response_description="Live test prompt response, model used, and masked round-robin key used",
)
def test_groq_round_robin(auth: AuthContext = Depends(get_auth_context)):
    """
    **Execute a live test prompt against Groq using the next key in round-robin sequence.**
    Verifies inference connectivity and records per-key health telemetry.
    """
    client, used_key = groq_manager.get_groq_client()
    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "Respond with 'PONG'"}],
            max_tokens=5,
        )
        groq_manager.record_success(used_key)
        return {
            "status": "HEALTHY",
            "key_used_masked": mask_secret(used_key),
            "response": completion.choices[0].message.content.strip(),
        }
    except Exception as e:
        groq_manager.record_failure(used_key, str(e))
        return {
            "status": "FAILED",
            "key_used_masked": mask_secret(used_key),
            "error": str(e),
        }


@router.get(
    "/ai/gemini-pool",
    response_model=Dict[str, Any],
    summary="Get Gemini Round-Robin Embedding Pool Telemetry",
    response_description="Metrics showing total Gemini keys, active call counts, success/failure counts, and masked keys",
)
def get_gemini_pool_metrics(auth: AuthContext = Depends(get_auth_context)):
    """
    **Retrieve real-time telemetry and health metrics for the Gemini API key pool** (User Requirement).
    Shows round-robin rotation state, call volume, and masked keys.
    """
    from app.core.gemini_manager import gemini_manager
    return {
        "total_keys": len(gemini_manager.keys),
        "keys_telemetry": gemini_manager.get_pool_status(),
        "round_robin_strategy": "ThreadSafeRoundRobinWithFailoverAndCooldown",
        "embedding_model": "models/gemini-embedding-001",
        "dimension": 768,
    }


@router.post(
    "/ai/gemini-pool/test",
    response_model=Dict[str, Any],
    summary="Test Gemini Round-Robin Vector Embedding Generation",
    response_description="Generates a test vector embedding using the next active Gemini key",
)
def test_gemini_round_robin(auth: AuthContext = Depends(get_auth_context)):
    """
    **Execute a live vector embedding test against Gemini using round-robin rotation.**
    Verifies vector embedding dimensionality (768) and records per-key health telemetry.
    """
    from app.core.gemini_manager import gemini_manager
    embedding = gemini_manager.generate_embedding("Test ontology vector embedding")
    return {
        "status": "HEALTHY",
        "embedding_dimensions": len(embedding),
        "vector_sample": embedding[:5],
        "total_active_keys": len(gemini_manager.keys),
    }
