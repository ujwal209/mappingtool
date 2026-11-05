"""
Pydantic structured-output schemas for the Ontology Agent.

Key change: EntityOperation is now a discriminated UNION keyed on `op`.
This eliminates the "8 optional fields" ambiguity that broke Groq's
strict json_schema compilation.
"""

from typing import Annotated, List, Literal, Optional, Union
from pydantic import BaseModel, Field, field_validator, AliasChoices, ConfigDict


# --------------------------------------------------------------
# Intents
# --------------------------------------------------------------
class IntentClassification(BaseModel):
    intent: Literal["conversational", "schema_mutation"] = Field(
        ..., description="conversational OR schema_mutation"
    )
    reasoning: str = Field(..., description="One-sentence justification.")
    model_config = ConfigDict(extra="ignore")


# --------------------------------------------------------------
# Domain analysis
# --------------------------------------------------------------
class DomainAnalysis(BaseModel):
    domain: str = Field(
        ...,
        validation_alias=AliasChoices("domain", "domainName", "domain_name", "name"),
    )
    ontology_name: str = Field(
        ...,
        validation_alias=AliasChoices("ontology_name", "ontologyTitle", "ontology_title", "title"),
    )
    description: str = Field(
        default="",
        validation_alias=AliasChoices("description", "executiveScope", "executive_scope", "scope", "summary"),
    )
    core_entities: List[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("core_entities", "coreEntities", "entities", "entity_names"),
    )
    model_config = ConfigDict(extra="ignore")

    @field_validator("core_entities", mode="before")
    @classmethod
    def _coerce_entities(cls, v):
        if not v:
            return []
        if isinstance(v, list):
            out = []
            for item in v:
                if isinstance(item, str):
                    out.append(item)
                elif isinstance(item, dict) and "name" in item:
                    out.append(item["name"])
            return out[:20]
        return []


# --------------------------------------------------------------
# Entities & attributes
# --------------------------------------------------------------
DatatypeLiteral = Literal[
    "string", "uuid", "integer", "bigint", "decimal",
    "boolean", "timestamp", "datetime", "date", "json", "text",
]

EntityCategoryLiteral = Literal[
    "Master Data", "Transactional", "Reference", "Associative", "Operational"
]


def _humanize(name: str) -> str:
    if not name:
        return ""
    return " ".join("ID" if p.lower() == "id" else p.capitalize()
                    for p in name.replace("_", " ").split())


class AttributeSpec(BaseModel):
    name: str
    label: str = Field(default="")
    datatype: DatatypeLiteral = Field(default="string")
    is_primary_key: bool = False
    is_foreign_key: bool = False
    is_indexed: bool = False
    is_nullable: bool = True
    is_unique: bool = False
    is_pii: bool = False
    foreign_key_target: Optional[str] = None
    default_value: Optional[str] = None
    description: str = ""
    aliases: List[str] = Field(default_factory=list)
    model_config = ConfigDict(extra="ignore")

    @field_validator("label", mode="after")
    @classmethod
    def _fill_label(cls, v: str, info):
        if v and v.strip():
            return v.strip()
        return _humanize(info.data.get("name", ""))


class EntitySpec(BaseModel):
    name: str
    label: str = Field(default="")
    category: EntityCategoryLiteral = "Master Data"
    description: str = ""
    attributes: List[AttributeSpec] = Field(default_factory=list)
    model_config = ConfigDict(extra="ignore")

    @field_validator("label", mode="after")
    @classmethod
    def _fill_label(cls, v: str, info):
        if v and v.strip():
            return v.strip()
        return info.data.get("name", "")


class EntityList(BaseModel):
    entities: List[EntitySpec] = Field(default_factory=list)
    model_config = ConfigDict(extra="ignore")


# --------------------------------------------------------------
# ⭐ Discriminated-union Operations (THE FIX)
# --------------------------------------------------------------
class CreateEntityOp(BaseModel):
    op: Literal["CREATE_ENTITY"]
    entity_name: str = Field(..., description="PascalCase name of the NEW entity to create")

class DeleteEntityOp(BaseModel):
    op: Literal["DELETE_ENTITY"]
    entity_name: str

