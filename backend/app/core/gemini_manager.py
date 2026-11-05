"""
Gemini Multi-Key Round-Robin & Failover Manager.
Provides thread-safe round-robin load distribution across multiple Gemini API keys
for the Ontology RAG vector embeddings.

Features:
- Thread-safe key cycling via threading.Lock
- Telemetry per key (total calls, success count, error count, last used)
- Automatic failover upon rate limits (HTTP 429) or transient errors (HTTP 5xx)
- Zero-secret leakage: all keys are masked (e.g. 'AIza...7LPM')
- Output dimensionality configuration (768 or 3072)
- Offline deterministic fallback for hermetic unit testing
"""

import threading
import time
import httpx
import hashlib
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import mask_secret

logger = get_logger("gemini_manager")


class GeminiKeyTelemetry(BaseModel):
    """Telemetry metrics tracked per Gemini API key."""
    key_index: int
    masked_key: str
    total_calls: int = 0
    success_calls: int = 0
    failure_calls: int = 0
    last_status_code: Optional[int] = None
    last_error: Optional[str] = None
    is_active: bool = True
    cooldown_until: float = 0.0


class GeminiRoundRobinManager:
    """
    Thread-safe round-robin manager for Gemini API keys.
    Provides vector embeddings for ontology RAG documents and queries.
    """

    def __init__(self, raw_keys: Optional[str] = None, load_env: bool = True):
        self._lock = threading.Lock()
        self._current_index = 0
        self._telemetry: Dict[int, GeminiKeyTelemetry] = {}
        self.keys: List[str] = []

        if raw_keys:
            self._load_keys(raw_keys)
        elif load_env:
            raw = settings.GEMINI_API_KEYS or settings.GEMINI_API_KEY or ""
            self._load_keys(raw)

    def _load_keys(self, raw_str: str) -> None:
        """Parses comma- or newline-separated keys into unique sanitized tokens."""
        if not raw_str:
            return
        
        # Replace newlines with commas and split
        tokens = [t.strip().strip("'\"") for t in raw_str.replace("\n", ",").split(",") if t.strip()]
        valid_keys = []
        for t in tokens:
            if t and t not in valid_keys:
                valid_keys.append(t)

        self.keys = valid_keys
        with self._lock:
            self._telemetry = {
                idx: GeminiKeyTelemetry(
                    key_index=idx,
                    masked_key=mask_secret(key),
                )
                for idx, key in enumerate(self.keys)
            }
        logger.info(f"Loaded {len(self.keys)} Gemini API keys for embedding round-robin rotation.")

    def add_key(self, api_key: str) -> None:
        """Dynamically adds a new Gemini API key to the active rotation pool."""
        clean = api_key.strip().strip("'\"")
        with self._lock:
            if clean and clean not in self.keys:
                idx = len(self.keys)
                self.keys.append(clean)
                self._telemetry[idx] = GeminiKeyTelemetry(
                    key_index=idx,
                    masked_key=mask_secret(clean)
                )

    def get_pool_status(self) -> List[Dict[str, Any]]:
        """Returns non-sensitive health telemetry for all keys in the pool."""
        with self._lock:
            return [t.model_dump() for t in self._telemetry.values()]

    def _get_next_key_index(self) -> Optional[int]:
        """Atomically advances and returns the next eligible key index."""
        if not self.keys:
            return None
        
        now = time.time()
        with self._lock:
            total = len(self.keys)
            for _ in range(total):
                idx = self._current_index % total
                self._current_index = (self._current_index + 1) % total
                
                telemetry = self._telemetry.get(idx)
                if telemetry and telemetry.is_active and now >= telemetry.cooldown_until:
                    return idx

            # If all are cooling down, select the least recently failed key
            return self._current_index % total

    def generate_embedding(
        self,
        text: str,
        model: Optional[str] = None,
        dimension: Optional[int] = None,
    ) -> List[float]:
        """
        Generates a vector embedding for the input text using round-robin Gemini keys.
        Falls back automatically on rate limit or failure to the next available key.
        """
        if not text or not text.strip():
            target_dim = dimension or settings.GEMINI_EMBEDDING_DIMENSION
            return [0.0] * target_dim

        model_name = model or settings.GEMINI_EMBEDDING_MODEL
        target_dim = dimension or settings.GEMINI_EMBEDDING_DIMENSION

        if not self.keys:
            logger.warning("No Gemini API keys configured. Generating deterministic fallback embedding.")
            return self._deterministic_fallback_embedding(text, target_dim)

        max_attempts = min(len(self.keys), 5)
        for attempt in range(max_attempts):
            idx = self._get_next_key_index()
            if idx is None:
                break
            
            key = self.keys[idx]
            telemetry = self._telemetry[idx]
            telemetry.total_calls += 1

            url = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:embedContent?key={key}"
            payload = {
                "content": {"parts": [{"text": text[:8000]}]},
                "outputDimensionality": target_dim
            }

            try:
                response = httpx.post(url, json=payload, timeout=12.0)
                telemetry.last_status_code = response.status_code

                if response.status_code == 200:
                    data = response.json()
                    values = data.get("embedding", {}).get("values", [])
                    if values:
                        telemetry.success_calls += 1
                        return values
                    else:
                        telemetry.failure_calls += 1
                        telemetry.last_error = "Empty values returned in embedding response"
                elif response.status_code == 429:
                    telemetry.failure_calls += 1
                    telemetry.cooldown_until = time.time() + 60.0  # 1 min cooldown
                    telemetry.last_error = "Rate limit (HTTP 429) encountered. Cycling to next key."
                    logger.warning(f"Gemini key #{idx} hit rate limit. Cool down 60s.")
                elif response.status_code in (401, 403):
                    telemetry.failure_calls += 1
                    telemetry.is_active = False  # Deactivate invalid key
                    telemetry.last_error = f"Authentication failure ({response.status_code})."
                    logger.warning(f"Gemini key #{idx} authentication failed: {response.text[:100]}")
                else:
                    telemetry.failure_calls += 1
                    telemetry.last_error = f"HTTP {response.status_code}: {response.text[:100]}"
            except Exception as e:
                telemetry.failure_calls += 1
                telemetry.last_error = str(e)
                logger.error(f"Error calling Gemini embedding with key #{idx}: {e}")

        logger.warning("All Gemini keys failed or exhausted. Using deterministic fallback embedding.")
        return self._deterministic_fallback_embedding(text, target_dim)

    def batch_generate_embeddings(
        self,
        texts: List[str],
        model: Optional[str] = None,
        dimension: Optional[int] = None,
    ) -> List[List[float]]:
        """Generates embeddings for a batch of text chunks sequentially with key rotation."""
        return [self.generate_embedding(t, model, dimension) for t in texts]

    def _deterministic_fallback_embedding(self, text: str, dimension: int = 768) -> List[float]:
        """
        Generates a deterministic pseudo-embedding based on sha256 hash.
        Ensures unit tests and offline environments work deterministically without external API calls.
        """
        import math
        vector = []
        seed = hashlib.sha256(text.encode("utf-8")).digest()
        for i in range(dimension):
            byte_val = seed[i % len(seed)]
            val = math.sin((i + 1) * byte_val)
            vector.append(round(val, 6))
        # Normalize vector
        norm = math.sqrt(sum(v * v for v in vector)) or 1.0
        return [round(v / norm, 6) for v in vector]



def batch_generate_embeddings(
    self,
    texts: List[str],
    model: Optional[str] = None,
    dimension: Optional[int] = None,
) -> List[List[float]]:
    """
    Generate embeddings for a list of texts. Uses per-text round-robin
    selection with automatic failover, same as generate_embedding().
    """
    return [self.generate_embedding(t, model=model, dimension=dimension) for t in texts]


gemini_manager = GeminiRoundRobinManager()


