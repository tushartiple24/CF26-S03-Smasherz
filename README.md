# CF26-S03-Smasherz: Urban Infrastructure Cascade Simulator

## Problem statement & solution overview
**Problem:** S-03 Urban Infrastructure Cascade Simulator. 
**Solution:** A discrete-time simulation engine that models cascading failures across interdependent urban networks (power, water, healthcare, transport, comms)[cite: 1, 2].

## System architecture / workflow
The system is divided into 4 parallel lanes to ensure clean integration:
* **Lane 1 (Data Model & Storage):** Manages the PostgreSQL boundary. Data is loaded into memory at scenario start (t=0) and written back to the DB only upon scenario settlement (no mid-tick DB writes).
* **Lane 2 (Propagation Engine):** Executes the tick-by-tick simulation loop entirely in-memory[cite: 1].
* **Lane 3 (Frontend Visualization):** Animates graph state changes tick-by-tick[cite: 1].
* **Lane 4 (Scenario & Metrics):** Computes final cascade depth, affected services, and recovery time[cite: 1].

## Core technical mechanism
At each tick `t → t+1`, the simulation computes the total impact from failed or degraded neighbor nodes based on directed edge weights[cite: 1]. If the sum of this impact exceeds a node's operational threshold, the node fails, and its capacity drops[cite: 1]. The cascade continues until a tick occurs where no node states change[cite: 1].

## Technology stack
* **Language:** Python (using strict `dataclasses` for the data contract)[cite: 1]
* **Database:** PostgreSQL[cite: 1, 2]
* **Database Adapter:** `psycopg2` / `psycopg2.extras.RealDictCursor`
* **Storage Format:** Standard relational tables for initial state; `JSONB` for tick-by-tick historical snapshotting[cite: 2].

## Setup & installation instructions
Ensure PostgreSQL is running locally, then execute the following:
```bash
pip install -r requirements.txt

# Export local DB credentials
export S03_DB_HOST=localhost
export S03_DB_PORT=5432
export S03_DB_NAME=s03_cascade
export S03_DB_USER=postgres
export S03_DB_PASSWORD=your_actual_password

# Initialize database, schema, and seed data
./scripts/setup_db.sh
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
>>>>>>> origin/Lane4
