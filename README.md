# Urban Resilience — Lane 4

Python/dataclasses scenario library and analytics for a deterministic discrete-tick simulation.

## Cross-lane contract

- **Lane 1 / PostgreSQL:** persists nodes, weighted directed dependencies, thresholds, versioned scenarios, and completed runs. Load the graph into memory once per run and persist it at scenario start/end—not within the tick loop.
- **Lane 2:** calculates each tick exclusively from the preceding immutable state, then returns `SimulationResult` with ordered snapshots/events. Same-tick disruptions are resolved before the next snapshot.
- **Lane 3:** animates `result.snapshots` and consumes `metrics.for_frontend()` for the analytics UI.
- **Lane 4:** calls `calculate_metrics(result, scenario.nodes)` using real Lane 2 output.

Each event includes `time`, `node_id`, `previous_state`, `next_state`, `cause`, and optional `source_node_id`.

## Metrics

- `cascade_depth_ticks`: ticks from the first disruption to the last new impact.
- `dependency_hop_depth`: supplementary causal depth from event provenance.
- `affected_services`: unique nodes ever degraded/failed, grouped by service type.
- `recovery_time`: ticks until every affected node is operational, otherwise `not_recovered`.
- `peak_impact`: most degraded/failed nodes in one immutable snapshot.

```python
from lane4 import calculate_metrics, get_scenario

scenario = get_scenario("cross-service-cascade")
result = lane2_engine.run(scenario)  # returns SimulationResult
analytics = calculate_metrics(result, scenario.nodes).for_frontend()
```

Run tests with `python -m unittest discover -s tests -v`.
