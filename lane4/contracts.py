"""Frozen contracts shared between the discrete-tick engine and Lane 4."""
from __future__ import annotations
from dataclasses import dataclass
from enum import StrEnum

class NodeState(StrEnum):
    OPERATIONAL = "operational"
    DEGRADED = "degraded"
    FAILED = "failed"

IMPACTED_STATES = frozenset({NodeState.DEGRADED, NodeState.FAILED})

@dataclass(frozen=True)
class Node:
    id: str
    name: str
    service_type: str
    failure_threshold: float

@dataclass(frozen=True)
class DependencyEdge:
    """A directed edge: failure of upstream_id contributes to dependent_id."""
    upstream_id: str
    dependent_id: str
    weight: float

@dataclass(frozen=True)
class StateChangeEvent:
    time: int
    node_id: str
    previous_state: NodeState
    next_state: NodeState
    cause: str
    source_node_id: str | None = None

@dataclass(frozen=True)
class TickSnapshot:
    """Immutable, fully resolved state after this tick is evaluated."""
    time: int
    node_states: dict[str, NodeState]

@dataclass(frozen=True)
class Disruption:
    time: int
    node_id: str
    kind: str

@dataclass(frozen=True)
class RecoveryAction:
    time: int
    node_id: str
    kind: str

@dataclass(frozen=True)
class SimulationSettings:
    seed: int
    duration_ticks: int

@dataclass(frozen=True)
class Scenario:
    id: str
    version: int
    name: str
    description: str
    graph_id: str
    nodes: tuple[Node, ...]
    edges: tuple[DependencyEdge, ...]
    initial_disruptions: tuple[Disruption, ...]
    recovery_actions: tuple[RecoveryAction, ...]
    settings: SimulationSettings

@dataclass(frozen=True)
class SimulationResult:
    scenario_id: str
    seed: int
    start_time: int
    end_time: int
    snapshots: tuple[TickSnapshot, ...]
    events: tuple[StateChangeEvent, ...]

def is_impacted(state: NodeState) -> bool:
    return state in IMPACTED_STATES
