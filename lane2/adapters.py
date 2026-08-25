"""
Adapters between Lane 1's mutable dataclasses and Lane 4's frozen contracts.

Lane 1 input:  Scenario with Node(node_id, current_capacity, is_failed, threshold),
               Edge(source_id, target_id, weight)
Lane 4 output: SimulationResult(snapshots: tuple[TickSnapshot], events: tuple[StateChangeEvent])

Lane 2 never duplicates the type definitions — it imports directly from lane4.contracts
so that at integration time (Checkpoint B merge) there is zero drift.
"""
from __future__ import annotations

from lane4.contracts import NodeState, SimulationResult, StateChangeEvent, TickSnapshot
from .state import NodeRuntime, capacity_to_state


# ---------------------------------------------------------------------------
# Lane 1 Scenario → internal runtime
# ---------------------------------------------------------------------------

def lane1_to_runtime(scenario) -> dict[str, NodeRuntime]:
    """
    Convert Lane 1's Scenario.nodes list into a mutable NodeRuntime dict keyed
    by node_id. This is the only place we read Lane 1's Node fields.
    """
    return {
        node.node_id: NodeRuntime(
            node_id=node.node_id,
            capacity=node.current_capacity,
            is_failed=node.is_failed,
            threshold=node.threshold,
        )
        for node in scenario.nodes
    }


# ---------------------------------------------------------------------------
# Runtime → immutable Lane 4 snapshot
# ---------------------------------------------------------------------------

def runtime_to_snapshot(tick: int, runtime: dict[str, NodeRuntime]) -> TickSnapshot:
    """Freeze the current runtime into an immutable TickSnapshot for Lane 4."""
    return TickSnapshot(
        time=tick,
        node_states={
            nid: NodeState(capacity_to_state(n.capacity, n.is_failed))
            for nid, n in runtime.items()
        },
    )


# ---------------------------------------------------------------------------
# Final SimulationResult assembly
# ---------------------------------------------------------------------------

def build_result(
    scenario_id: str,
    seed: int,
    snapshots: list[TickSnapshot],
    events: list[StateChangeEvent],
) -> SimulationResult:
    """
    Assemble the final SimulationResult.

    Lane 4's _validate() checks:
      - snapshots have strictly increasing time  ✓ (we emit tick 0,1,2,...N)
      - events are sorted by ascending tick      ✓ (we sort here explicitly)
    """
    sorted_snapshots = tuple(sorted(snapshots, key=lambda s: s.time))
    sorted_events = tuple(sorted(events, key=lambda e: e.time))

    return SimulationResult(
        scenario_id=scenario_id,
        seed=seed,
        start_time=sorted_snapshots[0].time if sorted_snapshots else 0,
        end_time=sorted_snapshots[-1].time if sorted_snapshots else 0,
        snapshots=sorted_snapshots,
        events=sorted_events,
    )
