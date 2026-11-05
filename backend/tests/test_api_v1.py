"""
FastAPI End-to-End API Test Suite.
Tests API Gateway behaviors:
- X-Correlation-Id header handling & propagation (Section 6)
- Idempotency-Key reuse & HTTP 409 conflict detection (Section 6)
- Standard Error Envelopes (Section 6)
- Groq pool telemetry
- End-to-end bootstrap and migration run via REST APIs
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_endpoint(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert "status" in res.json()


def test_correlation_id_propagation(client):
    """Verify X-Correlation-Id is returned on responses (Section 6)."""
    custom_corr_id = "corr-test-123456"
    res = client.get("/api/v1/health", headers={"X-Correlation-Id": custom_corr_id})
    assert res.status_code == 200
    assert res.headers.get("X-Correlation-Id") == custom_corr_id


def test_idempotency_key_behavior(client):
    """
    Verify Idempotency-Key:
    - Same payload returns cached response
    - Different payload returns HTTP 409 Conflict (Section 6)
    """
    key = "idem-key-test-999"
    payload_1 = {"name": "Test Project 1", "description": "Original"}
    payload_2 = {"name": "Test Project 2", "description": "Different"}

    # 1. First creation
    res1 = client.post("/api/v1/projects", json=payload_1, headers={"Idempotency-Key": key})
    assert res1.status_code == 201
    proj_id = res1.json()["project_id"]

    # 2. Replay with identical payload -> returns original operation
    res2 = client.post("/api/v1/projects", json=payload_1, headers={"Idempotency-Key": key})
    assert res2.status_code == 201
    assert res2.json()["project_id"] == proj_id

    # 3. Replay with DIFFERENT payload -> returns HTTP 409 Conflict
    res3 = client.post("/api/v1/projects", json=payload_2, headers={"Idempotency-Key": key})
    assert res3.status_code == 409
    error_body = res3.json()
    assert error_body["code"] == "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH"
    assert error_body["category"] == "CONFLICT"


def test_groq_pool_api(client):
    """Verify Groq pool metrics endpoint returns masked keys (TA-008)."""
    res = client.get("/api/v1/ai/groq-pool")
    assert res.status_code == 200
    data = res.json()
    assert "total_keys" in data
    assert "active_keys_metrics" in data
    for m in data["active_keys_metrics"]:
        assert "gsk_" in m["key_masked"]
        assert "..." in m["key_masked"]


def test_full_bootstrap_and_run_lifecycle(client):
    """
    Full end-to-end integration test via API:
    Bootstrap -> Proposal -> Approval -> Build Rule Pkg -> Create Manifest -> Run -> Sign-off -> Lineage
    """
    # 1. Bootstrap mock data
    boot_res = client.post("/api/v1/bootstrap/mock-seed?scenario=crm")
    assert boot_res.status_code == 201
    boot_data = boot_res.json()
    project_id = boot_data["project_id"]
    wave_id = boot_data["wave_id"]
    src_ds_id = boot_data["source_dataset_id"]
    tgt_ds_id = boot_data["target_dataset_id"]
    ont_id = boot_data["ontology_version_id"]

    # 2. Generate Mapping Proposals (deterministic fallback for speed in tests)
    prop_res = client.post(
        f"/api/v1/mapping-sets/{project_id}/proposals",
        json={
            "source_dataset_id": src_ds_id,
            "target_dataset_id": tgt_ds_id,
            "use_ai": False,
        },
    )
    assert prop_res.status_code == 201
    mapping_set = prop_res.json()
    mapping_id = mapping_set["mapping_version_id"]

    # 3. Approve Mapping Version
    appr_res = client.post(
        f"/api/v1/mapping-sets/{mapping_id}/versions/1.0.0/approve",
        json={"actor": "lead-approver@company.com", "comments": "Approved"},
    )
    assert appr_res.status_code == 200
    assert appr_res.json()["status"] == "APPROVED"

    # 4. Build Rule Package
    rule_res = client.post(
        f"/api/v1/rule-packages/{mapping_id}/build",
        json={"mapping_version_id": mapping_id, "semantic_version": "1.0.0"},
    )
    assert rule_res.status_code == 201
    rule_pkg = rule_res.json()
    rule_pkg_id = rule_pkg["rule_package_id"]
    assert rule_pkg["signature"] is not None

    # 5. Create Run Manifest (Pins versions - TA-001)
    man_res = client.post(
        f"/api/v1/waves/{wave_id}/manifests",
        json={
            "project_id": project_id,
            "ontology_version_id": ont_id,
            "mapping_version_id": mapping_id,
            "rule_package_id": rule_pkg_id,
            "source_dataset_id": src_ds_id,
            "target_dataset_id": tgt_ds_id,
        },
    )
    assert man_res.status_code == 201
    manifest = man_res.json()
    manifest_id = manifest["manifest_id"]
    assert manifest["manifest_hash"] is not None

    # 6. Start Run
    run_res = client.post(f"/api/v1/manifests/{manifest_id}/runs")
    assert run_res.status_code == 202
    run_info = run_res.json()
    run_id = run_info["run_id"]
    assert run_id is not None

    # 7. Check Run Status & Evidence
    evidence_res = client.get(f"/api/v1/runs/{run_id}/evidence")
    assert evidence_res.status_code == 200
    evidence = evidence_res.json()
    assert "evidence_hash" in evidence

    # 8. Sign-off Run (Locks evidence hash & purges staging - TA-007)
    signoff_res = client.post(
        f"/api/v1/runs/{run_id}/signoff",
        json={"actor": "business-director@company.com", "comments": "Cutover approved"},
    )
    assert signoff_res.status_code == 200
    assert signoff_res.json()["state"] == "SIGNED_OFF"

    # 9. Verify Lineage Trace (TA-012)
    # The CRM dataset has client_id "CL-1001" in the first record
    lineage_res = client.get(f"/api/v1/runs/{run_id}/lineage/CL-1001")
    assert lineage_res.status_code == 200
    lineage = lineage_res.json()
    assert lineage["run_id"] == run_id
    assert lineage["mapping_version_id"] == mapping_id
    assert lineage["rule_package_id"] == rule_pkg_id
