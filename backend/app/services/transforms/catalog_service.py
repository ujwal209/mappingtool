"""
Transformation catalog service — CRUD, seeding, listing, lookup.

Backed by the store (in-memory + MongoDB sync, like every other service).
"""

import time
import uuid
from typing import Any, Dict, List, Optional

from app.core.errors import PlatformException, ErrorCategory
from app.core.logging import get_logger
from app.db.mongo import mongo_manager
from app.models.transformations import (
    TransformCategory,
    TransformKind,
    TransformParam,
    Transformation,
)
from app.services.transforms.builtin_catalog import build_seed_transformations
from app.services.transforms.executor import EXECUTORS, is_registered

logger = get_logger("transform_catalog_service")

COLLECTION = "transformations"


class TransformCatalogService:
    def __init__(self):
        # tenant_id -> {transform_id -> Transformation}
        self._cache: Dict[str, Dict[str, Transformation]] = {}
        self._seeded_tenants: set = set()

    # ─────────────────────────────────────────────────────────
    # Seeding
    # ─────────────────────────────────────────────────────────
    def ensure_seeded(self, tenant_id: str) -> None:
        """
        Idempotently seed the builtin catalog for a tenant.

        Called from main.py lifespan at startup, and lazily on first
        request per-tenant.
        """
        if tenant_id in self._seeded_tenants:
            return

        if tenant_id not in self._cache:
            self._cache[tenant_id] = {}

        # Check what's already in Mongo (builtins live under tenant-default)
        existing = mongo_manager.find_many(
            COLLECTION,
            {"tenant_id": "tenant-default", "is_system": True},
            limit=2000,
        )
        existing_keys = {d.get("key") for d in existing if d.get("key")}

        seeded = build_seed_transformations()
        added = 0
        for tx in seeded:
            if tx.key in existing_keys:
                # Pull into cache so we don't re-hit Mongo
                self._cache[tenant_id][tx.transform_id] = tx
                continue

            self._cache[tenant_id][tx.transform_id] = tx
            mongo_manager.upsert_document(
                COLLECTION,
                {
                    "tenant_id": "tenant-default",
                    "transform_id": tx.transform_id,
                },
                tx.model_dump(mode="json"),
            )
            added += 1

        self._seeded_tenants.add(tenant_id)
        logger.info(
            f"[TransformCatalog] Seeded tenant '{tenant_id}': "
            f"{len(seeded)} builtins total, {added} newly added"
        )

    # ─────────────────────────────────────────────────────────
    # Lookup
    # ─────────────────────────────────────────────────────────
    def get_by_id(
        self, tenant_id: str, transform_id: str
    ) -> Optional[Transformation]:
        self.ensure_seeded(tenant_id)
        cache = self._cache.get(tenant_id, {})
        if transform_id in cache:
            return cache[transform_id]

        # Fall back to Mongo
        doc = mongo_manager.find_one(
            COLLECTION,
            {"transform_id": transform_id},
        )
        if doc:
            try:
                tx = Transformation(**doc)
                cache[transform_id] = tx
                return tx
            except Exception as e:
                logger.warning(f"Failed to parse transform {transform_id}: {e}")
        return None

    def get_by_key(
        self, tenant_id: str, key: str
    ) -> Optional[Transformation]:
        """Get a transform by its stable key (e.g. 'trim')."""
        self.ensure_seeded(tenant_id)
        for tx in self._cache.get(tenant_id, {}).values():
            if tx.key == key and tx.is_active:
                return tx
        # Mongo fallback
        doc = mongo_manager.find_one(
            COLLECTION,
            {"key": key, "is_active": True},
        )
        if doc:
            try:
                return Transformation(**doc)
            except Exception:
                pass
        return None

    # ─────────────────────────────────────────────────────────
    # Listing
    # ─────────────────────────────────────────────────────────
    def list_transforms(
        self,
        tenant_id: str,
        category: Optional[TransformCategory] = None,
        search: Optional[str] = None,
        include_inactive: bool = False,
        kind: Optional[TransformKind] = None,
    ) -> List[Transformation]:
        self.ensure_seeded(tenant_id)

        # Pull from Mongo to include custom transforms from any tenant
        docs = mongo_manager.find_many(
            COLLECTION,
            {"tenant_id": {"$in": [tenant_id, "tenant-default"]}},
            limit=2000,
        )

        items: List[Transformation] = []
        for d in docs:
            try:
                items.append(Transformation(**d))
            except Exception:
                continue

        # Deduplicate by transform_id (cache overrides stale Mongo)
        by_id: Dict[str, Transformation] = {}
        for tx in items:
            by_id[tx.transform_id] = tx

        # Ensure cache-synced builtins are present
        for tx in self._cache.get(tenant_id, {}).values():
            by_id[tx.transform_id] = tx

        out = list(by_id.values())

        if not include_inactive:
            out = [t for t in out if t.is_active]
        if category:
            out = [t for t in out if t.category == category]
        if kind:
            out = [t for t in out if t.kind == kind]
        if search:
            q = search.lower().strip()
            out = [
                t for t in out
                if q in t.key.lower()
                or q in t.label.lower()
                or q in (t.description or "").lower()
            ]

        # Sort: category → system first → key
        out.sort(key=lambda t: (t.category.value, not t.is_system, t.key))
        return out

    def list_categories(self) -> List[Dict[str, Any]]:
        """Grouping metadata for the UI — categories with counts."""
        from app.services.transforms.builtin_catalog import BUILTIN_TRANSFORMS
        counts: Dict[str, int] = {}
        for spec in BUILTIN_TRANSFORMS:
            cat = spec["category"].value
            counts[cat] = counts.get(cat, 0) + 1
        return [
            {"value": cat.value, "label": cat.value.title(), "count": counts.get(cat.value, 0)}
            for cat in TransformCategory
        ]

    # ─────────────────────────────────────────────────────────
    # Create custom
    # ─────────────────────────────────────────────────────────
    def create_custom(
        self,
        tenant_id: str,
        key: str,
        label: str,
        description: str = "",
        category: TransformCategory = TransformCategory.CUSTOM,
        dsl_expression: str = "",
        params: Optional[List[TransformParam]] = None,
        arity_min: int = 1,
        arity_max: int = 1,
        example: Optional[str] = None,
    ) -> Transformation:
        self.ensure_seeded(tenant_id)

        # Validate key uniqueness
        existing = self.get_by_key(tenant_id, key)
        if existing:
            raise PlatformException(
                code="TRANSFORM_KEY_EXISTS",
                message=f"A transform with key '{key}' already exists.",
                category=ErrorCategory.CONFLICT,
                status_code=409,
            )

        # Validate DSL compiles
        try:
            from app.services.transforms.dsl_compiler import (
                validate_dsl_expression,
            )
            validate_dsl_expression(dsl_expression)
        except Exception as e:
            raise PlatformException(
                code="INVALID_DSL_EXPRESSION",
                message=f"DSL expression does not compile: {e}",
                category=ErrorCategory.VALIDATION_FAILED,
                status_code=400,
            )

        tx = Transformation(
            tenant_id=tenant_id,
            key=key,
            label=label,
            description=description,
            category=category,
            kind=TransformKind.CUSTOM_DSL,
            arity_min=arity_min,
            arity_max=arity_max,
            params=params or [],
            dsl_expression=dsl_expression,
            example=example,
            is_system=False,
        )

        self._cache.setdefault(tenant_id, {})[tx.transform_id] = tx
        mongo_manager.upsert_document(
            COLLECTION,
            {"tenant_id": tenant_id, "transform_id": tx.transform_id},
            tx.model_dump(mode="json"),
        )
        logger.info(
            f"[TransformCatalog] Created custom transform '{key}' "
            f"for tenant '{tenant_id}'"
        )
        return tx

    # ─────────────────────────────────────────────────────────
    # Update custom
    # ─────────────────────────────────────────────────────────
    def update_custom(
        self,
        tenant_id: str,
        transform_id: str,
        label: Optional[str] = None,
        description: Optional[str] = None,
        dsl_expression: Optional[str] = None,
        params: Optional[List[TransformParam]] = None,
        is_active: Optional[bool] = None,
    ) -> Transformation:
        tx = self.get_by_id(tenant_id, transform_id)
        if not tx:
            raise PlatformException(
                code="TRANSFORM_NOT_FOUND",
                message=f"Transform '{transform_id}' not found.",
                category=ErrorCategory.NOT_FOUND,
                status_code=404,
            )
        if tx.is_system:
            raise PlatformException(
                code="SYSTEM_TRANSFORM_IMMUTABLE",
                message="Built-in transforms cannot be edited. "
                        "Clone it to a custom transform instead.",
                category=ErrorCategory.CONFLICT,
                status_code=409,
            )

        if label is not None:
            tx.label = label
        if description is not None:
            tx.description = description
        if params is not None:
            tx.params = params
        if is_active is not None:
            tx.is_active = is_active
        if dsl_expression is not None:
            try:
                from app.services.transforms.dsl_compiler import (
                    validate_dsl_expression,
                )
                validate_dsl_expression(dsl_expression)
            except Exception as e:
                raise PlatformException(
                    code="INVALID_DSL_EXPRESSION",
                    message=f"DSL expression does not compile: {e}",
                    category=ErrorCategory.VALIDATION_FAILED,
                    status_code=400,
                )
            tx.dsl_expression = dsl_expression

        tx.updated_at = time.time()
        self._cache.setdefault(tenant_id, {})[transform_id] = tx
        mongo_manager.upsert_document(
            COLLECTION,
            {"tenant_id": tenant_id, "transform_id": transform_id},
            tx.model_dump(mode="json"),
        )
        return tx

    # ─────────────────────────────────────────────────────────
    # Delete custom
    # ─────────────────────────────────────────────────────────
    def delete_custom(self, tenant_id: str, transform_id: str) -> bool:
        tx = self.get_by_id(tenant_id, transform_id)
        if not tx:
            return False
        if tx.is_system:
            raise PlatformException(
                code="SYSTEM_TRANSFORM_IMMUTABLE",
                message="Built-in transforms cannot be deleted.",
                category=ErrorCategory.CONFLICT,
                status_code=409,
            )

        cache = self._cache.get(tenant_id, {})
        cache.pop(transform_id, None)
        mongo_manager.delete_one(
            COLLECTION,
            {"tenant_id": tenant_id, "transform_id": transform_id},
        )
        logger.info(
            f"[TransformCatalog] Deleted custom transform '{tx.key}' "
            f"from tenant '{tenant_id}'"
        )
        return True


transform_catalog_service = TransformCatalogService()