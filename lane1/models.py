"""
S-03 Urban Infrastructure Cascade Simulator
Data model — matches S-03_Task_Division.md Part 1 (frozen contract) EXACTLY.

Do not modify these shapes unilaterally. If a change is needed, it goes
through the whole team and the .md file gets updated first.
"""

from dataclasses import dataclass, field
from typing import Literal, Optional

NodeType = Literal["power", "water", "healthcare", "transport", "comms"]


@dataclass
class Node:
    node_id: str                # unique, e.g. "power_substation_1"
    type: NodeType
    current_capacity: float     # 0.0 to 1.0 (1.0 = fully operational)
    is_failed: bool
    threshold: float            # 0.0 to 1.0
    active_disruptions: list[str] = field(default_factory=list)


@dataclass
class Edge:
    source_id: str               # node whose failure propagates FROM
    target_id: str                # node it propagates TO
    dependency_type: str          # e.g. "power_supply", "water_supply"
    weight: float                 # 0.0 to 1.0


@dataclass
class TickState:
    tick: int
    nodes: dict[str, Node]        # node_id -> Node, full snapshot at this tick


@dataclass
class RecoveryAction:
    node_id: str
    tick_triggered: int
    tick_effective: int
    restored_capacity: float


@dataclass
class Scenario:
    scenario_id: str
    seed: int
    nodes: list[Node]
    edges: list[Edge]
    initial_disruptions: list[str]


@dataclass
class RunLog:
    scenario_id: str
    run_id: str
    ticks: list[TickState]
    recovery_actions: list[RecoveryAction]
    metrics: dict