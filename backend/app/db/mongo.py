"""
MongoDB Client and Persistence Adapter.

Connects to database 'mapping' (or DB_NAME from env) using the fully-resolved
URI from settings.resolved_mongo_uri — which injects MONGODB_USERNAME /
MONGODB_PASSWORD into MONGODB_URI when necessary.

If the connection fails, every write becomes a no-op AND a loud warning is
logged with a masked URI so you can diagnose without leaking credentials.
"""

import threading
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, urlunparse

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

from app.core.config import settings
from app.core.logging import logger


# ============================================================
# Helpers
# ============================================================
def _mask_uri(uri: Optional[str]) -> str:
    """
    Mask credentials inside a MongoDB URI for safe logging.
    mongodb+srv://user:pass@host/db → mongodb+srv://user:****@host/db
    """
    if not uri:
        return "[NOT_SET]"
    try:
        p = urlparse(uri)
        if "@" not in (p.netloc or ""):
            return uri
        creds, host = p.netloc.rsplit("@", 1)
        if ":" in creds:
            user, _ = creds.split(":", 1)
            new_netloc = f"{user}:****@{host}"
        else:
            new_netloc = f"****@{host}"
        return urlunparse(
            (p.scheme, new_netloc, p.path, p.params, p.query, p.fragment)
        )
    except Exception:
        # Last-resort masking
        return "***masked***"


