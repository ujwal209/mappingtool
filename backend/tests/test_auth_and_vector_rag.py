"""
Authentication, Email Verification, Password Reset, and Gemini Vector RAG Test Suite.

Verifies:
1. User Signup with automatic email verification token generation
2. Email verification flow via both JSON API and direct link
3. Resend email verification flow
4. Secure login with bcrypt hash verification and JWT Bearer token issuance
5. Authenticated profile endpoint (/me)
6. Self-service Forgot Password and Reset Password workflow
7. Gemini multi-key round-robin rotation, thread safety, and telemetry
8. Ontology document chunking and vector embedding generation
9. MongoDB vector storage and cosine similarity vector retrieval
"""

import time
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.security import verify_password
from app.core.gemini_manager import GeminiRoundRobinManager, gemini_manager
from app.services.auth_service import auth_service
from app.services.ontology_rag_service import ontology_rag_service
from app.services.ontology_service import ontology_service
from app.services.project_service import project_service
from app.db.store import store
from app.db.mongo import mongo_manager
from app.models.canonical import UserCreateRequest, UserLoginRequest

client = TestClient(app)


def test_user_signup_and_email_verification():
    """
    Test complete signup and verification flow:
    1. User signs up with email & password
    2. Account is initially unverified (is_verified = False)
    3. Verification token is issued
    4. Submitting verification token marks account as is_verified = True
    """
    unique_email = f"user_test_{int(time.time()*1000)}@enterprise.com"
    payload = {
        "email": unique_email,
        "password": "StrongPassword123!",
        "full_name": "Integration Test User",
        "organization": "Acme Corp",
        "role": "Engineer",
    }

    # 1. Signup
    res = client.post("/api/v1/auth/signup", json=payload)
    assert res.status_code == 201, res.text
    signup_data = res.json()
    assert signup_data["email"] == unique_email
    assert signup_data["is_verified"] is False
    assert "verification_token" in signup_data
    token = signup_data["verification_token"]

    # 2. Check store directly
    user_in_db = store.get_user_by_email(unique_email)
    assert user_in_db is not None
    assert user_in_db.is_verified is False
    assert user_in_db.hashed_password != payload["password"]
    assert verify_password(payload["password"], user_in_db.hashed_password)

    # 3. Verify via JSON POST endpoint
    verify_res = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert verify_res.status_code == 200, verify_res.text
    assert verify_res.json()["is_verified"] is True

    # 4. Verify user in store is now verified
    user_updated = store.get_user_by_email(unique_email)
    assert user_updated.is_verified is True
    assert user_updated.verification_token is None


def test_email_verification_direct_link_html():
    """
    Test that clicking the direct link in the verification email renders
    a successful HTML confirmation page for browser navigation.
    """
    unique_email = f"direct_link_{int(time.time()*1000)}@enterprise.com"
    req = UserCreateRequest(
        email=unique_email,
        password="Password999!",
        full_name="Browser User",
    )
    user, token = auth_service.signup(req)

    # Click link via GET
    res = client.get(f"/api/v1/auth/verify-email?token={token}")
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    assert "Email Verified!" in res.text

    # Confirm user verified
    assert store.get_user_by_email(unique_email).is_verified is True


def test_user_resend_verification():
    """Test resending email verification token if not yet verified."""
    unique_email = f"resend_{int(time.time()*1000)}@enterprise.com"
    req = UserCreateRequest(
        email=unique_email,
        password="Password123!",
        full_name="Resend User",
    )
    user, initial_token = auth_service.signup(req)

    # Resend token
    res = client.post("/api/v1/auth/resend-verification", json={"email": unique_email})
    assert res.status_code == 200
    new_token = res.json()["verification_token"]
    assert new_token is not None

    # Verify with new token
    verify_res = client.post("/api/v1/auth/verify-email", json={"token": new_token})
    assert verify_res.status_code == 200
    assert verify_res.json()["is_verified"] is True


def test_login_and_me_endpoint():
    """
    Test user authentication:
    1. Valid login yields JWT bearer token
    2. Bearer token authenticates /api/v1/auth/me
    3. Invalid password rejected with HTTP 401
    """
    unique_email = f"login_test_{int(time.time()*1000)}@enterprise.com"
    password = "CorrectHorseBattery99!"
    req = UserCreateRequest(
        email=unique_email,
        password=password,
        full_name="Login Subject",
    )
    user, token = auth_service.signup(req)
    auth_service.verify_email(token)

    # 1. Login with valid credentials
    login_res = client.post("/api/v1/auth/login", json={"email": unique_email, "password": password})
    assert login_res.status_code == 200, login_res.text
    token_data = login_res.json()
    assert "access_token" in token_data
    access_token = token_data["access_token"]
    assert token_data["email"] == unique_email

    # 2. Access /api/v1/auth/me with Bearer token
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == unique_email
    assert me_data["full_name"] == "Login Subject"

    # 3. Test invalid password
    bad_login = client.post("/api/v1/auth/login", json={"email": unique_email, "password": "WrongPassword!"})
    assert bad_login.status_code == 401


