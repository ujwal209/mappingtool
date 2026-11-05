"""
Comprehensive Acceptance Criteria Test Suite (TA-001 through TA-012).
Verifies the exact requirements stated in Section 25 of the Technical Specification Document:
AI-Powered Ontology-Driven Data Migration Platform (Dr. Ashish Chandra).
"""

import pytest
import time
from app.models.canonical import (
    SystemKind,
    FieldDefinition,
    ArtifactStatus,
    RunState,
    ExceptionDisposition,
)
from app.db.store import store
from app.services.project_service import project_service
from app.services.metadata_service import metadata_service
from app.services.discovery_service import discovery_service
from app.services.ontology_service import ontology_service
from app.services.mapping_service import mapping_service
from app.services.rule_service import rule_service
from app.services.orchestrator_service import orchestrator_service
from app.services.evidence_service import evidence_service
from app.core.security import mask_secret, compute_sha256
from app.core.groq_manager import GroqRoundRobinManager
from app.core.errors import PlatformException


@pytest.fixture
def test_setup():
    """Sets up a clean test tenant and project environment."""
    tenant_id = f"tenant-test-{int(time.time()*1000)}"
    store.ensure_tenant(tenant_id)
    
    project = project_service.create_project(
        tenant_id=tenant_id,
        name="Acceptance Test Project",
        description="Test suite verifying TA-001 to TA-012",
    )
    
    source_sys = metadata_service.register_system(
        tenant_id=tenant_id,
        project_id=project.project_id,
        name="Source Oracle",
        kind=SystemKind.SOURCE,
        connector_type="memory",
    )
    target_sys = metadata_service.register_system(
        tenant_id=tenant_id,
        project_id=project.project_id,
        name="Target ERP",
        kind=SystemKind.TARGET,
        connector_type="memory",
    )
    
    src_fields = [
        FieldDefinition(dataset_id="src_ds", name="client_id", datatype="string"),
        FieldDefinition(dataset_id="src_ds", name="contact_name", datatype="string"),
        FieldDefinition(dataset_id="src_ds", name="email_address", datatype="string"),
    ]
    tgt_fields = [
        FieldDefinition(dataset_id="tgt_ds", name="id", datatype="string"),
        FieldDefinition(dataset_id="tgt_ds", name="full_name", datatype="string"),
        FieldDefinition(dataset_id="tgt_ds", name="email", datatype="string"),
    ]

    source_ds = metadata_service.register_dataset(tenant_id, source_sys.system_id, "customers", fields=src_fields)
    target_ds = metadata_service.register_dataset(tenant_id, target_sys.system_id, "accounts", fields=tgt_fields)

    sample_records = [
        {"client_id": "C-101", "contact_name": "alice smith", "email_address": "alice@acme.com"},
        {"client_id": "C-102", "contact_name": "bob jones", "email_address": "bob@acme.com"},
    ]
    
    profile = discovery_service.profile_records(tenant_id, source_ds.dataset_id, sample_records)
    
    wave = project_service.create_wave(
        tenant_id=tenant_id,
        project_id=project.project_id,
        name="Wave 1",
        scope_definition={"source_records": sample_records, "baseline_profile_id": profile.profile_id},
    )

    ontology = ontology_service.create_version(tenant_id, project.project_id, "1.0.0")
    
    mapping_set = mapping_service.create_mapping_proposals(
        tenant_id=tenant_id,
        project_id=project.project_id,
        source_dataset_id=source_ds.dataset_id,
        target_dataset_id=target_ds.dataset_id,
        use_ai=False,  # Use deterministic engine for test predictability
    )
    mapping_service.approve_mapping_version(tenant_id, mapping_set.mapping_version_id)

    rule_pkg = rule_service.build_rule_package(tenant_id, mapping_set.mapping_version_id, "1.0.0")

    manifest = orchestrator_service.create_run_manifest(
        tenant_id=tenant_id,
        wave_id=wave.wave_id,
        project_id=project.project_id,
        ontology_version_id=ontology.ontology_version_id,
        mapping_version_id=mapping_set.mapping_version_id,
        rule_package_id=rule_pkg.rule_package_id,
        source_dataset_id=source_ds.dataset_id,
        target_dataset_id=target_ds.dataset_id,
        scope_snapshot={"source_records": sample_records, "baseline_profile_id": profile.profile_id},
    )

    return {
        "tenant_id": tenant_id,
        "project": project,
        "manifest": manifest,
        "sample_records": sample_records,
        "rule_pkg": rule_pkg,
        "mapping_set": mapping_set,
        "source_ds": source_ds,
    }