# ============================================================
# Manager
# ============================================================
class MongoDBManager:
    """
    Thread-safe MongoDB client manager for the migration platform.
    Connects to the configured database and manages document lifecycle.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._client: Optional[MongoClient] = None
        self._db: Optional[Database] = None
        self._is_connected: bool = False
        self._last_error: Optional[str] = None
        self._init_connection()

    def _init_connection(self):
        """Initialize MongoDB client using the resolved URI."""
        uri = settings.resolved_mongo_uri
        db_name = settings.DB_NAME or "mapping"

        if not uri:
            self._last_error = (
                "No MongoDB URI configured. "
                "Set MONGODB_URI (and optionally MONGODB_USERNAME / MONGODB_PASSWORD) "
                "in backend/.env"
            )
            logger.error(f"[MongoDB] {self._last_error}")
            self._is_connected = False
            return

        masked = _mask_uri(uri)
        try:
            self._client = MongoClient(
                uri,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
                socketTimeoutMS=5000,
                maxPoolSize=50,
                retryWrites=True,
            )
            # Verify connectivity with admin ping
            self._client.admin.command("ping")
            self._db = self._client[db_name]
            self._is_connected = True
            self._last_error = None
            logger.info(
                f"[MongoDB] Connected successfully → uri={masked} db={db_name}"
            )
            self._ensure_indexes()
        except PyMongoError as e:
            self._last_error = str(e)
            logger.error(
                f"[MongoDB] Connection FAILED → uri={masked} db={db_name} error={e}"
            )
            self._is_connected = False
        except Exception as e:  # noqa: BLE001
            self._last_error = str(e)
            logger.error(
                f"[MongoDB] Unexpected error → uri={masked} error={e}"
            )
            self._is_connected = False

    def _ensure_indexes(self):
        if not self._is_connected or self._db is None:
            return
        try:
            self._db["projects"].create_index(
                [("tenant_id", 1), ("project_id", 1)], unique=True
            )
            self._db["systems"].create_index(
                [("tenant_id", 1), ("system_id", 1)], unique=True
            )
            self._db["datasets"].create_index(
                [("tenant_id", 1), ("dataset_id", 1)], unique=True
            )
            self._db["ontologies"].create_index(
                [("tenant_id", 1), ("ontology_version_id", 1)], unique=True
            )
            self._db["mappings"].create_index(
                [("tenant_id", 1), ("mapping_version_id", 1)], unique=True
            )
            self._db["rule_packages"].create_index(
                [("tenant_id", 1), ("rule_package_id", 1)], unique=True
            )
            self._db["manifests"].create_index(
                [("tenant_id", 1), ("manifest_id", 1)], unique=True
            )
            self._db["runs"].create_index(
                [("tenant_id", 1), ("run_id", 1)], unique=True
            )
            self._db["audit_events"].create_index(
                [("tenant_id", 1), ("correlation_id", 1)]
            )
            self._db["lineage"].create_index(
                [("tenant_id", 1), ("run_id", 1), ("target_record_id", 1)]
            )
            self._db["destination_mappings"].create_index(
                [("tenant_id", 1), ("destination_system_id", 1)]
            )
            self._db["ontology_rag_documents"].create_index(
                [("tenant_id", 1), ("ontology_version_id", 1)]
            )
            self._db["ontology_chunks"].create_index(
                [("tenant_id", 1), ("ontology_id", 1)]
            )
            self._db["ontology_chunks"].create_index([("chunk_id", 1)], unique=True)
            self._db["users"].create_index([("email", 1)], unique=True)
            self._db["users"].create_index([("user_id", 1)], unique=True)
            logger.info("[MongoDB] Indexes verified")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[MongoDB] Index creation warning: {e}")

    # ------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------
    @property
    def is_connected(self) -> bool:
        return self._is_connected

    @property
    def last_error(self) -> Optional[str]:
        return self._last_error

    def get_database(self) -> Optional[Database]:
        return self._db

    def get_collection(self, collection_name: str) -> Optional[Collection]:
        if self._is_connected and self._db is not None:
            return self._db[collection_name]
        return None

    def upsert_document(
        self,
        collection_name: str,
        filter_dict: Dict[str, Any],
        doc: Dict[str, Any],
    ) -> bool:
        if not self._is_connected or self._db is None:
            logger.warning(
                f"[MongoDB] SKIP write → collection={collection_name} "
                f"(not connected, last_error={self._last_error})"
            )
            return False
        try:
            coll = self._db[collection_name]
            clean_doc = dict(doc)
            clean_doc.pop("_id", None)
            coll.update_one(filter_dict, {"$set": clean_doc}, upsert=True)
            return True
        except Exception as e:  # noqa: BLE001
            logger.error(
                f"[MongoDB] Upsert failed → collection={collection_name} "
                f"filter={filter_dict} error={e}"
            )
            return False

    def find_one(
        self, collection_name: str, filter_dict: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        if not self._is_connected or self._db is None:
            return None
        try:
            return self._db[collection_name].find_one(filter_dict, {"_id": 0})
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[MongoDB] find_one failed → {collection_name}: {e}")
            return None

    def find_many(
        self,
        collection_name: str,
        filter_dict: Dict[str, Any],
        limit: int = 500,
    ) -> List[Dict[str, Any]]:
        if not self._is_connected or self._db is None:
            return []
        try:
            return list(
                self._db[collection_name].find(filter_dict, {"_id": 0}).limit(limit)
            )
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[MongoDB] find_many failed → {collection_name}: {e}")
            return []

    def find(
        self,
        collection_name: str,
        filter_dict: Dict[str, Any],
        limit: int = 500,
    ) -> List[Dict[str, Any]]:
        return self.find_many(collection_name, filter_dict, limit)

    def delete_one(self, collection_name: str, filter_dict: Dict[str, Any]) -> bool:
        if not self._is_connected or self._db is None:
            return False
        try:
            self._db[collection_name].delete_one(filter_dict)
            return True
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[MongoDB] delete_one failed → {collection_name}: {e}")
            return False

    def delete_many(self, collection_name: str, filter_dict: Dict[str, Any]) -> int:
        if not self._is_connected or self._db is None:
            return 0
        try:
            return self._db[collection_name].delete_many(filter_dict).deleted_count
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[MongoDB] delete_many failed → {collection_name}: {e}")
            return 0


# ============================================================
# Global singleton
# ============================================================
mongo_manager = MongoDBManager()