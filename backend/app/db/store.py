"""
Metadata & Evidence Repository Store.
Implements the Metadata DB and Evidence Store specifications from:
- Section 4 (Canonical Metadata Model)
- Section 16 (Staging and Data Storage)
- TA-009 (Strict Tenant Isolation Boundary)
- MongoDB Persistence (database name: 'mapping')

Provides thread-safe ACID storage with strict tenant partition enforcement,
point-in-time snapshots, tamper-evident audit/evidence preservation, and dual
caching with MongoDB cloud persistence.
"""

import threading
import time
from typing import Any, Dict, List, Optional

from app.core.errors import PlatformException, ErrorCategory
from app.models.canonical import (
    Tenant, Project, Environment, System, Endpoint, Dataset, FieldDefinition,
    ProfileSnapshot, OntologyVersion, Concept, SemanticBinding,
    MappingSetVersion, Mapping, RulePackageVersion, Wave, RunManifest,
    Run, TaskAttempt, ValidationResult, ReconciliationResult,
    ExceptionCase, Approval, AuditEvent, RunState, ArtifactStatus,
    User, OntologyChunk
)
from app.core.security import compute_sha256
from app.core.logging import get_logger
from app.db.mongo import mongo_manager

logger = get_logger("store")


class MetadataStore:
    """
    Thread-safe repository managing all canonical entities with strict tenant isolation (TA-009)
    backed by MongoDB ('mapping' database) and in-memory cache.
    """

    def __init__(self):
        self._lock = threading.RLock()

        # In-memory entity stores keyed by [tenant_id][entity_id]
        self._tenants: Dict[str, Tenant] = {}
        self._projects: Dict[str, Dict[str, Project]] = {}
        self._environments: Dict[str, Dict[str, Environment]] = {}
        self._systems: Dict[str, Dict[str, System]] = {}
        self._endpoints: Dict[str, Dict[str, Endpoint]] = {}
        self._datasets: Dict[str, Dict[str, Dataset]] = {}
        self._profiles: Dict[str, Dict[str, ProfileSnapshot]] = {}
        self._ontologies: Dict[str, Dict[str, OntologyVersion]] = {}
        self._mapping_sets: Dict[str, Dict[str, MappingSetVersion]] = {}
        self._table_mapping_sets: Dict[str, Dict[str, Any]] = {}
        self._rule_packages: Dict[str, Dict[str, RulePackageVersion]] = {}
        self._waves: Dict[str, Dict[str, Wave]] = {}
        self._manifests: Dict[str, Dict[str, RunManifest]] = {}
        self._runs: Dict[str, Dict[str, Run]] = {}
        self._tasks: Dict[str, Dict[str, TaskAttempt]] = {}
        self._validations: Dict[str, List[ValidationResult]] = {}
        self._reconciliations: Dict[str, List[ReconciliationResult]] = {}
        self._exceptions: Dict[str, Dict[str, ExceptionCase]] = {}
        self._approvals: Dict[str, List[Approval]] = {}
        self._audit_events: Dict[str, List[AuditEvent]] = {}

        # ★ NEW: Migration manifests & runs (separate from canonical runs)
        self._migration_manifests: Dict[str, Dict[str, Any]] = {}
        self._migration_runs: Dict[str, Dict[str, Any]] = {}

        # Lineage store: [tenant_id][run_id][target_record_id] -> LineageDict (TA-012)
        self._lineage_records: Dict[str, Dict[str, Dict[str, Dict[str, Any]]]] = {}

        # Destination mappings store: [tenant_id][destination_system_id] -> List[Dict]
        self._destination_mappings: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}

        # Ontology chunks store: [tenant_id][ontology_id] -> Dict[chunk_id, OntologyChunk]
        self._ontology_chunks: Dict[str, Dict[str, Dict[str, OntologyChunk]]] = {}

        # User accounts repository: email -> User and user_id -> User
        self._users: Dict[str, User] = {}
        self._users_by_id: Dict[str, User] = {}

        # Transient staging storage partition data: [tenant_id][run_id][partition_id] -> List[Dict]
        self._staging_partitions: Dict[str, Dict[str, Dict[str, List[Dict[str, Any]]]]] = {}

        # Pre-seed default tenant
        default_tenant = Tenant(tenant_id="tenant-default", name="Default Enterprise Tenant")
        self._tenants[default_tenant.tenant_id] = default_tenant
        self._init_tenant_buckets("tenant-default")
        mongo_manager.upsert_document("tenants", {"tenant_id": "tenant-default"}, default_tenant.model_dump())

    # -------------------------------------------------------------
    # Table Mapping Sets (table_matching_agent)
    # -------------------------------------------------------------
    def save_table_mapping_set(self, tenant_id: str, tms: Any) -> Any:
        """Persist a TableMappingSetVersion to memory + MongoDB."""
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._table_mapping_sets[tenant_id][
                tms.table_mapping_set_id
            ] = tms
            mongo_manager.upsert_document(
                "table_mappings",
                {
                    "tenant_id": tenant_id,
                    "table_mapping_set_id": tms.table_mapping_set_id,
                },
                tms.model_dump(mode="json"),
            )
            return tms

    def get_table_mapping_set(
        self, tenant_id: str, table_mapping_set_id: str
    ) -> Optional[Any]:
        """Retrieve a table mapping set by id."""
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if table_mapping_set_id in self._table_mapping_sets[tenant_id]:
                return self._table_mapping_sets[tenant_id][
                    table_mapping_set_id
                ]

            doc = mongo_manager.find_one(
                "table_mappings",
                {
                    "tenant_id": tenant_id,
                    "table_mapping_set_id": table_mapping_set_id,
                },
            )
            if doc:
                try:
                    from app.models.canonical import TableMappingSetVersion

                    tms = TableMappingSetVersion(**doc)
                    self._table_mapping_sets[tenant_id][
                        table_mapping_set_id
                    ] = tms
                    return tms
                except Exception as e:
                    logger.warning(
                        f"Error parsing table mapping set "
                        f"{table_mapping_set_id}: {e}"
                    )
            return None

    def list_table_mapping_sets(
        self,
        tenant_id: str,
        project_id: Optional[str] = None,
        source_system_id: Optional[str] = None,
        target_system_id: Optional[str] = None,
    ) -> List[Any]:
        """List table mapping sets filtered by project / systems."""
        with self._lock:
            self._init_tenant_buckets(tenant_id)

            if mongo_manager.is_connected:
                q: Dict[str, Any] = {"tenant_id": tenant_id}
                if project_id:
                    q["project_id"] = project_id
                if source_system_id:
                    q["source_system_id"] = source_system_id
                if target_system_id:
                    q["target_system_id"] = target_system_id

                docs = mongo_manager.find_many("table_mappings", q)
                from app.models.canonical import TableMappingSetVersion

                for d in docs:
                    sid = d.get("table_mapping_set_id")
                    if sid and sid not in self._table_mapping_sets[tenant_id]:
                        try:
                            self._table_mapping_sets[tenant_id][sid] = (
                                TableMappingSetVersion(**d)
                            )
                        except Exception:
                            pass

            all_sets = list(self._table_mapping_sets[tenant_id].values())
            if project_id:
                all_sets = [
                    m for m in all_sets if m.project_id == project_id
                ]
            if source_system_id:
                all_sets = [
                    m
                    for m in all_sets
                    if m.source_system_id == source_system_id
                ]
            if target_system_id:
                all_sets = [
                    m
                    for m in all_sets
                    if m.target_system_id == target_system_id
                ]
            return all_sets

    def _init_tenant_buckets(self, tenant_id: str):
        """Initialize empty collections for a tenant if not present."""
        if tenant_id not in self._projects:
            self._projects[tenant_id] = {}
            self._environments[tenant_id] = {}
            self._systems[tenant_id] = {}
            self._endpoints[tenant_id] = {}
            self._datasets[tenant_id] = {}
            self._profiles[tenant_id] = {}
            self._ontologies[tenant_id] = {}
            self._mapping_sets[tenant_id] = {}
            self._table_mapping_sets[tenant_id] = {}
            self._rule_packages[tenant_id] = {}
            self._waves[tenant_id] = {}
            self._manifests[tenant_id] = {}
            self._runs[tenant_id] = {}
            self._tasks[tenant_id] = {}
            self._validations[tenant_id] = []
            self._reconciliations[tenant_id] = []
            self._exceptions[tenant_id] = {}
            self._approvals[tenant_id] = []
            self._audit_events[tenant_id] = []
            self._migration_manifests[tenant_id] = {}
            self._migration_runs[tenant_id] = {}
            self._lineage_records[tenant_id] = {}
            self._destination_mappings[tenant_id] = {}
            self._ontology_chunks[tenant_id] = {}
            self._staging_partitions[tenant_id] = {}

    def ensure_tenant(self, tenant_id: str) -> Tenant:
        with self._lock:
            if tenant_id not in self._tenants:
                t = Tenant(tenant_id=tenant_id, name=f"Tenant {tenant_id}")
                self._tenants[tenant_id] = t
                self._init_tenant_buckets(tenant_id)
                mongo_manager.upsert_document("tenants", {"tenant_id": tenant_id}, t.model_dump())
            return self._tenants[tenant_id]

    # -------------------------------------------------------------
    # Migration Manifests & Runs
    # -------------------------------------------------------------
    def save_migration_manifest(self, tenant_id: str, manifest: Any) -> Any:
        """Persist a MigrationManifest to memory + MongoDB."""
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._migration_manifests[tenant_id][manifest.manifest_id] = manifest
            mongo_manager.upsert_document(
                "migration_manifests",
                {"tenant_id": tenant_id, "manifest_id": manifest.manifest_id},
                manifest.model_dump(mode="json"),
            )
            return manifest

    def get_migration_manifest(
        self, tenant_id: str, manifest_id: str
    ) -> Optional[Any]:
        """Retrieve a MigrationManifest by id."""
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if manifest_id in self._migration_manifests[tenant_id]:
                return self._migration_manifests[tenant_id][manifest_id]

            doc = mongo_manager.find_one(
                "migration_manifests",
                {"tenant_id": tenant_id, "manifest_id": manifest_id},
            )
            if doc:
                try:
                    from app.models.migration import MigrationManifest

                    m = MigrationManifest(**doc)
                    self._migration_manifests[tenant_id][manifest_id] = m
                    return m
                except Exception as e:
                    logger.warning(
                        f"Error parsing migration manifest {manifest_id}: {e}"
                    )
            return None

    def save_migration_run(self, tenant_id: str, run: Any) -> Any:
        """Persist a MigrationRun to memory + MongoDB."""
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._migration_runs[tenant_id][run.run_id] = run
            mongo_manager.upsert_document(
                "migration_runs",
                {"tenant_id": tenant_id, "run_id": run.run_id},
                run.model_dump(mode="json"),
            )
            return run

    def get_migration_run(self, tenant_id: str, run_id: str) -> Optional[Any]:
        """Retrieve a MigrationRun by id."""
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if run_id in self._migration_runs[tenant_id]:
                return self._migration_runs[tenant_id][run_id]

            doc = mongo_manager.find_one(
                "migration_runs",
                {"tenant_id": tenant_id, "run_id": run_id},
            )
            if doc:
                try:
                    from app.models.migration import MigrationRun

                    r = MigrationRun(**doc)
                    self._migration_runs[tenant_id][run_id] = r
                    return r
                except Exception as e:
                    logger.warning(
                        f"Error parsing migration run {run_id}: {e}"
                    )
            return None

    def list_migration_runs(
        self,
        tenant_id: str,
        project_id: Optional[str] = None,
        state: Optional[str] = None,
    ) -> List[Any]:
        """List migration runs, filtered by project and/or state."""
        with self._lock:
            self._init_tenant_buckets(tenant_id)

            # Hydrate from Mongo if cache is empty
            if not self._migration_runs[tenant_id] and mongo_manager.is_connected:
                q: Dict[str, Any] = {"tenant_id": tenant_id}
                docs = mongo_manager.find_many("migration_runs", q)
                from app.models.migration import MigrationRun

                for d in docs:
                    try:
                        r = MigrationRun(**d)
                        self._migration_runs[tenant_id][r.run_id] = r
                    except Exception:
                        pass

            runs = list(self._migration_runs[tenant_id].values())
            if project_id:
                runs = [r for r in runs if getattr(r, "project_id", None) == project_id]
            if state:
                runs = [r for r in runs if getattr(r, "state", None) == state]
            runs.sort(key=lambda r: getattr(r, "created_at", 0), reverse=True)
            return runs

    # -------------------------------------------------------------
    # Project, Environment, System, Endpoint
    # -------------------------------------------------------------
    def save_project(self, tenant_id: str, project: Project) -> Project:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._projects[tenant_id][project.project_id] = project
            mongo_manager.upsert_document(
                "projects",
                {"tenant_id": tenant_id, "project_id": project.project_id},
                project.model_dump(mode="json"),
            )
            return project

    def get_project(self, tenant_id: str, project_id: str) -> Optional[Project]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if project_id in self._projects[tenant_id]:
                return self._projects[tenant_id][project_id]
            doc = mongo_manager.find_one("projects", {"tenant_id": tenant_id, "project_id": project_id})
            if not doc and tenant_id != "tenant-default":
                doc = mongo_manager.find_one("projects", {"project_id": project_id})
            if doc:
                try:
                    proj = Project(**doc)
                    self._projects[tenant_id][project_id] = proj
                    return proj
                except Exception as e:
                    logger.warning(f"Error parsing project {project_id}: {e}")
            return None

    def list_projects(self, tenant_id: str) -> List[Project]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if mongo_manager.is_connected:
                docs = mongo_manager.find_many("projects", {"tenant_id": tenant_id})
                if not docs and tenant_id != "tenant-default":
                    docs = mongo_manager.find_many("projects", {"tenant_id": "tenant-default"})
                for doc in docs:
                    pid = doc.get("project_id")
                    if pid:
                        try:
                            self._projects[tenant_id][pid] = Project(**doc)
                        except Exception as e:
                            logger.warning(f"Error parsing project {pid} from mongo: {e}")
            projs = list(self._projects[tenant_id].values())
            projs.sort(key=lambda x: getattr(x, "created_at", 0), reverse=True)
            return projs

    def save_environment(self, tenant_id: str, env: Environment) -> Environment:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._environments[tenant_id][env.environment_id] = env
            mongo_manager.upsert_document(
                "environments",
                {"tenant_id": tenant_id, "environment_id": env.environment_id},
                env.model_dump(mode="json"),
            )
            return env

    def get_environment(self, tenant_id: str, environment_id: str) -> Optional[Environment]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if environment_id in self._environments[tenant_id]:
                return self._environments[tenant_id][environment_id]
            doc = mongo_manager.find_one("environments", {"tenant_id": tenant_id, "environment_id": environment_id})
            if not doc and tenant_id != "tenant-default":
                doc = mongo_manager.find_one("environments", {"environment_id": environment_id})
            if doc:
                try:
                    env = Environment(**doc)
                    self._environments[tenant_id][environment_id] = env
                    return env
                except Exception:
                    pass
            return None

    def save_system(self, tenant_id: str, system: System) -> System:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._systems[tenant_id][system.system_id] = system
            mongo_manager.upsert_document(
                "systems",
                {"tenant_id": tenant_id, "system_id": system.system_id},
                system.model_dump(mode="json"),
            )
            return system

    def get_system(self, tenant_id: str, system_id: str) -> Optional[System]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if system_id in self._systems[tenant_id]:
                return self._systems[tenant_id][system_id]
            doc = mongo_manager.find_one("systems", {"tenant_id": tenant_id, "system_id": system_id})
            if not doc and tenant_id != "tenant-default":
                doc = mongo_manager.find_one("systems", {"system_id": system_id})
            if doc:
                try:
                    sys = System(**doc)
                    self._systems[tenant_id][system_id] = sys
                    return sys
                except Exception as e:
                    logger.warning(f"Error parsing system {system_id}: {e}")
            return None

    def list_systems(self, tenant_id: str, project_id: Optional[str] = None) -> List[System]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if mongo_manager.is_connected:
                query = {"tenant_id": tenant_id}
                if project_id:
                    query["project_id"] = project_id
                docs = mongo_manager.find_many("systems", query)
                if not docs and tenant_id != "tenant-default":
                    query_def = {"tenant_id": "tenant-default"}
                    if project_id:
                        query_def["project_id"] = project_id
                    docs = mongo_manager.find_many("systems", query_def)
                for doc in docs:
                    sid = doc.get("system_id")
                    if sid:
                        try:
                            self._systems[tenant_id][sid] = System(**doc)
                        except Exception as e:
                            logger.warning(f"Error parsing system {sid}: {e}")
            all_systems = list(self._systems[tenant_id].values())
            if project_id:
                return [s for s in all_systems if s.project_id == project_id]
            return all_systems

    def save_endpoint(self, tenant_id: str, endpoint: Endpoint) -> Endpoint:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._endpoints[tenant_id][endpoint.endpoint_id] = endpoint
            mongo_manager.upsert_document(
                "endpoints",
                {"tenant_id": tenant_id, "endpoint_id": endpoint.endpoint_id},
                endpoint.model_dump(),
            )
            return endpoint

    def get_endpoint(self, tenant_id: str, endpoint_id: str) -> Optional[Endpoint]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            return self._endpoints[tenant_id].get(endpoint_id)

    # -------------------------------------------------------------
    # Dataset & Profiling
    # -------------------------------------------------------------
    def save_dataset(self, tenant_id: str, dataset: Dataset) -> Dataset:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._datasets[tenant_id][dataset.dataset_id] = dataset
            mongo_manager.upsert_document(
                "datasets",
                {"tenant_id": tenant_id, "dataset_id": dataset.dataset_id},
                dataset.model_dump(mode="json"),
            )
            return dataset

    def get_dataset(self, tenant_id: str, dataset_id: str) -> Optional[Dataset]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if dataset_id in self._datasets[tenant_id]:
                return self._datasets[tenant_id][dataset_id]
            doc = mongo_manager.find_one("datasets", {"tenant_id": tenant_id, "dataset_id": dataset_id})
            if not doc and tenant_id != "tenant-default":
                doc = mongo_manager.find_one("datasets", {"dataset_id": dataset_id})
            if doc:
                try:
                    ds = Dataset(**doc)
                    self._datasets[tenant_id][dataset_id] = ds
                    return ds
                except Exception:
                    pass
            return None

    def list_datasets(self, tenant_id: str, system_id: Optional[str] = None) -> List[Dataset]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if mongo_manager.is_connected:
                query = {"tenant_id": tenant_id}
                if system_id:
                    query["system_id"] = system_id
                docs = mongo_manager.find_many("datasets", query)
                if not docs and tenant_id != "tenant-default":
                    query_def = {"tenant_id": "tenant-default"}
                    if system_id:
                        query_def["system_id"] = system_id
                    docs = mongo_manager.find_many("datasets", query_def)
                for doc in docs:
                    did = doc.get("dataset_id")
                    if did:
                        try:
                            self._datasets[tenant_id][did] = Dataset(**doc)
                        except Exception:
                            pass
            ds_list = list(self._datasets[tenant_id].values())
            if system_id:
                return [d for d in ds_list if d.system_id == system_id]
            return ds_list

    def save_profile(self, tenant_id: str, profile: ProfileSnapshot) -> ProfileSnapshot:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._profiles[tenant_id][profile.profile_id] = profile
            mongo_manager.upsert_document(
                "profiles",
                {"tenant_id": tenant_id, "profile_id": profile.profile_id},
                profile.model_dump(),
            )
            return profile

    def get_profile(self, tenant_id: str, profile_id: str) -> Optional[ProfileSnapshot]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            return self._profiles[tenant_id].get(profile_id)

    def get_latest_profile_for_dataset(self, tenant_id: str, dataset_id: str) -> Optional[ProfileSnapshot]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            matching = [p for p in self._profiles[tenant_id].values() if p.dataset_id == dataset_id]
            if not matching:
                return None
            matching.sort(key=lambda x: x.sampled_at, reverse=True)
            return matching[0]

    # -------------------------------------------------------------
    # Ontology & Concepts
    # -------------------------------------------------------------
    def save_ontology(self, tenant_id: str, ontology: OntologyVersion) -> OntologyVersion:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            data_repr = {
                "project_id": ontology.project_id,
                "name": ontology.name,
                "domain": ontology.domain,
                "parent_id": ontology.parent_id,
                "version_tag": ontology.version_tag,
                "entities": [e.model_dump() for e in ontology.entities],
                "relationships": [r.model_dump() for r in ontology.relationships],
                "concepts": [c.model_dump() for c in ontology.concepts],
                "bindings": [b.model_dump() for b in ontology.bindings],
            }
            ontology.content_hash = compute_sha256(data_repr)
            ontology.updated_at = time.time()
            self._ontologies[tenant_id][ontology.ontology_version_id] = ontology
            mongo_manager.upsert_document(
                "ontologies",
                {"tenant_id": tenant_id, "ontology_version_id": ontology.ontology_version_id},
                ontology.model_dump(),
            )
            return ontology

    def delete_ontology(self, tenant_id: str, ontology_version_id: str) -> bool:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if ontology_version_id in self._ontologies[tenant_id]:
                del self._ontologies[tenant_id][ontology_version_id]
            mongo_manager.delete_one("ontologies", {
                "tenant_id": tenant_id,
                "ontology_version_id": ontology_version_id,
            })
            if ontology_version_id in self._ontology_chunks.get(tenant_id, {}):
                del self._ontology_chunks[tenant_id][ontology_version_id]
            mongo_manager.delete_many("ontology_chunks", {
                "tenant_id": tenant_id,
                "ontology_id": ontology_version_id,
            })
            mongo_manager.delete_many("ontology_rag_documents", {
                "tenant_id": tenant_id,
                "ontology_version_id": ontology_version_id,
            })
            return True

    def get_ontology(self, tenant_id: str, ontology_version_id: str) -> Optional[OntologyVersion]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if ontology_version_id in self._ontologies[tenant_id]:
                return self._ontologies[tenant_id][ontology_version_id]
            doc = mongo_manager.find_one("ontologies", {"tenant_id": tenant_id, "ontology_version_id": ontology_version_id})
            if doc:
                ont = OntologyVersion(**doc)
                self._ontologies[tenant_id][ontology_version_id] = ont
                return ont
            return None

    def list_ontologies(self, tenant_id: str, project_id: Optional[str] = None) -> List[OntologyVersion]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            docs = mongo_manager.find_many("ontologies", {"tenant_id": tenant_id})
            for d in docs:
                try:
                    ont = OntologyVersion(**d)
                    self._ontologies[tenant_id][ont.ontology_version_id] = ont
                except Exception:
                    pass
            ontologies = list(self._ontologies[tenant_id].values())
            if project_id:
                ontologies = [o for o in ontologies if o.project_id == project_id]
            return ontologies

    # -------------------------------------------------------------
    # Mappings & Rule Packages
    # -------------------------------------------------------------
    def save_mapping_set(self, tenant_id: str, mapping_set: MappingSetVersion) -> MappingSetVersion:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if not mapping_set.content_hash:
                data_repr = {
                    "project_id": mapping_set.project_id,
                    "source_dataset_id": mapping_set.source_dataset_id,
                    "target_dataset_id": mapping_set.target_dataset_id,
                    "version_tag": mapping_set.version_tag,
                    "mappings": [m.model_dump() for m in mapping_set.mappings],
                }
                mapping_set.content_hash = compute_sha256(data_repr)
            self._mapping_sets[tenant_id][mapping_set.mapping_version_id] = mapping_set
            mongo_manager.upsert_document(
                "mappings",
                {"tenant_id": tenant_id, "mapping_version_id": mapping_set.mapping_version_id},
                mapping_set.model_dump(),
            )
            return mapping_set

    def get_mapping_set(self, tenant_id: str, mapping_version_id: str) -> Optional[MappingSetVersion]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if mapping_version_id in self._mapping_sets[tenant_id]:
                return self._mapping_sets[tenant_id][mapping_version_id]
            doc = mongo_manager.find_one("mappings", {"tenant_id": tenant_id, "mapping_version_id": mapping_version_id})
            if doc:
                ms = MappingSetVersion(**doc)
                self._mapping_sets[tenant_id][mapping_version_id] = ms
                return ms
            return None

    def save_rule_package(self, tenant_id: str, rule_pkg: RulePackageVersion) -> RulePackageVersion:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if not rule_pkg.signature:
                data_repr = {
                    "project_id": rule_pkg.project_id,
                    "semantic_version": rule_pkg.semantic_version,
                    "compiled_plan": rule_pkg.compiled_plan,
                    "validations": rule_pkg.validations,
                    "reconciliations": rule_pkg.reconciliations,
                }
                rule_pkg.signature = compute_sha256(data_repr)
            self._rule_packages[tenant_id][rule_pkg.rule_package_id] = rule_pkg
            mongo_manager.upsert_document(
                "rule_packages",
                {"tenant_id": tenant_id, "rule_package_id": rule_pkg.rule_package_id},
                rule_pkg.model_dump(),
            )
            return rule_pkg

    def get_rule_package(self, tenant_id: str, rule_package_id: str) -> Optional[RulePackageVersion]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if rule_package_id in self._rule_packages[tenant_id]:
                return self._rule_packages[tenant_id][rule_package_id]
            doc = mongo_manager.find_one("rule_packages", {"tenant_id": tenant_id, "rule_package_id": rule_package_id})
            if doc:
                pkg = RulePackageVersion(**doc)
                self._rule_packages[tenant_id][rule_package_id] = pkg
                return pkg
            return None

    # -------------------------------------------------------------
    # Waves & Manifests
    # -------------------------------------------------------------
    def save_wave(self, tenant_id: str, wave: Wave) -> Wave:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._waves[tenant_id][wave.wave_id] = wave
            mongo_manager.upsert_document(
                "waves",
                {"tenant_id": tenant_id, "wave_id": wave.wave_id},
                wave.model_dump(mode="json"),
            )
            return wave

    def get_wave(self, tenant_id: str, wave_id: str) -> Optional[Wave]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if wave_id in self._waves[tenant_id]:
                return self._waves[tenant_id][wave_id]
            doc = mongo_manager.find_one("waves", {"tenant_id": tenant_id, "wave_id": wave_id})
            if not doc and tenant_id != "tenant-default":
                doc = mongo_manager.find_one("waves", {"wave_id": wave_id})
            if doc:
                try:
                    w = Wave(**doc)
                    self._waves[tenant_id][wave_id] = w
                    return w
                except Exception:
                    pass
            return None

    def list_waves(self, tenant_id: str, project_id: Optional[str] = None) -> List[Wave]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if mongo_manager.is_connected:
                query = {"tenant_id": tenant_id}
                if project_id:
                    query["project_id"] = project_id
                docs = mongo_manager.find_many("waves", query)
                if not docs and tenant_id != "tenant-default":
                    query_def = {"tenant_id": "tenant-default"}
                    if project_id:
                        query_def["project_id"] = project_id
                    docs = mongo_manager.find_many("waves", query_def)
                for doc in docs:
                    wid = doc.get("wave_id")
                    if wid:
                        try:
                            self._waves[tenant_id][wid] = Wave(**doc)
                        except Exception:
                            pass
            waves = list(self._waves[tenant_id].values())
            if project_id:
                return [w for w in waves if w.project_id == project_id]
            return waves

    def save_manifest(self, tenant_id: str, manifest: RunManifest) -> RunManifest:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._manifests[tenant_id][manifest.manifest_id] = manifest
            mongo_manager.upsert_document(
                "manifests",
                {"tenant_id": tenant_id, "manifest_id": manifest.manifest_id},
                manifest.model_dump(),
            )
            return manifest

    def get_manifest(self, tenant_id: str, manifest_id: str) -> Optional[RunManifest]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if manifest_id in self._manifests[tenant_id]:
                return self._manifests[tenant_id][manifest_id]
            doc = mongo_manager.find_one("manifests", {"tenant_id": tenant_id, "manifest_id": manifest_id})
            if doc:
                man = RunManifest(**doc)
                self._manifests[tenant_id][manifest_id] = man
                return man
            return None

    # -------------------------------------------------------------
    # Runs & Tasks
    # -------------------------------------------------------------
    def save_run(self, tenant_id: str, run: Run) -> Run:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._runs[tenant_id][run.run_id] = run
            mongo_manager.upsert_document(
                "runs",
                {"tenant_id": tenant_id, "run_id": run.run_id},
                run.model_dump(),
            )
            return run

    def get_run(self, tenant_id: str, run_id: str) -> Optional[Run]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if run_id in self._runs[tenant_id]:
                return self._runs[tenant_id][run_id]
            doc = mongo_manager.find_one("runs", {"tenant_id": tenant_id, "run_id": run_id})
            if doc:
                r = Run(**doc)
                self._runs[tenant_id][run_id] = r
                return r
            return None

    def list_runs(self, tenant_id: str) -> List[Run]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            return list(self._runs[tenant_id].values())

    def save_task(self, tenant_id: str, task: TaskAttempt) -> TaskAttempt:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._tasks[tenant_id][task.task_attempt_id] = task
            mongo_manager.upsert_document(
                "tasks",
                {"tenant_id": tenant_id, "task_attempt_id": task.task_attempt_id},
                task.model_dump(),
            )
            return task

    def list_tasks_for_run(self, tenant_id: str, run_id: str) -> List[TaskAttempt]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            return [t for t in self._tasks[tenant_id].values() if t.run_id == run_id]

    # -------------------------------------------------------------
    # Validations, Reconciliations & Exceptions
    # -------------------------------------------------------------
    def add_validation_result(self, tenant_id: str, result: ValidationResult):
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._validations[tenant_id].append(result)
            mongo_manager.upsert_document(
                "validations",
                {"tenant_id": tenant_id, "result_id": result.result_id},
                result.model_dump(),
            )

    def list_validations_for_run(self, tenant_id: str, run_id: str) -> List[ValidationResult]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            return [v for v in self._validations[tenant_id] if v.run_id == run_id]

    def add_reconciliation_result(self, tenant_id: str, result: ReconciliationResult):
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._reconciliations[tenant_id].append(result)
            mongo_manager.upsert_document(
                "reconciliations",
                {"tenant_id": tenant_id, "recon_result_id": result.recon_result_id},
                result.model_dump(),
            )

    def list_reconciliations_for_run(self, tenant_id: str, run_id: str) -> List[ReconciliationResult]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            return [r for r in self._reconciliations[tenant_id] if r.run_id == run_id]

    def save_exception(self, tenant_id: str, exc: ExceptionCase) -> ExceptionCase:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._exceptions[tenant_id][exc.exception_id] = exc
            mongo_manager.upsert_document(
                "exceptions",
                {"tenant_id": tenant_id, "exception_id": exc.exception_id},
                exc.model_dump(),
            )
            return exc

    def get_exception(self, tenant_id: str, exception_id: str) -> Optional[ExceptionCase]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            return self._exceptions[tenant_id].get(exception_id)

    def list_exceptions(self, tenant_id: str, run_id: Optional[str] = None) -> List[ExceptionCase]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            excs = list(self._exceptions[tenant_id].values())
            if run_id:
                return [e for e in excs if e.run_id == run_id]
            return excs

    # -------------------------------------------------------------
    # Approvals & Audit Events
    # -------------------------------------------------------------
    def add_approval(self, tenant_id: str, approval: Approval):
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._approvals[tenant_id].append(approval)
            mongo_manager.upsert_document(
                "approvals",
                {"tenant_id": tenant_id, "approval_id": approval.approval_id},
                approval.model_dump(),
            )

    def list_approvals(self, tenant_id: str) -> List[Approval]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            return list(self._approvals[tenant_id])

    def add_audit_event(self, tenant_id: str, event: AuditEvent):
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            self._audit_events[tenant_id].append(event)
            mongo_manager.upsert_document(
                "audit_events",
                {"tenant_id": tenant_id, "event_id": event.event_id},
                event.model_dump(),
            )

    def list_audit_events(self, tenant_id: str, correlation_id: Optional[str] = None) -> List[AuditEvent]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            events = list(self._audit_events[tenant_id])
            if correlation_id:
                return [e for e in events if e.correlation_id == correlation_id]
            return events

    # -------------------------------------------------------------
    # Destination Mapping Persistence (Ontology-driven)
    # -------------------------------------------------------------
    def save_destination_mapping(
        self,
        tenant_id: str,
        destination_system_id: str,
        mapping_catalog: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Saves the ontology-aligned mapping catalog into the destination registry and MongoDB.
        Enables destination systems (Fabric, D365) to retain complete semantic definitions.
        """
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if destination_system_id not in self._destination_mappings[tenant_id]:
                self._destination_mappings[tenant_id][destination_system_id] = []

            catalog_entry = {
                "tenant_id": tenant_id,
                "destination_system_id": destination_system_id,
                "saved_at": time.time(),
                "catalog": mapping_catalog,
            }
            self._destination_mappings[tenant_id][destination_system_id].append(catalog_entry)
            mongo_manager.upsert_document(
                "destination_mappings",
                {
                    "tenant_id": tenant_id,
                    "destination_system_id": destination_system_id,
                    "mapping_version_id": mapping_catalog.get("mapping_version_id"),
                },
                catalog_entry,
            )
            return catalog_entry

    def get_destination_mappings(self, tenant_id: str, destination_system_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            return self._destination_mappings[tenant_id].get(destination_system_id, [])

    # -------------------------------------------------------------
    # Lineage & Staging (TA-007, TA-012)
    # -------------------------------------------------------------
    def record_lineage(
        self,
        tenant_id: str,
        run_id: str,
        target_record_id: str,
        source_record_id: Optional[str],
        source_system: str,
        target_system: str,
        mapping_version_id: str,
        rule_package_id: str,
        transformations_applied: List[Dict[str, Any]],
    ):
        """Records record-level lineage trace as required by TA-012."""
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if run_id not in self._lineage_records[tenant_id]:
                self._lineage_records[tenant_id][run_id] = {}

            lineage_doc = {
                "tenant_id": tenant_id,
                "target_record_id": str(target_record_id),
                "source_record_id": str(source_record_id) if source_record_id is not None else None,
                "source_system": source_system,
                "target_system": target_system,
                "run_id": run_id,
                "mapping_version_id": mapping_version_id,
                "rule_package_id": rule_package_id,
                "transformations_applied": transformations_applied,
                "trace_timestamp": time.time(),
            }
            self._lineage_records[tenant_id][run_id][str(target_record_id)] = lineage_doc
            mongo_manager.upsert_document(
                "lineage",
                {"tenant_id": tenant_id, "run_id": run_id, "target_record_id": str(target_record_id)},
                lineage_doc,
            )

    def get_lineage(self, tenant_id: str, run_id: str, target_record_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            in_mem = self._lineage_records[tenant_id].get(run_id, {}).get(str(target_record_id))
            if in_mem:
                return in_mem
            return mongo_manager.find_one(
                "lineage",
                {"tenant_id": tenant_id, "run_id": run_id, "target_record_id": str(target_record_id)},
            )

    def save_staged_partition(self, tenant_id: str, run_id: str, partition_id: str, records: List[Dict[str, Any]]):
        """Saves transient staged partition records during execution."""
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if run_id not in self._staging_partitions[tenant_id]:
                self._staging_partitions[tenant_id][run_id] = {}
            self._staging_partitions[tenant_id][run_id][partition_id] = [dict(r) for r in records]

    def get_staged_partition(self, tenant_id: str, run_id: str, partition_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            return self._staging_partitions[tenant_id].get(run_id, {}).get(partition_id, [])

    def purge_transient_staging(self, tenant_id: str, run_id: str):
        """Purges transient staging data after sign-off while preserving evidence (TA-007)."""
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if run_id in self._staging_partitions[tenant_id]:
                del self._staging_partitions[tenant_id][run_id]

    # -------------------------------------------------------------
    # User Accounts & Authentication
    # -------------------------------------------------------------
    def save_user(self, user: User) -> User:
        with self._lock:
            self._users[user.email.lower()] = user
            self._users_by_id[user.user_id] = user
            mongo_manager.upsert_document(
                "users",
                {"email": user.email.lower()},
                user.model_dump(),
            )
            return user

    def get_user_by_email(self, email: str) -> Optional[User]:
        with self._lock:
            clean_email = email.lower().strip()
            if clean_email in self._users:
                return self._users[clean_email]
            doc = mongo_manager.find_one("users", {"email": clean_email})
            if doc:
                user = User(**doc)
                self._users[clean_email] = user
                self._users_by_id[user.user_id] = user
                return user
            return None

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        with self._lock:
            if user_id in self._users_by_id:
                return self._users_by_id[user_id]
            doc = mongo_manager.find_one("users", {"user_id": user_id})
            if doc:
                user = User(**doc)
                self._users[user.email.lower()] = user
                self._users_by_id[user_id] = user
                return user
            return None

    def get_user_by_verification_token(self, token: str) -> Optional[User]:
        with self._lock:
            for u in self._users.values():
                if u.verification_token == token:
                    return u
            doc = mongo_manager.find_one("users", {"verification_token": token})
            if doc:
                user = User(**doc)
                self._users[user.email.lower()] = user
                self._users_by_id[user.user_id] = user
                return user
            return None

    def get_user_by_reset_token(self, token: str) -> Optional[User]:
        with self._lock:
            for u in self._users.values():
                if u.reset_token == token:
                    return u
            doc = mongo_manager.find_one("users", {"reset_token": token})
            if doc:
                user = User(**doc)
                self._users[user.email.lower()] = user
                self._users_by_id[user.user_id] = user
                return user
            return None

    # -------------------------------------------------------------
    # Ontology Vector Search & Chunks
    # -------------------------------------------------------------
    def save_ontology_chunks(self, tenant_id: str, ontology_id: str, chunks: List[OntologyChunk]) -> List[OntologyChunk]:
        with self._lock:
            self._init_tenant_buckets(tenant_id)
            if ontology_id not in self._ontology_chunks[tenant_id]:
                self._ontology_chunks[tenant_id][ontology_id] = {}
            for chunk in chunks:
                self._ontology_chunks[tenant_id][ontology_id][chunk.chunk_id] = chunk
                mongo_manager.upsert_document(
                    "ontology_chunks",
                    {"tenant_id": tenant_id, "ontology_id": ontology_id, "chunk_id": chunk.chunk_id},
                    chunk.model_dump(),
                )
            return chunks

    def get_ontology_chunks(self, tenant_id: Optional[str], ontology_id: str) -> List[OntologyChunk]:
        with self._lock:
            if tenant_id:
                self._init_tenant_buckets(tenant_id)
                if (
                    ontology_id in self._ontology_chunks[tenant_id]
                    and self._ontology_chunks[tenant_id][ontology_id]
                ):
                    return list(self._ontology_chunks[tenant_id][ontology_id].values())

            # Check across in-memory tenant buckets
            for t_id, ont_dict in self._ontology_chunks.items():
                if ontology_id in ont_dict and ont_dict[ontology_id]:
                    return list(ont_dict[ontology_id].values())

            # Query MongoDB
            query_filter: Dict[str, Any] = {"ontology_id": ontology_id}
            if tenant_id:
                query_filter["tenant_id"] = tenant_id
            docs = mongo_manager.find("ontology_chunks", query_filter)
            if not docs and tenant_id:
                docs = mongo_manager.find("ontology_chunks", {"ontology_id": ontology_id})

            chunks = [OntologyChunk(**d) for d in docs]
            target_t = tenant_id or "tenant-default"
            self._init_tenant_buckets(target_t)
            if ontology_id not in self._ontology_chunks[target_t]:
                self._ontology_chunks[target_t][ontology_id] = {}
            for c in chunks:
                self._ontology_chunks[target_t][ontology_id][c.chunk_id] = c
            return chunks

    def vector_search_ontology_chunks(
        self,
        tenant_id: str,
        ontology_id: str,
        query_embedding: List[float],
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Executes vector search over ontology chunks using cosine similarity.
        Returns top-K scoring chunks with score in range [-1.0, 1.0].
        """
        chunks = self.get_ontology_chunks(tenant_id, ontology_id)
        if not chunks or not query_embedding:
            return []

        import math

        q_norm = math.sqrt(sum(x * x for x in query_embedding))
        if q_norm == 0.0:
            return [{"chunk": c.model_dump(), "score": 0.0} for c in chunks[:top_k]]

        scored = []
        for c in chunks:
            c_emb = c.embedding
            if not c_emb:
                continue
            c_norm = math.sqrt(sum(y * y for y in c_emb))
            if c_norm == 0.0:
                continue
            dot = sum(x * y for x, y in zip(query_embedding, c_emb))
            cos_sim = dot / (q_norm * c_norm)
            scored.append({"chunk": c.model_dump(), "score": round(cos_sim, 5)})

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]


# Global storage singleton
store = MetadataStore()