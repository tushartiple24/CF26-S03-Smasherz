"""
Lane 2 — Discrete-tick cascade propagation engine.

Propagation rule (from S-03_Task_Division.md §1.4):

  At each tick t → t+1:
  1. impact_i = Σ(edge.weight × (1 - upstream.capacity))  for all incoming edges
  2. if impact_i > node.threshold:
       new_capacity = max(0.0, current_capacity - impact_i)
       capacity == 0.0  → FAILED
       0 < capacity < 1 → DEGRADED
  3. A failed node stays failed until an explicit RecoveryAction restores it.
  4. Cascade settles at the first tick where no node's is_failed changed.

Key design rules:
  - All impact calculations for a tick use a FROZEN snapshot of capacities
    from the START of that tick. This makes the result order-independent.
  - No DB calls, no I/O — pure Python objects in, Python objects out.
  - Recovery actions fire BEFORE propagation within the same tick so a
    restored node can act as a healthy upstream in the same step.
"""
from __future__ import annotations

from typing import Optional

from lane4.contracts import NodeState, StateChangeEvent, TickSnapshot

from .adapters import build_result, lane1_to_runtime, runtime_to_snapshot
from .state import NodeRuntime, capacity_to_state

_DEFAULT_MAX_TICKS = 100


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _apply_initial_disruptions(
    runtime: dict[str, NodeRuntime],
    initial_disruptions: list[str],
    events: list[StateChangeEvent],
) -> None:
    """Fail all initially disrupted nodes at tick 0, recording state-change events."""
    for node_id in initial_disruptions:
        node = runtime.get(node_id)
        if node is None:
            continue
        prev_state = NodeState(capacity_to_state(node.capacity, node.is_failed))
        node.is_failed = True
        node.capacity = 0.0
        next_state = NodeState.FAILED
        if prev_state != next_state:
            events.append(StateChangeEvent(
                time=0,
                node_id=node_id,
                previous_state=prev_state,
                next_state=next_state,
                cause="initial_disruption",
                source_node_id=None,
            ))


def _apply_recovery_actions(
    runtime: dict[str, NodeRuntime],
    recovery_actions: list,
    events: list[StateChangeEvent],
    tick: int,
) -> None:
    """
    Apply all RecoveryActions whose tick_effective matches the current tick.
    Uses Lane 1's RecoveryAction shape: .tick_effective, .node_id, .restored_capacity.
    """
    for action in recovery_actions:
        if action.tick_effective != tick:
            continue
        node = runtime.get(action.node_id)
        if node is None:
            continue
        prev_state = NodeState(capacity_to_state(node.capacity, node.is_failed))
        node.is_failed = False
        node.capacity = float(action.restored_capacity)
        next_state = NodeState(capacity_to_state(node.capacity, node.is_failed))
        if prev_state != next_state:
            events.append(StateChangeEvent(
                time=tick,
                node_id=action.node_id,
                previous_state=prev_state,
                next_state=next_state,
                cause="recovery_action",
                source_node_id=None,
            ))


def _has_pending_recovery(recovery_actions: list, current_tick: int, end_tick: int) -> bool:
    """Return True if any recovery action fires between now and end_tick (inclusive)."""
    return any(current_tick < a.tick_effective <= end_tick for a in recovery_actions)


