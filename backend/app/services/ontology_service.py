"""
Ontology & Semantic Binding Service.
Fulfills requirements from Section 9 (Ontology and Semantic Mapping Design):
- Concept/entity/relation lifecycle.
- Immutable released versions with child-parent linkage.
- SemanticBinding linking concepts to physical objects.
- Graph-based Impact Analysis across dependencies.
"""

from typing import Any, Dict, List, Optional
import time
from app.models.canonical import (
    OntologyVersion,
    Concept,
    SemanticBinding,
    ArtifactStatus,
    BindingProvenance,
    OntologyEntity,
    EntityAttribute,
    OntologyRelationship,
)
from app.db.store import store
from app.core.errors import PlatformException, ErrorCategory


class OntologyService:
    """Manages business ontologies, entities, relationships, concepts, semantic bindings, and impact analysis."""

    def create_version(
        self,
        tenant_id: str,
        project_id: str,
        name: str = "Enterprise Business Ontology",
        description: Optional[str] = None,
        domain: Optional[str] = None,
        version_tag: str = "1.0.0",
        parent_id: Optional[str] = None,
        entities: Optional[List[OntologyEntity]] = None,
        relationships: Optional[List[OntologyRelationship]] = None,
        concepts: Optional[List[Concept]] = None,
    ) -> OntologyVersion:
        version = OntologyVersion(
            project_id=project_id,
            name=name,
            description=description,
            domain=domain,
            parent_id=parent_id,
            version_tag=version_tag,
            status=ArtifactStatus.DRAFT,
            entities=entities or [],
            relationships=relationships or [],
            concepts=concepts or [],
        )
        self._sync_concepts_from_entities(version)
        saved = store.save_ontology(tenant_id, version)
        from app.services.event_bus import event_bus
        from app.models.events import EventType
        event_bus.publish(
            tenant_id=tenant_id,
            event_type=EventType.ONTOLOGY_CREATED,
            payload={
                "ontology_version_id": version.ontology_version_id,
                "project_id": version.project_id,
                "name": version.name,
                "version_tag": version.version_tag,
            },
        )
        return saved

    def update_ontology(
        self,
        tenant_id: str,
        ontology_version_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        domain: Optional[str] = None,
        version_tag: Optional[str] = None,
        status: Optional[ArtifactStatus] = None,
        entities: Optional[List[OntologyEntity]] = None,
        relationships: Optional[List[OntologyRelationship]] = None,
    ) -> OntologyVersion:
        ontology = store.get_ontology(tenant_id, ontology_version_id)
        if not ontology:
            raise PlatformException(
                code="ONTOLOGY_NOT_FOUND",
                message=f"Ontology '{ontology_version_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        if name is not None:
            ontology.name = name
        if description is not None:
            ontology.description = description
        if domain is not None:
            ontology.domain = domain
        if version_tag is not None:
            ontology.version_tag = version_tag
        if status is not None:
            ontology.status = status
        if entities is not None:
            ontology.entities = entities
            self._sync_concepts_from_entities(ontology)
        if relationships is not None:
            ontology.relationships = relationships
        ontology.updated_at = time.time()
        return store.save_ontology(tenant_id, ontology)

    def delete_ontology(self, tenant_id: str, ontology_version_id: str) -> bool:
        ontology = store.get_ontology(tenant_id, ontology_version_id)
        if not ontology:
            raise PlatformException(
                code="ONTOLOGY_NOT_FOUND",
                message=f"Ontology '{ontology_version_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        return store.delete_ontology(tenant_id, ontology_version_id)

    # -------------------------------------------------------------
    # Entity CRUD
    # -------------------------------------------------------------
    def add_entity(
        self,
        tenant_id: str,
        ontology_version_id: str,
        name: str,
        label: Optional[str] = None,
        description: Optional[str] = None,
        category: str = "Master Data",
        attributes: Optional[List[EntityAttribute]] = None,
    ) -> OntologyEntity:
        ontology = store.get_ontology(tenant_id, ontology_version_id)
        if not ontology:
            raise PlatformException(
                code="ONTOLOGY_NOT_FOUND",
                message=f"Ontology '{ontology_version_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        # Check duplicate entity name
        if any(e.name.lower() == name.lower() for e in ontology.entities):
            raise PlatformException(
                code="DUPLICATE_ENTITY",
                message=f"Entity with name '{name}' already exists in this ontology",
                category=ErrorCategory.CONFLICT,
                status_code=409,
            )
        entity = OntologyEntity(
            name=name,
            label=label or name,
            description=description,
            category=category,
            attributes=attributes or [],
        )
        ontology.entities.append(entity)
        self._sync_concepts_from_entities(ontology)
        store.save_ontology(tenant_id, ontology)
        return entity

    def update_entity(
        self,
        tenant_id: str,
        ontology_version_id: str,
        entity_id: str,
        name: Optional[str] = None,
        label: Optional[str] = None,
        description: Optional[str] = None,
        category: Optional[str] = None,
        attributes: Optional[List[EntityAttribute]] = None,
    ) -> OntologyEntity:
        ontology = store.get_ontology(tenant_id, ontology_version_id)
        if not ontology:
            raise PlatformException(
                code="ONTOLOGY_NOT_FOUND",
                message=f"Ontology '{ontology_version_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        target_entity = None
        for ent in ontology.entities:
            if ent.entity_id == entity_id:
                target_entity = ent
                break
        if not target_entity:
            raise PlatformException(
                code="ENTITY_NOT_FOUND",
                message=f"Entity '{entity_id}' not found in ontology",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        old_name = target_entity.name
        if name is not None:
            target_entity.name = name
        if label is not None:
            target_entity.label = label
        if description is not None:
            target_entity.description = description
        if category is not None:
            target_entity.category = category
        if attributes is not None:
            target_entity.attributes = attributes
        # Update relationship entity name references
        if name is not None and old_name != name:
            for rel in ontology.relationships:
                if rel.source_entity_id == entity_id:
                    rel.source_entity_name = name
                if rel.target_entity_id == entity_id:
                    rel.target_entity_name = name
        self._sync_concepts_from_entities(ontology)
        store.save_ontology(tenant_id, ontology)
        return target_entity

    def delete_entity(
        self,
        tenant_id: str,
        ontology_version_id: str,
        entity_id: str,
    ) -> bool:
        ontology = store.get_ontology(tenant_id, ontology_version_id)
        if not ontology:
            raise PlatformException(
                code="ONTOLOGY_NOT_FOUND",
                message=f"Ontology '{ontology_version_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        initial_len = len(ontology.entities)
        ontology.entities = [e for e in ontology.entities if e.entity_id != entity_id]
        if len(ontology.entities) == initial_len:
            raise PlatformException(
                code="ENTITY_NOT_FOUND",
                message=f"Entity '{entity_id}' not found in ontology",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        # Cascade delete relationships referencing this entity
        ontology.relationships = [
            r for r in ontology.relationships
            if r.source_entity_id != entity_id and r.target_entity_id != entity_id
        ]
        self._sync_concepts_from_entities(ontology)
        store.save_ontology(tenant_id, ontology)
        return True

    # -------------------------------------------------------------
    # Relationship CRUD
    # -------------------------------------------------------------
    def add_relationship(
        self,
        tenant_id: str,
        ontology_version_id: str,
        name: str,
        source_entity_id: str,
        target_entity_id: str,
        relation_type: str = "ASSOCIATION",
        cardinality: str = "ONE_TO_MANY",
        label: Optional[str] = None,
        description: Optional[str] = None,
        is_bidirectional: bool = False,
    ) -> OntologyRelationship:
        ontology = store.get_ontology(tenant_id, ontology_version_id)
        if not ontology:
            raise PlatformException(
                code="ONTOLOGY_NOT_FOUND",
                message=f"Ontology '{ontology_version_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        src = next((e for e in ontology.entities if e.entity_id == source_entity_id), None)
        tgt = next((e for e in ontology.entities if e.entity_id == target_entity_id), None)
        if not src or not tgt:
            raise PlatformException(
                code="ENTITY_NOT_FOUND",
                message="Source or target entity does not exist in this ontology",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        rel = OntologyRelationship(
            name=name,
            label=label or name,
            source_entity_id=source_entity_id,
            source_entity_name=src.name,
            target_entity_id=target_entity_id,
            target_entity_name=tgt.name,
            relation_type=relation_type,
            cardinality=cardinality,
            description=description,
            is_bidirectional=is_bidirectional,
        )
        ontology.relationships.append(rel)
        store.save_ontology(tenant_id, ontology)
        return rel

    def update_relationship(
        self,
        tenant_id: str,
        ontology_version_id: str,
        relationship_id: str,
        name: Optional[str] = None,
        label: Optional[str] = None,
        relation_type: Optional[str] = None,
        cardinality: Optional[str] = None,
        description: Optional[str] = None,
        is_bidirectional: Optional[bool] = None,
    ) -> OntologyRelationship:
        ontology = store.get_ontology(tenant_id, ontology_version_id)
        if not ontology:
            raise PlatformException(
                code="ONTOLOGY_NOT_FOUND",
                message=f"Ontology '{ontology_version_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        target_rel = next((r for r in ontology.relationships if r.relationship_id == relationship_id), None)
        if not target_rel:
            raise PlatformException(
                code="RELATIONSHIP_NOT_FOUND",
                message=f"Relationship '{relationship_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        if name is not None:
            target_rel.name = name
        if label is not None:
            target_rel.label = label
        if relation_type is not None:
            target_rel.relation_type = relation_type
        if cardinality is not None:
            target_rel.cardinality = cardinality
        if description is not None:
            target_rel.description = description
        if is_bidirectional is not None:
            target_rel.is_bidirectional = is_bidirectional
        store.save_ontology(tenant_id, ontology)
        return target_rel

    def delete_relationship(
        self,
        tenant_id: str,
        ontology_version_id: str,
        relationship_id: str,
    ) -> bool:
        ontology = store.get_ontology(tenant_id, ontology_version_id)
        if not ontology:
            raise PlatformException(
                code="ONTOLOGY_NOT_FOUND",
                message=f"Ontology '{ontology_version_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        initial_len = len(ontology.relationships)
        ontology.relationships = [r for r in ontology.relationships if r.relationship_id != relationship_id]
        if len(ontology.relationships) == initial_len:
            raise PlatformException(
                code="RELATIONSHIP_NOT_FOUND",
                message=f"Relationship '{relationship_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        store.save_ontology(tenant_id, ontology)
        return True

    def _sync_concepts_from_entities(self, ontology: OntologyVersion):
        """Synchronizes entity definitions and attributes into canonical Concepts for RAG and mapping."""
        concepts: List[Concept] = []
        for ent in ontology.entities:
            concepts.append(
                Concept(
                    ontology_version_id=ontology.ontology_version_id,
                    type="Entity",
                    label=ent.label or ent.name,
                    definition=ent.description or f"Business entity representing {ent.name}",
                    aliases=[ent.name.lower(), ent.name.replace(" ", "_").lower()],
                )
            )
            for attr in ent.attributes:
                concept_type = "Identifier" if attr.is_primary_key else "Attribute"
                concepts.append(
                    Concept(
                        ontology_version_id=ontology.ontology_version_id,
                        type=concept_type,
                        label=f"{ent.name}.{attr.name}",
                        definition=attr.description or f"{attr.label} attribute of {ent.name}",
                        datatype_expectation=attr.datatype,
                        aliases=attr.aliases + [attr.name, f"{ent.name.lower()}_{attr.name.lower()}"],
                    )
                )
        if concepts:
            ontology.concepts = concepts


    def add_concept(
        self,
        tenant_id: str,
        ontology_version_id: str,
        label: str,
        definition: str,
        concept_type: str = "Attribute",
        datatype_expectation: Optional[str] = "string",
        aliases: Optional[List[str]] = None,
    ) -> Concept:
        ontology = store.get_ontology(tenant_id, ontology_version_id)
        if not ontology:
            raise PlatformException(
                code="ONTOLOGY_NOT_FOUND",
                message=f"Ontology version '{ontology_version_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )

        if ontology.status == ArtifactStatus.APPROVED:
            raise PlatformException(
                code="IMMUTABLE_ARTIFACT",
                message="Cannot modify a released immutable ontology version. Create a child version.",
                category=ErrorCategory.CONFLICT,
                status_code=409,
            )

        concept = Concept(
            ontology_version_id=ontology_version_id,
            type=concept_type,
            label=label,
            definition=definition,
            datatype_expectation=datatype_expectation,
            aliases=aliases or [],
        )
        ontology.concepts.append(concept)
        store.save_ontology(tenant_id, ontology)
        from app.services.event_bus import event_bus
        from app.models.events import EventType
        event_bus.publish(
            tenant_id=tenant_id,
            event_type=EventType.ONTOLOGY_CONCEPT_ADDED,
            payload={
                "ontology_version_id": ontology_version_id,
                "concept_id": concept.concept_id,
                "label": concept.label,
                "type": concept.type,
            },
        )
        return concept

    def bind_concept(
        self,
        tenant_id: str,
        ontology_version_id: str,
        concept_id: str,
        physical_object_id: str,
        confidence: float = 1.0,
        provenance: BindingProvenance = BindingProvenance.MANUAL,
    ) -> SemanticBinding:
        ontology = store.get_ontology(tenant_id, ontology_version_id)
        if not ontology:
            raise PlatformException(
                code="ONTOLOGY_NOT_FOUND",
                message=f"Ontology version '{ontology_version_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )

        binding = SemanticBinding(
            concept_id=concept_id,
            physical_object_id=physical_object_id,
            confidence=confidence,
            provenance=provenance,
            reviewer_state="APPROVED",
        )
        ontology.bindings.append(binding)
        store.save_ontology(tenant_id, ontology)
        return binding

    def perform_impact_analysis(
        self,
        tenant_id: str,
        ontology_version_id: str,
        concept_id: str,
    ) -> Dict[str, Any]:
        """
        Traverses Concept -> Binding -> Mapping -> Rule -> Manifest dependencies
        to forecast impact of semantic changes before promotion (Section 9).
        """
        ontology = store.get_ontology(tenant_id, ontology_version_id)
        if not ontology:
            raise PlatformException(
                code="ONTOLOGY_NOT_FOUND",
                message=f"Ontology version '{ontology_version_id}' not found",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )

        # 1. Find concept
        matched_concepts = [c for c in ontology.concepts if c.concept_id == concept_id]
        concept_label = matched_concepts[0].label if matched_concepts else concept_id

        # 2. Find bindings
        affected_bindings = [b for b in ontology.bindings if b.concept_id == concept_id]
        bound_physical_ids = [b.physical_object_id for b in affected_bindings]

        # 3. Find mapping sets referencing bound physical attributes
        affected_mapping_sets: List[str] = []
        for ms in store._mapping_sets.get(tenant_id, {}).values():
            for m in ms.mappings:
                if any(phy in m.source_refs or phy == m.target_ref for phy in bound_physical_ids):
                    affected_mapping_sets.append(ms.mapping_version_id)
                    break

        # 4. Find affected manifests
        affected_manifests: List[str] = []
        for man in store._manifests.get(tenant_id, {}).values():
            if man.ontology_version_id == ontology_version_id or man.mapping_version_id in affected_mapping_sets:
                affected_manifests.append(man.manifest_id)

        return {
            "concept_id": concept_id,
            "concept_label": concept_label,
            "affected_bindings_count": len(affected_bindings),
            "bound_physical_objects": bound_physical_ids,
            "affected_mapping_sets": affected_mapping_sets,
            "affected_manifests": affected_manifests,
            "risk_tier": "HIGH" if affected_manifests else ("MEDIUM" if affected_mapping_sets else "LOW"),
        }


ontology_service = OntologyService()