class RenameEntityOp(BaseModel):
    op: Literal["RENAME_ENTITY"]
    entity_name: str
    new_name: str = Field(..., description="New PascalCase name")

class UpdateEntityOp(BaseModel):
    op: Literal["UPDATE_ENTITY"]
    entity_name: str
    new_label: Optional[str] = None
    new_description: Optional[str] = None
    new_category: Optional[EntityCategoryLiteral] = None

class AddAttributeOp(BaseModel):
    op: Literal["ADD_ATTRIBUTE"]
    entity_name: str
    attribute_spec: AttributeSpec

class DeleteAttributeOp(BaseModel):
    op: Literal["DELETE_ATTRIBUTE"]
    entity_name: str
    attribute_name: str

class DeleteRelationshipOp(BaseModel):
    op: Literal["DELETE_RELATIONSHIP"]
    relationship_name: str


EntityOperation = Annotated[
    Union[
        CreateEntityOp,
        DeleteEntityOp,
        RenameEntityOp,
        UpdateEntityOp,
        AddAttributeOp,
        DeleteAttributeOp,
        DeleteRelationshipOp,
    ],
    Field(discriminator="op"),
]


class OperationPlan(BaseModel):
    operations: List[EntityOperation] = Field(default_factory=list)
    summary: str = Field(default="", description="One-sentence summary.")
    model_config = ConfigDict(extra="ignore")


# --------------------------------------------------------------
# Relationships
# --------------------------------------------------------------
RelationTypeLiteral = Literal["ASSOCIATION", "COMPOSITION", "AGGREGATION", "INHERITANCE"]
CardinalityLiteral = Literal["ONE_TO_ONE", "ONE_TO_MANY", "MANY_TO_ONE", "MANY_TO_MANY"]


class OntologicalRelationshipSpec(BaseModel):
    name: str = Field(..., validation_alias=AliasChoices("name", "relationship", "predicate"))
    label: str = Field(default="", validation_alias=AliasChoices("label", "display_name", "displayName"))
    source_entity_name: str = Field(
        ...,
        validation_alias=AliasChoices(
            "source_entity_name", "source", "sourceEntityName", "source_entity", "from",
        ),
    )
    target_entity_name: str = Field(
        ...,
        validation_alias=AliasChoices(
            "target_entity_name", "target", "targetEntityName", "target_entity", "to",
        ),
    )
    relation_type: RelationTypeLiteral = "ASSOCIATION"
    cardinality: CardinalityLiteral = "ONE_TO_MANY"
    description: str = "Business relationship."
    is_bidirectional: bool = False
    model_config = ConfigDict(extra="ignore")

    @field_validator("relation_type", mode="before")
    @classmethod
    def _normalize_relation(cls, v):
        if not v: return "ASSOCIATION"
        s = str(v).upper().strip()
        return s if s in ("ASSOCIATION", "COMPOSITION", "AGGREGATION", "INHERITANCE") else "ASSOCIATION"

    @field_validator("cardinality", mode="before")
    @classmethod
    def _normalize_cardinality(cls, v):
        if not v: return "ONE_TO_MANY"
        s = str(v).upper().strip()
        if s in ("ONE_TO_ONE", "ONE_TO_MANY", "MANY_TO_ONE", "MANY_TO_MANY"):
            return s
        if "N:M" in s or "M:N" in s: return "MANY_TO_MANY"
        if "*" in s:
            parts = s.split(" TO ")
            if len(parts) == 2:
                left_many = "*" in parts[0]
                right_many = "*" in parts[1]
                if left_many and not right_many: return "MANY_TO_ONE"
                if not left_many and right_many: return "ONE_TO_MANY"
        return "ONE_TO_MANY"

    @field_validator("label", mode="after")
    @classmethod
    def _fill_label(cls, v: str, info):
        if v and v.strip(): return v.strip()
        name = info.data.get("name", "")
        return name.replace("_", " ").title() if name else ""


class RelationshipList(BaseModel):
    relationships: List[OntologicalRelationshipSpec] = Field(default_factory=list)
    model_config = ConfigDict(extra="ignore")


class PersistenceResult(BaseModel):
    ontology_id: str
    ontology_name: str
    entity_count: int
    relationship_count: int
    is_plan: bool