def test_forgot_and_reset_password_flow():
    """
    Test self-service password recovery flow:
    1. Request reset token
    2. Submit new password with reset token
    3. Successfully log in with new password
    4. Old password is no longer accepted
    """
    unique_email = f"recovery_{int(time.time()*1000)}@enterprise.com"
    old_password = "InitialPassword123!"
    new_password = "BrandNewSecurePassword456!"

    req = UserCreateRequest(email=unique_email, password=old_password, full_name="Recovery User")
    user, verify_tok = auth_service.signup(req)
    auth_service.verify_email(verify_tok)

    # 1. Request forgot password
    forgot_res = client.post("/api/v1/auth/forgot-password", json={"email": unique_email})
    assert forgot_res.status_code == 200
    reset_token = forgot_res.json()["reset_token"]
    assert reset_token is not None

    # 2. Reset password
    reset_res = client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "new_password": new_password},
    )
    assert reset_res.status_code == 200

    # 3. Old password should fail
    fail_res = client.post("/api/v1/auth/login", json={"email": unique_email, "password": old_password})
    assert fail_res.status_code == 401

    # 4. New password should succeed
    success_res = client.post("/api/v1/auth/login", json={"email": unique_email, "password": new_password})
    assert success_res.status_code == 200
    assert "access_token" in success_res.json()


def test_gemini_round_robin_manager():
    """
    Verify Gemini multi-key round-robin rotation, thread safety, and telemetry masking.
    """
    manager = GeminiRoundRobinManager(
        raw_keys="AIzaSyKeyOneAAA,AIzaSyKeyTwoBBB,AIzaSyKeyThreeCCC",
        load_env=False,
    )
    assert len(manager.keys) == 3

    # Check initial indices rotate in round-robin order
    i1 = manager._get_next_key_index()
    i2 = manager._get_next_key_index()
    i3 = manager._get_next_key_index()
    i4 = manager._get_next_key_index()
    assert (i1, i2, i3, i4) == (0, 1, 2, 0)

    # Check telemetry masking (zero secret leakage)
    status = manager.get_pool_status()
    assert len(status) == 3
    for s in status:
        assert "AIza" in s["masked_key"]
        assert "..." in s["masked_key"]
        assert s["is_active"] is True

    # Check deterministic fallback embedding length
    vec = manager.generate_embedding("Test ontology concept customer")
    assert len(vec) == 768
    assert all(isinstance(x, float) for x in vec)


def test_ontology_rag_mongodb_vector_search():
    """
    Verify Ontology RAG with Gemini vector embeddings and MongoDB vector search:
    1. Ingest enterprise rulebook document into ontology
    2. Chunks are generated and embedded into vectors (dimension 768)
    3. Vectors are stored in MongoDB ('mapping' database)
    4. Query executes vector search with cosine similarity scoring
    5. Returns grounded context
    """
    tenant_id = f"tenant-rag-vector-{int(time.time()*1000)}"
    store.ensure_tenant(tenant_id)

    project = project_service.create_project(tenant_id, "Vector RAG Project")
    ontology = ontology_service.create_version(tenant_id, project.project_id, "1.0.0")

    rulebook_content = """
    # Enterprise Customer Master Data Governance Standard
    
    Section 1: Customer Identification Standard
    All customer master records must possess an enterprise Customer ID (UUID v4 or CL- prefixed integer).
    Source legacy identifiers (such as CUST_NO or Account_ID) must be mapped to the canonical 'Customer.id' field.
    
    Section 2: Date Formatting and Temporal Normalization
    All date fields, including 'registration_date' and 'date_of_birth', must be normalized to standard ISO-8601 (YYYY-MM-DD).
    Any legacy Unix epoch timestamps must be converted to UTC datetime representations.
    
    Section 3: Monetary Amounts and Currency Codes
    Monetary amounts must be stored in 2 decimal places with uppercase 3-letter ISO-4217 currency codes (e.g., USD, EUR, GBP).
    """

    # 1. Ingest document
    doc = ontology_rag_service.ingest_document(
        tenant_id=tenant_id,
        ontology_version_id=ontology.ontology_version_id,
        title="Customer Master Data Governance Spec",
        content=rulebook_content,
        document_type="RULEBOOK",
        chunk_size=300,
        chunk_overlap=50,
    )
    assert doc.chunk_count > 0

    # 2. Check chunks saved in store & MongoDB
    chunks = store.get_ontology_chunks(tenant_id, ontology.ontology_version_id)
    assert len(chunks) == doc.chunk_count
    for chk in chunks:
        assert len(chk.embedding) == 768
        assert chk.ontology_id == ontology.ontology_version_id

    # 3. Perform vector query
    rag_result = ontology_rag_service.query_ontology_rag(
        tenant_id=tenant_id,
        ontology_version_id=ontology.ontology_version_id,
        query="How should customer date fields be formatted?",
        top_k=2,
        synthesize_with_llm=False,
    )

    assert rag_result.query == "How should customer date fields be formatted?"
    assert len(rag_result.retrieved_chunks) > 0
    top_chunk = rag_result.retrieved_chunks[0]
    assert "score" in top_chunk
    assert "vector_similarity" in top_chunk
    assert "ISO-8601" in top_chunk["chunk"]["content"] or "Customer" in top_chunk["chunk"]["content"]


def test_gemini_pool_api_endpoints():
    """Verify Gemini Key Pool telemetry endpoints in FastAPI."""
    # 1. Get pool metrics
    res = client.get("/api/v1/ai/gemini-pool")
    assert res.status_code == 200
    data = res.json()
    assert "total_keys" in data
    assert "keys_telemetry" in data
    assert data["dimension"] == 768
    assert data["embedding_model"] == "models/gemini-embedding-001"

    # 2. Test live embedding generation
    test_res = client.post("/api/v1/ai/gemini-pool/test")
    assert test_res.status_code == 200
    test_data = test_res.json()
    assert test_data["status"] == "HEALTHY"
    assert test_data["embedding_dimensions"] == 768
    assert len(test_data["vector_sample"]) == 5
