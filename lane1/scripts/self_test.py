"""
Lane 1 self-test — run this after setup_db.sh to prove your two public
functions work, without needing Lane 2/3/4's code at all.

This is your Checkpoint A deliverable (load_scenario) and a stand-in
for Checkpoint C (save_run + round-trip) using fake tick data, since
Lane 2's real run_simulation() doesn't exist yet.

Usage: python3 scripts/self_test.py
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import Node, TickState, RecoveryAction, RunLog
from repository import load_scenario, save_run, load_run


def test_load_scenario():
    print("--- load_scenario('seed_1') ---")
    scenario = load_scenario("seed_1")
    assert scenario.scenario_id == "seed_1"
    assert len(scenario.nodes) == 6, f"expected 6 nodes, got {len(scenario.nodes)}"
    assert len(scenario.edges) == 6, f"expected 6 edges, got {len(scenario.edges)}"
    assert scenario.initial_disruptions == ["power_substation_1"]
    print(f"OK — {len(scenario.nodes)} nodes, {len(scenario.edges)} edges, "
          f"seed={scenario.seed}, initial_disruptions={scenario.initial_disruptions}")
    return scenario


def test_save_and_reload_run(scenario):
    print("\n--- save_run() + load_run() round-trip (fake tick data) ---")

    # Build 2 fake ticks by hand — stand-in for Lane 2's real output,
    # just to prove the DB boundary works correctly in isolation.
    node_map_t0 = {n.node_id: n for n in scenario.nodes}

    node_map_t1 = {nid: Node(**vars(n)) for nid, n in node_map_t0.items()}
    node_map_t1["power_substation_1"].is_failed = True
    node_map_t1["power_substation_1"].current_capacity = 0.0

    run_log = RunLog(
        scenario_id=scenario.scenario_id,
        run_id="self_test_run_1",
        ticks=[
            TickState(tick=0, nodes=node_map_t0),
            TickState(tick=1, nodes=node_map_t1),
        ],
        recovery_actions=[
            RecoveryAction(
                node_id="power_substation_1",
                tick_triggered=1,
                tick_effective=3,
                restored_capacity=1.0,
            )
        ],
        metrics={
            "cascade_depth": 1,
            "affected_services": 1,
            "affected_by_type": {"power": 1},
            "recovery_time": 2,
        },
    )

    save_run(run_log)
    print("OK — save_run() completed")

    reloaded = load_run("self_test_run_1")
    assert reloaded.run_id == "self_test_run_1"
    assert len(reloaded.ticks) == 2
    assert reloaded.ticks[1].nodes["power_substation_1"].is_failed is True
    assert reloaded.metrics["cascade_depth"] == 1
    print("OK — load_run() round-trip matches what was saved")


if __name__ == "__main__":
    scenario = test_load_scenario()
    test_save_and_reload_run(scenario)
    print("\nAll Lane 1 self-tests passed.")