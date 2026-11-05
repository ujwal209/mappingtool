"""
Groq Multi-Key Round-Robin & Failover Tests.
Verifies the user requirement:
"see you can use groq api for the llm multiple api keys in round robin format"
"""

import threading
import pytest
from app.core.groq_manager import GroqRoundRobinManager
from app.core.security import mask_secret


def test_round_robin_rotation():
    """Verify keys are picked in strict round-robin sequence."""
    test_keys = [
        "gsk_key11111111111111111111111111111111",
        "gsk_key22222222222222222222222222222222",
        "gsk_key33333333333333333333333333333333",
    ]
    mgr = GroqRoundRobinManager(default_keys=test_keys, load_env=False)
    
    k1, _ = mgr.get_next_key()
    k2, _ = mgr.get_next_key()
    k3, _ = mgr.get_next_key()
    k4, _ = mgr.get_next_key()

    assert k1 == test_keys[0]
    assert k2 == test_keys[1]
    assert k3 == test_keys[2]
    assert k4 == test_keys[0]  # Wraps around cleanly


def test_thread_safe_concurrent_rotation():
    """Verify round-robin distribution is thread-safe across concurrent worker threads."""
    test_keys = [
        "gsk_threadkeyA111111111111111111111111",
        "gsk_threadkeyB222222222222222222222222",
    ]
    mgr = GroqRoundRobinManager(default_keys=test_keys, load_env=False)
    results = []
    lock = threading.Lock()

    def worker():
        for _ in range(50):
            k, _ = mgr.get_next_key()
            with lock:
                results.append(k)

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(results) == 200
    # Exactly half should be key A and half key B
    assert results.count(test_keys[0]) == 100
    assert results.count(test_keys[1]) == 100


def test_telemetry_and_masking():
    """Verify usage counts and secret masking."""
    key = "gsk_prodsecretkey99998888777766665555"
    mgr = GroqRoundRobinManager(default_keys=[key], load_env=False)

    k, stat = mgr.get_next_key()
    mgr.record_success(k)

    metrics = mgr.get_metrics()
    assert len(metrics) == 1
    m = metrics[0]
    
    # Verify raw secret never leaks (TA-008)
    assert key not in str(m)
    assert m["key_masked"] == mask_secret(key)
    assert m["total_calls"] == 1
    assert m["successful_calls"] == 1
    assert m["is_healthy"] is True


def test_dynamic_key_addition():
    """Verify keys can be added dynamically at runtime."""
    mgr = GroqRoundRobinManager()
    initial_count = mgr.get_keys_count()

    new_key = "gsk_dynamickey1234567890abcdef12345"
    added = mgr.add_keys([new_key])
    
    assert added == 1
    assert mgr.get_keys_count() == initial_count + 1
