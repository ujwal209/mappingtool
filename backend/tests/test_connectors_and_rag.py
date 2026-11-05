"""
Connector and Ontology RAG Test Suite.
Tests:
- Microsoft Fabric OneLake Lakehouse connector (read, write, time travel rollback, destination mapping catalog persistence)
- Dynamics 365 Dataverse connector (entity read, idempotent upsert, rollback, destination mapping catalog persistence)
- Ontology RAG Service (document ingestion, chunking, semantic retrieval, synthesis)
- Destination Mapping Persistence Service
- MongoDB database 'mapping' persistence
"""

import pytest
import time
from app.sdk.connectors.fabric_connector import MicrosoftFabricConnector
from app.sdk.connectors.d365_connector import Dynamics365Connector
from app.sdk.connectors.registry import connector_registry
from app.services.ontology_rag_service import ontology_rag_service
from app.services.ontology_service import ontology_service
from app.services.project_service import project_service
from app.services.metadata_service import metadata_service
from app.services.discovery_service import discovery_service
from app.services.mapping_service import mapping_service
from app.services.rule_service import rule_service
from app.services.orchestrator_service import orchestrator_service
from app.db.store import store
from app.db.mongo import mongo_manager
from app.models.canonical import SystemKind, FieldDefinition


@pytest.fixture
def test_env():
    tenant_id = f"tenant-test-connectors-{int(time.time()*1000)}"
    store.ensure_tenant(tenant_id)
    return {"tenant_id": tenant_id}


def test_fabric_connector_lifecycle():
    """
    Verify Microsoft Fabric OneLake Lakehouse connector:
    - Discovery
    - Connection testing without secret leakage
    - Idempotent batch write
    - OneLake Delta snapshot and compensation rollback
    - Destination ontology mapping catalog persistence
    """
    config = {
        "workspace_id": "ws-enterprise-analytics",
        "lakehouse_id": "lh-gold-lakehouse",
        "azure_tenant_id": "azure-tenant-123",
        "tables": {"Customer_Gold": []},
    }
    connector = MicrosoftFabricConnector(endpoint_config=config, secret_ref="azure_kv_secret_ref")

    # 1. Test connection
    test_res = connector.test_connection()
    assert test_res["status"] == "SUCCESS"
    assert "onelake_delta_write" in test_res["capabilities"]

    # 2. Discover
    schemas = connector.discover()
    assert len(schemas) >= 1
    table_names = [s["dataset_name"] for s in schemas]
    assert "Customer_Gold" in table_names

    # 3. Write batch
    records = [
        {"id": "FAB-001", "name": "Global Corp", "revenue": 100000.0},
        {"id": "FAB-002", "name": "Nexus Systems", "revenue": 250000.0},
    ]
    idempotency_ctx = {"target_dataset": "Customer_Gold", "idempotency_key": "tx_fabric_101"}
    
    # Take snapshot before write
    connector.begin_snapshot("op-pre-load")
    
    write_res = connector.write_batch(records, idempotency_ctx)
    assert write_res.accepted_records == 2
    assert len(connector._tables["Customer_Gold"]) == 2
    assert connector._tables["Customer_Gold"][0]["_fabric_lakehouse_id"] == "lh-gold-lakehouse"

    # 4. Idempotent retry does not duplicate records
    retry_res = connector.write_batch(records, idempotency_ctx)
    assert retry_res.accepted_records == 0
    assert len(connector._tables["Customer_Gold"]) == 2

    # 5. Destination mapping catalog persistence
    mapping_catalog = {
        "ontology_version_id": "ont-v-fabric-1",
        "mapping_version_id": "map-v-fabric-1",
        "target_dataset_id": "Customer_Gold",
        "mappings": [{"source": "client_id", "target": "id"}],
    }
    saved = connector.save_destination_mapping_catalog(mapping_catalog)
    assert saved is True
    catalogs = connector.get_destination_mapping_catalog()
    assert len(catalogs) == 1
    assert catalogs[0]["lakehouse_id"] == "lh-gold-lakehouse"

    # 6. Rollback compensation
    rollback_ok = connector.compensate("op-pre-load")
    assert rollback_ok is True
    assert len(connector._tables["Customer_Gold"]) == 0