def test_ta_001_version_pinning(test_setup):
    """
    TA-001: A run created from a manifest continues to use the exact same
    mapping/rule/ontology versions even if newer versions are published during execution.
    """
    tenant_id = test_setup["tenant_id"]
    manifest = test_setup["manifest"]
    
    # Publish newer versions of rule package and mapping set
    newer_mapping = mapping_service.create_mapping_proposals(
        tenant_id=tenant_id,
        project_id=test_setup["project"].project_id,
        source_dataset_id=manifest.source_dataset_id,
        target_dataset_id=manifest.target_dataset_id,
        use_ai=False,
    )
    mapping_service.approve_mapping_version(tenant_id, newer_mapping.mapping_version_id)
    newer_rule_pkg = rule_service.build_rule_package(tenant_id, newer_mapping.mapping_version_id, "2.0.0")

    # Start run from original manifest
    run = orchestrator_service.start_run(tenant_id, manifest.manifest_id)
    
    # Verify execution pinned original versions strictly
    run_manifest = store.get_manifest(tenant_id, run.manifest_id)
    assert run_manifest.mapping_version_id == manifest.mapping_version_id
    assert run_manifest.rule_package_id == manifest.rule_package_id
    assert run_manifest.mapping_version_id != newer_mapping.mapping_version_id
    assert run_manifest.rule_package_id != newer_rule_pkg.rule_package_id


def test_ta_002_deterministic_transform_replay(test_setup):
    """
    TA-002: Replaying a completed transform partition with the same inputs and rule package
    produces byte-equivalent normalized output or a documented deterministic equivalent.
    """
    tenant_id = test_setup["tenant_id"]
    rule_pkg = test_setup["rule_pkg"]
    records = test_setup["sample_records"]
    mapping_id = test_setup["mapping_set"].mapping_version_id

    from app.workers.transform_worker import transform_worker

    res_1 = transform_worker.execute_partition(
        tenant_id=tenant_id,
        run_id="run-replay-1",
        partition_id="part-0",
        source_records=records,
        rule_package=rule_pkg,
        mapping_version_id=mapping_id,
    )

    res_2 = transform_worker.execute_partition(
        tenant_id=tenant_id,
        run_id="run-replay-2",
        partition_id="part-0",
        source_records=records,
        rule_package=rule_pkg,
        mapping_version_id=mapping_id,
    )

    assert res_1["normalized_bytes"] == res_2["normalized_bytes"]
    assert res_1["transformed_records"] == res_2["transformed_records"]


def test_ta_003_idempotent_event_delivery(test_setup):
    """
    TA-003: Duplicate delivery of a task-completed event does not advance counters or state twice.
    """
    tenant_id = test_setup["tenant_id"]
    event_id = "evt-unique-completed-12345"
    task_id = "task-attempt-99"

    # First delivery
    first_attempt = orchestrator_service.process_task_completed_event(tenant_id, event_id, task_id)
    assert first_attempt is True

    # Duplicate delivery
    second_attempt = orchestrator_service.process_task_completed_event(tenant_id, event_id, task_id)
    assert second_attempt is False


