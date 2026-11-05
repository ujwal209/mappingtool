"""
POC Bootstrap & Simulation Seeding Endpoint.
Initializes a full end-to-end scenario (Project, Systems, Datasets, Profiles, Concepts)
based on realistic enterprise datasets so the platform is immediately operational.
"""

from fastapi import APIRouter, Depends, Query
from typing import Dict, Any
from app.services.project_service import project_service
from app.services.metadata_service import metadata_service
from app.services.discovery_service import discovery_service
from app.services.ontology_service import ontology_service
from app.services.mock_datasets import get_crm_mock_datasets, get_ecommerce_mock_datasets
from app.models.canonical import SystemKind, FieldDefinition
from app.api.middleware.auth_rbac import get_auth_context, AuthContext

router = APIRouter()


@router.post(
    "/bootstrap/mock-seed",
    response_model=Dict[str, Any],
    status_code=201,
    summary="One-Click End-to-End Simulation Bootstrap",
    response_description="IDs and summary of created Project, Source/Target Systems, Datasets, and Profiles",
)
def seed_mock_migration(
    scenario: str = Query(
        default="crm",
        description="Dataset scenario to seed: 'crm' (Customer CRM & ERP) or 'ecommerce' (Product Catalog & Inventory)",
    ),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    **One-click simulation bootstrapping for testing and demonstrations.**

    ### Automatically Provisions:
    1. **Migration Project**: 'Enterprise Customer Migration Wave 1'.
    2. **Source & Target Systems**: Registered with in-memory / relational adapters.
    3. **Datasets & Field Definitions**: 12+ realistic records with schema types and governance metadata.
    4. **Baseline Statistical Profiles**: Inferred types, null counts, and scope hashes.
    5. **Delivery Wave**: Scoped with data partition definitions.
    6. **Draft Ontology Version**: Concepts for Customer Account Identifiers and Email attributes.
    7. **MongoDB Sync**: Persists all records into database `mapping`.
    """
    raw = get_crm_mock_datasets() if scenario == "crm" else get_ecommerce_mock_datasets()
    
    # 1. Project
    project = project_service.create_project(
        tenant_id=auth.tenant_id,
        name="Enterprise Customer Migration Wave 1",
        description="Migration from Legacy CRM to Cloud ERP Schema",
        owners=["lead-architect@company.com"],
    )

    # 2. Source & Target Systems
    source_sys = metadata_service.register_system(
        tenant_id=auth.tenant_id,
        project_id=project.project_id,
        name="Legacy Source DB",
        kind=SystemKind.SOURCE,
        connector_type="memory",
    )
    target_sys = metadata_service.register_system(
        tenant_id=auth.tenant_id,
        project_id=project.project_id,
        name="Cloud ERP Target",
        kind=SystemKind.TARGET,
        connector_type="memory",
    )

    # 3. Datasets & Fields
    src_data = raw["source"]["data"]
    tgt_data = raw["target"]["data"]

    src_fields = [
        FieldDefinition(
            dataset_id="temp",
            name=col,
            datatype="string",
            ordinal=idx + 1,
            is_metadata=col.startswith("meta_"),
        )
        for idx, col in enumerate(src_data[0].keys())
    ]
    tgt_fields = [
        FieldDefinition(
            dataset_id="temp",
            name=col,
            datatype="string",
            ordinal=idx + 1,
            is_metadata=col.startswith("meta_"),
        )
        for idx, col in enumerate(tgt_data[0].keys())
    ]

    source_ds = metadata_service.register_dataset(
        tenant_id=auth.tenant_id,
        system_id=source_sys.system_id,
        physical_name="source_customers",
        fields=src_fields,
    )
    target_ds = metadata_service.register_dataset(
        tenant_id=auth.tenant_id,
        system_id=target_sys.system_id,
        physical_name="target_accounts",
        fields=tgt_fields,
    )

    # 4. Profile Snapshots
    src_profile = discovery_service.profile_records(
        tenant_id=auth.tenant_id,
        dataset_id=source_ds.dataset_id,
        records=src_data,
    )
    tgt_profile = discovery_service.profile_records(
        tenant_id=auth.tenant_id,
        dataset_id=target_ds.dataset_id,
        records=tgt_data,
    )

    # 5. Delivery Wave
    wave = project_service.create_wave(
        tenant_id=auth.tenant_id,
        project_id=project.project_id,
        name="Wave 1: Enterprise Accounts",
        scope_definition={"source_records": src_data, "baseline_profile_id": src_profile.profile_id},
    )

    # 6. Optional Initial Blank Ontology Version (User designs with builder / AI agent)
    ontology = ontology_service.create_version(
        tenant_id=auth.tenant_id,
        project_id=project.project_id,
        name="Enterprise Project Model",
        description="Dynamic business ontology for enterprise project",
        version_tag="1.0.0",
    )

    return {
        "status": "BOOTSTRAP_COMPLETE",
        "tenant_id": auth.tenant_id,
        "project_id": project.project_id,
        "wave_id": wave.wave_id,
        "source_system_id": source_sys.system_id,
        "target_system_id": target_sys.system_id,
        "source_dataset_id": source_ds.dataset_id,
        "target_dataset_id": target_ds.dataset_id,
        "source_profile_id": src_profile.profile_id,
        "target_profile_id": tgt_profile.profile_id,
        "ontology_version_id": ontology.ontology_version_id,
        "sample_source_record_count": len(src_data),
        "sample_target_columns": list(tgt_data[0].keys()),
    }