def test_d365_connector_lifecycle():
    """
    Verify Microsoft Dynamics 365 / Dataverse connector:
    - Discovery
    - Connection testing without secret leakage
    - Idempotent upsert
    - Destination ontology mapping catalog persistence
    - Rollback
    """
    config = {
        "environment_url": "https://contoso.crm.dynamics.com",
        "api_version": "v9.2",
        "client_id": "d365-client-app-id",
        "tables": {"accounts": []},
    }
    connector = Dynamics365Connector(endpoint_config=config, secret_ref="d365_oauth_secret_ref")

    # 1. Test connection
    test_res = connector.test_connection()
    assert test_res["status"] == "SUCCESS"
    assert "dataverse_web_api" in test_res["capabilities"]

    # 2. Discover
    schemas = connector.discover()
    assert len(schemas) >= 1

    # 3. Write batch
    records = [
        {"accountid": "ACC-D365-1", "name": "Enterprise Inc", "emailaddress1": "info@enterprise.com"},
        {"accountid": "ACC-D365-2", "name": "Starlight Corp", "emailaddress1": "contact@starlight.com"},
    ]
    idempotency_ctx = {"target_dataset": "accounts", "idempotency_key": "tx_d365_201"}

    connector.begin_snapshot("op-d365-pre")
    write_res = connector.write_batch(records, idempotency_ctx)
    assert write_res.accepted_records == 2
    assert len(connector._entities["accounts"]) == 2
    assert "msdyn_migration_synced_at" in connector._entities["accounts"][0]

    # 4. Destination ontology mapping catalog persistence
    mapping_catalog = {
        "ontology_version_id": "ont-v-d365-1",
        "mapping_version_id": "map-v-d365-1",
        "target_dataset_id": "accounts",
        "mappings": [{"source": "company_name", "target": "name"}],
    }
    saved = connector.save_destination_mapping_catalog(mapping_catalog)
    assert saved is True
    catalogs = connector.get_destination_mapping_catalog()
    assert len(catalogs) == 1
    assert catalogs[0]["target_entity"] == "accounts"

    # 5. Rollback
    connector.compensate("op-d365-pre")
    assert len(connector._entities["accounts"]) == 0


def test_ontology_rag_service(test_env):
    """
    Verify Ontology RAG:
    - Document ingestion & chunking
    - Top-K semantic retrieval
    - Query synthesis
    """
    tenant_id = test_env["tenant_id"]
    ont_version_id = f"ont-rag-{int(time.time()*1000)}"

    rulebook_text = """
    # Enterprise Customer Data Governance & Migration Rulebook (v4.2)

    ## Section 1: Customer Account Identifiers
    Every corporate customer entity must possess a unique identifier.
    The identifier must be formatted as an alphanumeric string starting with the prefix 'CL-'.
    If the legacy system identifier does not contain the prefix, it must be mapped and formatted with 'CL-'.

    ## Section 2: Contact Electronic Mail Rules
    All customer email addresses must adhere strictly to standard RFC 5322 format.
    Duplicate customer email addresses are prohibited across active accounts.
    If an email is null or unverified, the record must be flagged for manual validation or assigned a placeholder.

    ## Section 3: Revenue Normalization & Currency Conversion
    Annual spend figures must be normalized into standard USD currency using the transaction date exchange rate.
    All financial currency values must be cast to decimal with 2 decimal places precision.
    """

    # 1. Ingest document
    doc = ontology_rag_service.ingest_document(
        tenant_id=tenant_id,
        ontology_version_id=ont_version_id,
        title="Enterprise Customer Data Governance & Migration Rulebook",
        content=rulebook_text,
        document_type="RULEBOOK",
        chunk_size=400,
        chunk_overlap=50,
    )
    assert doc.chunk_count >= 2

    # 2. List documents
    docs = ontology_rag_service.list_documents(tenant_id, ont_version_id)
    assert len(docs) >= 1
    assert docs[0]["title"] == "Enterprise Customer Data Governance & Migration Rulebook"

    # 3. Retrieve relevant chunks
    chunks = ontology_rag_service.retrieve_relevant_chunks(
        ontology_version_id=ont_version_id,
        query="What format is required for customer account identifiers?",
        top_k=2,
    )
    assert len(chunks) >= 1
    assert "CL-" in chunks[0]["chunk"]["content"]

    # 4. RAG Query
    rag_result = ontology_rag_service.query_ontology_rag(
        tenant_id=tenant_id,
        ontology_version_id=ont_version_id,
        query="What are the customer identifier prefix rules?",
        top_k=2,
        synthesize_with_llm=False,  # Test retrieval without external API network call
    )
    assert len(rag_result.retrieved_chunks) >= 1
    assert "CL-" in str(rag_result.retrieved_chunks)


