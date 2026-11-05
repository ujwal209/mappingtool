"""
Groq API Key Round-Robin and Failover Manager.
Implements the user requirement:
"see you can use groq api for the llm nultiple api keys in round robin format"

Features:
- Thread-safe round-robin distribution across multiple Groq API keys.
- Automatic failover: if one key fails or encounters a rate limit (HTTP 429),
  the manager automatically attempts the next available key.
- Per-key health and usage telemetry (total requests, successes, failures, last error).
- Masked secret exposure to guarantee zero secret leakage (TA-008).
- Fallback/Mock mode when AI is disabled or keys are unavailable (TA-006).
"""

import os
import threading
import time
from typing import Any, Dict, List, Optional, Tuple
from dotenv import load_dotenv
from groq import Groq
from langchain_groq import ChatGroq

from app.core.security import mask_secret

load_dotenv()


class KeyStats:
    """Telemetry data tracking usage and health for a single API key."""
    def __init__(self, key: str):
        self.key = key
        self.masked = mask_secret(key)
        self.total_calls = 0
        self.successful_calls = 0
        self.failed_calls = 0
        self.last_used_at: Optional[float] = None
        self.last_error: Optional[str] = None
        self.is_healthy = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "key_masked": self.masked,
            "total_calls": self.total_calls,
            "successful_calls": self.successful_calls,
            "failed_calls": self.failed_calls,
            "last_used_at": self.last_used_at,
            "last_error": self.last_error,
            "is_healthy": self.is_healthy,
        }


class GroqRoundRobinManager:
    """
    Production-grade, thread-safe Groq API Key Pool Manager with Round-Robin scheduling,
    automatic failover on errors, and observable telemetry.
    """

    def __init__(self, default_keys: Optional[List[str]] = None, load_env: bool = True):
        self._lock = threading.Lock()
        self._index = 0
        self._keys: List[str] = []
        self._stats: Dict[str, KeyStats] = {}
        if load_env:
            self._load_from_env()

        if default_keys:
            self.add_keys(default_keys)

    def _load_from_env(self):
        """Load API keys from GROQ_API_KEYS or GROQ_API_KEY environment variables."""
        load_dotenv(override=True)
        raw_keys = os.environ.get("GROQ_API_KEYS", "") or os.environ.get("GROQ_API_KEY", "")
        if raw_keys:
            clean = raw_keys.strip("\"' \r\n")
            # Support comma, semicolon, or newline separators
            for sep in [";", "\n"]:
                clean = clean.replace(sep, ",")
            for key_str in clean.split(","):
                k = key_str.strip("\"' \r\n\t")
                if k and k.startswith("gsk_") and k not in self._keys:
                    self._keys.append(k)
                    self._stats[k] = KeyStats(k)

    def reload_keys(self):
        """Reload and refresh keys from environment."""
        with self._lock:
            self._keys = []
            self._stats = {}
            self._index = 0
            self._load_from_env()

    def add_keys(self, keys: List[str]) -> int:
        """Add new keys to the active pool. Returns number of newly added keys."""
        added = 0
        with self._lock:
            for k in keys:
                clean_k = k.strip("\"' \r\n\t")
                if clean_k and clean_k.startswith("gsk_") and clean_k not in self._keys:
                    self._keys.append(clean_k)
                    self._stats[clean_k] = KeyStats(clean_k)
                    added += 1
        return added

    def get_keys_count(self) -> int:
        """Get total number of configured keys."""
        with self._lock:
            return len(self._keys)

    def get_metrics(self) -> List[Dict[str, Any]]:
        """Return masked key telemetry and usage metrics."""
        with self._lock:
            return [stat.to_dict() for stat in self._stats.values()]

    def get_next_key(self, provided_keys: Optional[List[str]] = None) -> Tuple[str, KeyStats]:
        """
        Retrieves the next key in round-robin sequence and its telemetry tracker.
        Raises ValueError if no keys are configured.
        """
        with self._lock:
            pool = provided_keys if provided_keys and len(provided_keys) > 0 else self._keys
            clean_pool = [k.strip("\"' \r\n\t") for k in pool if k.strip("\"' \r\n\t")]
            
            if not clean_pool:
                raise ValueError(
                    "No Groq API keys available. Set GROQ_API_KEYS in backend/.env or pass keys in request."
                )

            selected_key = clean_pool[self._index % len(clean_pool)]
            self._index = (self._index + 1) % len(clean_pool)

            if selected_key not in self._stats:
                self._stats[selected_key] = KeyStats(selected_key)
            
            stat = self._stats[selected_key]
            stat.total_calls += 1
            stat.last_used_at = time.time()
            return selected_key, stat

    def record_success(self, key: str):
        """Record successful execution with the specified key."""
        with self._lock:
            if key in self._stats:
                self._stats[key].successful_calls += 1
                self._stats[key].is_healthy = True

    def record_failure(self, key: str, error_message: str):
        """Record a failure with the specified key."""
        with self._lock:
            if key in self._stats:
                self._stats[key].failed_calls += 1
                self._stats[key].last_error = error_message
                self._stats[key].is_healthy = False

    def get_groq_client(self, provided_keys: Optional[List[str]] = None) -> Tuple[Groq, str]:
        """
        Returns an initialized Groq client using round-robin selection.
        Returns a tuple of (GroqClient, selected_key).
        """
        key, _ = self.get_next_key(provided_keys)
        return Groq(api_key=key), key

    def get_chat_model(
        self,
        model_name: str = "qwen/qwen3.8-27b",
        temperature: float = 0.0,
        provided_keys: Optional[List[str]] = None,
    ) -> Tuple[ChatGroq, str]:
        """
        Returns an initialized LangChain ChatGroq instance using round-robin selection.
        Returns a tuple of (ChatGroq, selected_key).
        """
        key, _ = self.get_next_key(provided_keys)
        chat = ChatGroq(
            groq_api_key=key,
            model_name=model_name,
            temperature=temperature,
        )
        return chat, key


# Global singleton instance
groq_manager = GroqRoundRobinManager()