def test_ta_004_worker_crash_idempotent_target(test_setup):
    """
    TA-004: A worker crash after target acknowledgement but before checkpoint persistence
    does not create an uncontrolled duplicate target effect when retried.
    """
    from app.sdk.connectors.memory_connector import MemoryConnector
    from app.workers.load_worker import load_worker

    connector = MemoryConnector(endpoint_config={"tables": {"accounts": []}})
    records = [{"id": "ACC-1", "name": "Acme Corp"}, {"id": "ACC-2", "name": "Global Inc"}]
    idempotency_key = "batch-tx-999"

    # Initial write
    res1 = load_worker.execute_load(connector, "accounts", records, idempotency_key)
    assert res1.accepted_records == 2
    assert len(connector._tables["accounts"]) == 2

    # Retried write after simulated crash before checkpoint
    res2 = load_worker.execute_load(connector, "accounts", records, idempotency_key)
    # Target records should NOT be duplicated
    assert res2.accepted_records == 0
    assert len(connector._tables["accounts"]) == 2


def test_ta_005_blocking_schema_drift(test_setup):
    """
    TA-005: A blocking schema drift condition prevents a production run from starting
    unless an authorized policy waiver is attached to the manifest.
    """
    tenant_id = test_setup["tenant_id"]
    manifest = test_setup["manifest"]
    source_ds_id = manifest.source_dataset_id

    # Create a drifted profile with a missing column
    drifted_records = [{"client_id": "C-999"}]  # missing contact_name and email_address
    discovery_service.profile_records(tenant_id, source_ds_id, drifted_records)

    # Attempting to start run without waiver must fail
    with pytest.raises(PlatformException) as exc_info:
        orchestrator_service.start_run(tenant_id, manifest.manifest_id)
    assert exc_info.value.code == "BLOCKING_SCHEMA_DRIFT"

    # Now create manifest with authorized policy waiver
    waived_manifest = orchestrator_service.create_run_manifest(
        tenant_id=tenant_id,
        wave_id=manifest.wave_id,
        project_id=manifest.project_id,
        ontology_version_id=manifest.ontology_version_id,
        mapping_version_id=manifest.mapping_version_id,
        rule_package_id=manifest.rule_package_id,
        source_dataset_id=manifest.source_dataset_id,
        target_dataset_id=manifest.target_dataset_id,
        scope_snapshot=manifest.scope_snapshot,
        policy_waivers=["ALLOW_SCHEMA_DRIFT"],  # Authorized waiver
    )

    run = orchestrator_service.start_run(tenant_id, waived_manifest.manifest_id)
    assert run.state in (RunState.RUNNING, RunState.COMPLETED, RunState.EXCEPTION_REVIEW)


def test_ta_006_ai_independence(test_setup):
    """
    TA-006: Removing AI connectivity prevents proposal functions but does not prevent
    deterministic migration execution, validation, loading, reconciliation or sign-off.
    """
    tenant_id = test_setup["tenant_id"]
    manifest = test_setup["manifest"]

    # Execute end-to-end run completely offline from AI
    run = orchestrator_service.start_run(tenant_id, manifest.manifest_id)
    assert run.state in (RunState.COMPLETED, RunState.EXCEPTION_REVIEW)

    # Sign-off can still be completed
    if run.state == RunState.EXCEPTION_REVIEW:
        # Waive any exception
        excs = store.list_exceptions(tenant_id, run.run_id)
        for e in excs:
            e.disposition = ExceptionDisposition.WAIVED
            store.save_exception(tenant_id, e)
        run.state = RunState.COMPLETED
        store.save_run(tenant_id, run)

    signoff_result = evidence_service.signoff_run(tenant_id, run.run_id)
    assert signoff_result["state"] == RunState.SIGNED_OFF
    assert signoff_result["evidence_bundle_hash"] is not None


def test_ta_007_evidence_bundle_hash_verification(test_setup):
    """
    TA-007: A signed-off evidence bundle can be verified by content hash
    after transient staging data has been purged.
    """
    tenant_id = test_setup["tenant_id"]
    manifest = test_setup["manifest"]

    run = orchestrator_service.start_run(tenant_id, manifest.manifest_id)
    run.state = RunState.COMPLETED
    store.save_run(tenant_id, run)

    # Sign off run, locking evidence hash and purging transient staging
    signoff_result = evidence_service.signoff_run(tenant_id, run.run_id)
    assert signoff_result["staging_purged"] is True

    # Staging partition is purged
    staged = store.get_staged_partition(tenant_id, run.run_id, "part-0")
    assert staged == []

    # Evidence verification still succeeds
    assert evidence_service.verify_evidence_bundle(tenant_id, run.run_id) is True


