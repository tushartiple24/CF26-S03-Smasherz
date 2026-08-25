"""Metric calculations over Lane 2's immutable snapshots and event timeline."""
from collections import defaultdict
from dataclasses import asdict, dataclass
from .contracts import Node, NodeState, SimulationResult, StateChangeEvent, is_impacted

@dataclass(frozen=True)
class MetricsPayload:
    scenario_id: str
    seed: int
    headline: dict
    cascade_depth_ticks: int
    dependency_hop_depth: int
    affected_services: dict
    recovery_time: dict
    peak_impact: dict
    timeline: dict
    def for_frontend(self) -> dict:
        return asdict(self)

def _validate(result: SimulationResult) -> None:
    if not result.snapshots:
        raise ValueError("SimulationResult must include at least one TickSnapshot")
    if any(a.time >= b.time for a, b in zip(result.snapshots, result.snapshots[1:])):
        raise ValueError("Snapshots must have strictly increasing tick times")
    if tuple(sorted(result.events, key=lambda event: event.time)) != result.events:
        raise ValueError("Events must be sorted by ascending tick")

def _affected_services(result: SimulationResult, nodes: tuple[Node, ...]) -> dict:
    node_by_id = {node.id: node for node in nodes}
    affected_ids = {event.node_id for event in result.events if is_impacted(event.next_state)}
    grouped: dict[str, list[dict]] = defaultdict(list)
    for node_id in sorted(affected_ids):
        node = node_by_id.get(node_id, Node(node_id, node_id, "unknown", 1.0))
        grouped[node.service_type].append({"id": node.id, "name": node.name})
    return {"count": len(affected_ids), "node_ids": sorted(affected_ids), "by_service_type": [{"service_type": key, "count": len(value), "services": value} for key, value in sorted(grouped.items())]}

def _cascade_depth_ticks(result: SimulationResult) -> int:
    times = [event.time for event in result.events if is_impacted(event.next_state)]
    return 0 if not times else max(times) - min(times)

def _dependency_hop_depth(events: tuple[StateChangeEvent, ...]) -> int:
    depths: dict[str, int] = {}
    for event in events:
        if is_impacted(event.next_state):
            depth = 0 if event.source_node_id is None else depths.get(event.source_node_id, 0) + 1
            depths[event.node_id] = max(depths.get(event.node_id, 0), depth)
    return max(depths.values(), default=0)

def _peak_impact(result: SimulationResult) -> dict:
    counts = [(snapshot.time, sum(is_impacted(state) for state in snapshot.node_states.values())) for snapshot in result.snapshots]
    time, count = max(counts, key=lambda item: item[1])
    return {"count": count, "time": time}

def _recovery_time(result: SimulationResult) -> dict:
    affected = {event.node_id for event in result.events if is_impacted(event.next_state)}
    times = [event.time for event in result.events if is_impacted(event.next_state)]
    if not affected:
        return {"duration_ticks": 0, "recovered_at": None, "status": "not_applicable"}
    start = min(times)
    for snapshot in result.snapshots:
        if snapshot.time >= start and all(snapshot.node_states.get(node_id) == NodeState.OPERATIONAL for node_id in affected):
            return {"duration_ticks": snapshot.time - start, "recovered_at": snapshot.time, "status": "recovered"}
    return {"duration_ticks": None, "recovered_at": None, "status": "not_recovered"}

def _timeline(result: SimulationResult) -> dict:
    return {"initiating_events": [e for e in result.events if is_impacted(e.next_state) and e.source_node_id is None], "spread_events": [e for e in result.events if is_impacted(e.next_state) and e.source_node_id is not None], "recovery_events": [e for e in result.events if e.next_state == NodeState.OPERATIONAL], "final_system_condition": result.snapshots[-1].node_states}

def calculate_metrics(result: SimulationResult, nodes: tuple[Node, ...]) -> MetricsPayload:
    """Calculate analytics from real Lane 2 output, never a mocked timeline."""
    _validate(result)
    affected, cascade, recovery, peak = _affected_services(result, nodes), _cascade_depth_ticks(result), _recovery_time(result), _peak_impact(result)
    return MetricsPayload(result.scenario_id, result.seed, {"cascade_depth_ticks": cascade, "affected_services": affected["count"], "recovery_time_ticks": recovery["duration_ticks"], "recovery_status": recovery["status"], "peak_impact": peak["count"]}, cascade, _dependency_hop_depth(result.events), affected, recovery, peak, _timeline(result))