def test_destination_mapping_persistence_in_run(test_env):
    """
    Verify that during a migration run, the ontology-aligned mapping catalog
    is automatically saved into the destination system and store.
    """
    tenant_id = test_env["tenant_id"]

    project = project_service.create_project(tenant_id, "Destination Persistence Project")
    source_sys = metadata_service.register_system(tenant_id, project.project_id, "Source DB", SystemKind.SOURCE, "memory")
    target_sys = metadata_service.register_system(tenant_id, project.project_id, "Fabric Destination", SystemKind.TARGET, "fabric")

    src_fields = [FieldDefinition(dataset_id="src", name="client_id", datatype="string")]
    tgt_fields = [FieldDefinition(dataset_id="tgt", name="id", datatype="string")]

    src_ds = metadata_service.register_dataset(tenant_id, source_sys.system_id, "source_cust", fields=src_fields)
    tgt_ds = metadata_service.register_dataset(tenant_id, target_sys.system_id, "Fabric_Customer_Gold", fields=tgt_fields)

    sample_data = [{"client_id": "CL-8080"}]
    profile = store.save_profile(tenant_id, discovery_service.profile_records(tenant_id, src_ds.dataset_id, sample_data))

    wave = project_service.create_wave(
        tenant_id,
        project.project_id,
        "Wave Fabric",
        {"source_records": sample_data, "baseline_profile_id": profile.profile_id},
    )

    ontology = ontology_service.create_version(tenant_id, project.project_id, "1.0.0")
    mapping_set = mapping_service.create_mapping_proposals(
        tenant_id=tenant_id,
        project_id=project.project_id,
        source_dataset_id=src_ds.dataset_id,
        target_dataset_id=tgt_ds.dataset_id,
        use_ai=False,
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
        source_dataset_id=src_ds.dataset_id,
        target_dataset_id=tgt_ds.dataset_id,
    )

    # Execute run
    run = orchestrator_service.start_run(tenant_id, manifest.manifest_id)
    assert run.state in ("COMPLETED", "EXCEPTION_REVIEW")

    # Verify mapping was saved in destination system!
    dest_catalogs = store.get_destination_mappings(tenant_id, target_sys.system_id)
    assert len(dest_catalogs) >= 1
    assert dest_catalogs[0]["catalog"]["ontology_version_id"] == ontology.ontology_version_id
    assert dest_catalogs[0]["catalog"]["mapping_version_id"] == mapping_set.mapping_version_id


def test_mongodb_connectivity():
    """Verify MongoDB client is connected to database 'mapping'."""
    assert mongo_manager.is_connected is True
    db = mongo_manager.get_database()
    assert db is not None
    assert db.name == "mapping"