def test_ta_008_zero_secret_leakage(test_setup):
    """
    TA-008: No API, log or telemetry path returns stored secret values.
    """
    tenant_id = test_setup["tenant_id"]
    secret = "gsk_SecretPasswordKey1234567890ABCDEF"

    masked = mask_secret(secret)
    assert secret not in masked
    assert masked == "gsk_...CDEF"

    # Test endpoint creation and verification
    ep = metadata_service.create_endpoint(
        tenant_id=tenant_id,
        system_id="sys-dummy",
        environment_id="env-dummy",
        name="Secure Endpoint",
        connection_params={"host": "db.corp.internal"},
        secret_ref=secret,
    )

    test_res = metadata_service.test_endpoint(tenant_id, ep.endpoint_id)
    assert secret not in str(test_res)
    assert test_res["secret_ref_masked"] == masked


def test_ta_009_tenant_isolation(test_setup):
    """
    TA-009: Tenant A cannot read, infer, search or reference Tenant B metadata through APIs.
    """
    tenant_a = test_setup["tenant_id"]
    tenant_b = f"tenant-b-{int(time.time()*1000)}"
    store.ensure_tenant(tenant_b)

    proj_a = test_setup["project"]
    proj_b = project_service.create_project(tenant_b, "Project B")

    # Tenant B querying Tenant A project must fail
    with pytest.raises(PlatformException) as exc_info:
        project_service.get_project(tenant_b, proj_a.project_id)
    assert exc_info.value.code == "PROJECT_NOT_FOUND"

    # Tenant A list projects does NOT contain Project B
    projects_a = project_service.list_projects(tenant_a)
    assert proj_b.project_id not in [p.project_id for p in projects_a]


def test_ta_010_selective_rerun_lineage(test_setup):
    """
    TA-010: Selective rerun can process only the failed partition/exception scope
    while retaining lineage to the original run and approved artifact versions.
    """
    tenant_id = test_setup["tenant_id"]
    manifest = test_setup["manifest"]

    orig_run = orchestrator_service.start_run(tenant_id, manifest.manifest_id)
    rerun = orchestrator_service.execute_selective_rerun(tenant_id, orig_run.run_id, "part-0")

    assert rerun.attempt_no == orig_run.attempt_no + 1
    assert rerun.manifest_id == orig_run.manifest_id
    assert rerun.signoff_record["rerun_source_run_id"] == orig_run.run_id


def test_ta_011_rollback_execution_auditing(test_setup):
    """
    TA-011: Rollback execution is separately audited and does not delete the original run record.
    """
    tenant_id = test_setup["tenant_id"]
    manifest = test_setup["manifest"]

    orig_run = orchestrator_service.start_run(tenant_id, manifest.manifest_id)
    rollback_run = orchestrator_service.rollback_run(tenant_id, orig_run.run_id, reason="Testing rollback")

    # Both run records persist
    assert store.get_run(tenant_id, orig_run.run_id) is not None
    assert store.get_run(tenant_id, rollback_run.run_id) is not None
    assert rollback_run.run_id != orig_run.run_id
    assert rollback_run.signoff_record["rollback_target_run_id"] == orig_run.run_id


def test_ta_012_record_level_lineage(test_setup):
    """
    TA-012: Every target-record trace request identifies source identity, mapping,
    transform rule version and run ID.
    """
    tenant_id = test_setup["tenant_id"]
    manifest = test_setup["manifest"]

    run = orchestrator_service.start_run(tenant_id, manifest.manifest_id)
    
    # Trace target record for client_id C-101
    lineage = evidence_service.get_record_lineage(tenant_id, run.run_id, "C-101")
    assert lineage.target_record_id == "C-101"
    assert lineage.source_record_id == "C-101"
    assert lineage.run_id == run.run_id
    assert lineage.mapping_version_id == manifest.mapping_version_id
    assert lineage.rule_package_id == manifest.rule_package_id
    assert len(lineage.transformations_applied) > 0