def _propagation_tick(
    runtime: dict[str, NodeRuntime],
    edges: list,
    events: list[StateChangeEvent],
    tick: int,
) -> bool:
    """
    Execute one propagation step.

    Captures a frozen copy of all node capacities BEFORE mutating anything,
    so every node's impact is calculated against the same pre-tick state.

    Returns True if any node's visible NodeState changed (cascade still active).
    This includes OPERATIONAL→DEGRADED transitions, not just DEGRADED→FAILED.
    """
    # --- Freeze pre-tick state for impact calculations ---
    pre_capacity: dict[str, float] = {nid: n.capacity for nid, n in runtime.items()}
    pre_failed: dict[str, bool] = {nid: n.is_failed for nid, n in runtime.items()}
    pre_state: dict[str, str] = {
        nid: capacity_to_state(n.capacity, n.is_failed) for nid, n in runtime.items()
    }

    any_state_changed = False

    for node_id, node in runtime.items():
        # Already failed → only a RecoveryAction can help, not propagation
        if node.is_failed:
            continue

        # --- Compute total impact from all upstream (incoming) edges ---
        impact = 0.0
        for edge in edges:
            if edge.target_id != node_id:
                continue
            upstream_cap = pre_capacity.get(edge.source_id, 1.0)
            impact += edge.weight * (1.0 - upstream_cap)

        # Strict threshold check (S-03_Task_Division.md: "impact_i > node_i.threshold")
        if impact <= node.threshold:
            continue

        # --- Threshold exceeded: degrade or fail ---
        prev_state = NodeState(capacity_to_state(node.capacity, node.is_failed))

        new_capacity = max(0.0, node.capacity - impact)
        node.capacity = new_capacity
        node.is_failed = (new_capacity == 0.0)

        next_state = NodeState(capacity_to_state(node.capacity, node.is_failed))

        if prev_state != next_state:
            # Attribute this event to the highest-contributing upstream node
            source_node_id = _find_primary_source(node_id, edges, pre_capacity)
            events.append(StateChangeEvent(
                time=tick,
                node_id=node_id,
                previous_state=prev_state,
                next_state=next_state,
                cause="threshold_exceeded",
                source_node_id=source_node_id,
            ))
            any_state_changed = True

    return any_state_changed


def _find_primary_source(
    node_id: str,
    edges: list,
    pre_capacity: dict[str, float],
) -> Optional[str]:
    """Return the upstream node_id with the highest contribution to this node's impact."""
    best_source: Optional[str] = None
    best_contribution = 0.0
    for edge in edges:
        if edge.target_id != node_id:
            continue
        contribution = edge.weight * (1.0 - pre_capacity.get(edge.source_id, 1.0))
        if contribution > best_contribution:
            best_contribution = contribution
            best_source = edge.source_id
    return best_source


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def run_simulation(
    scenario,
    recovery_actions: Optional[list] = None,
    max_ticks: Optional[int] = None,
) -> "SimulationResult":
    """
    Run the discrete-tick cascade simulation.

    Args:
        scenario:         Lane 1's Scenario object (from load_scenario).
                          Required fields: scenario_id, seed, nodes, edges,
                          initial_disruptions.
        recovery_actions: List of Lane 1 RecoveryAction objects (optional).
                          Passed separately since they are not part of Scenario
                          (they live in the DB's recovery_actions table on Lane 1).
                          Each must have: node_id, tick_effective, restored_capacity.
        max_ticks:        Safety cap on loop iterations. Defaults to 100.

    Returns:
        SimulationResult (Lane 4's frozen contract) containing:
          - snapshots: full node state at every tick (strictly increasing time)
          - events:    every StateChangeEvent, sorted by tick
    """
    if recovery_actions is None:
        recovery_actions = []
    if max_ticks is None:
        max_ticks = _DEFAULT_MAX_TICKS

    runtime: dict[str, NodeRuntime] = lane1_to_runtime(scenario)
    edges = scenario.edges
    events: list[StateChangeEvent] = []
    snapshots: list[TickSnapshot] = []

    # ----------------------------------------------------------------
    # Tick 0 — apply initial disruptions, then snapshot
    # ----------------------------------------------------------------
    _apply_initial_disruptions(runtime, scenario.initial_disruptions, events)
    snapshots.append(runtime_to_snapshot(0, runtime))

    # ----------------------------------------------------------------
    # Ticks 1..max_ticks — propagate until settled
    # ----------------------------------------------------------------
    for tick in range(1, max_ticks + 1):
        # Recovery fires first, before propagation, so a restored node
        # can act as healthy upstream within the same tick.
        _apply_recovery_actions(runtime, recovery_actions, events, tick)

        any_changed = _propagation_tick(runtime, edges, events, tick)

        snapshots.append(runtime_to_snapshot(tick, runtime))

        # Settlement: no state changed AND no pending recoveries remain
        # A DEGRADED node can still worsen next tick even if is_failed didn't flip,
        # so we continue as long as any state transition occurred.
        pending_recovery = _has_pending_recovery(recovery_actions, tick, max_ticks)
        if not any_changed and not pending_recovery:
            break

    return build_result(scenario.scenario_id, scenario.seed, snapshots, events)
