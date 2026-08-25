"""
Mutable runtime state for a single node during the tick loop.
Internal to Lane 2 — never exposed outside this package.
"""
from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class NodeRuntime:
    """Live working state of one node during the tick loop."""
    node_id: str
    capacity: float      # 0.0–1.0, mutated each tick
    is_failed: bool
    threshold: float


def capacity_to_state(capacity: float, is_failed: bool) -> str:
    """
    Map internal (capacity, is_failed) to a NodeState string value.

    Mapping:
      is_failed=True or capacity==0.0 → "failed"
      0.0 < capacity < 1.0           → "degraded"
      capacity == 1.0                → "operational"
    """
    if is_failed or capacity == 0.0:
        return "failed"
    if capacity < 1.0:
        return "degraded"
    return "operational"
