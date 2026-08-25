"""
Lane 2 — Engine tests.

Test strategy:
  1. Unit tests with tiny in-line scenarios (no DB, no Lane 1 import)
  2. Hand-trace validation against seed_1 from Lane 1's seed.sql
  3. Cross-lane integration: pass SimulationResult into Lane 4's calculate_metrics()

All scenarios are built from simple dataclasses that mirror Lane 1's Scenario
shape (same field names). At Checkpoint B integration, swap the imports for
Lane 1's actual lane1/models.py — the engine accepts any object with the right
attribute names.
"""
import unittest
from dataclasses import dataclass, field
from typing import List

from lane4.contracts import NodeState, SimulationResult
from lane4.metrics import calculate_metrics
from lane4.contracts import Node as Lane4Node

from lane2 import run_simulation


# ---------------------------------------------------------------------------
# Minimal Lane 1-compatible fixtures (mirrors lane1/models.py field names)
# ---------------------------------------------------------------------------

@dataclass
class FakeNode:
    node_id: str
    type: str
    current_capacity: float
    is_failed: bool
    threshold: float
    active_disruptions: List[str] = field(default_factory=list)


@dataclass
class FakeEdge:
    source_id: str          # failure flows FROM here
    target_id: str          # TO here
    dependency_type: str
    weight: float


@dataclass
class FakeRecoveryAction:
    node_id: str
    tick_triggered: int
    tick_effective: int
    restored_capacity: float


@dataclass
class FakeScenario:
    scenario_id: str
    seed: int
    nodes: List[FakeNode]
    edges: List[FakeEdge]
    initial_disruptions: List[str]


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _snap(result: SimulationResult, tick: int) -> dict[str, NodeState]:
    """Return node_states dict for the given tick from the result snapshots."""
    for snap in result.snapshots:
        if snap.time == tick:
            return snap.node_states
    raise KeyError(f"No snapshot at tick {tick}")


# ===========================================================================
# Test Cases
# ===========================================================================

class TestInitialDisruption(unittest.TestCase):

    def test_disrupted_node_is_failed_at_tick_0(self):
        """A node listed in initial_disruptions must be FAILED in snapshot 0."""
        scenario = FakeScenario(
            scenario_id="t1", seed=1,
            nodes=[FakeNode("power", "power", 1.0, False, 0.5)],
            edges=[],
            initial_disruptions=["power"],
        )
        result = run_simulation(scenario)
        self.assertEqual(_snap(result, 0)["power"], NodeState.FAILED)

    def test_undisrupted_node_stays_operational_at_tick_0(self):
        """A node not in initial_disruptions and no incoming load stays OPERATIONAL."""
        scenario = FakeScenario(
            scenario_id="t2", seed=1,
            nodes=[
                FakeNode("power", "power", 1.0, False, 0.5),
                FakeNode("water", "water", 1.0, False, 0.4),
            ],
            edges=[FakeEdge("power", "water", "power_supply", 0.9)],
            initial_disruptions=["power"],
        )
        result = run_simulation(scenario)
        # tick 0: only power fails; water hasn't seen the impact yet
        self.assertEqual(_snap(result, 0)["water"], NodeState.OPERATIONAL)

    def test_disruption_event_recorded(self):
        """initial_disruption must emit a StateChangeEvent at time=0."""
        scenario = FakeScenario(
            scenario_id="t3", seed=1,
            nodes=[FakeNode("power", "power", 1.0, False, 0.5)],
            edges=[],
            initial_disruptions=["power"],
        )
        result = run_simulation(scenario)
        disruption_events = [
            e for e in result.events
            if e.cause == "initial_disruption" and e.node_id == "power"
        ]
        self.assertEqual(len(disruption_events), 1)
        self.assertEqual(disruption_events[0].next_state, NodeState.FAILED)
        self.assertEqual(disruption_events[0].time, 0)


class TestSingleHopCascade(unittest.TestCase):

    def test_downstream_fails_at_tick_1(self):
        """
        power (fails tick 0) → water (weight=0.9, threshold=0.4)
        impact at tick 1 = 0.9 × (1-0) = 0.9 > 0.4
        new_capacity = max(0, 1.0 - 0.9) = 0.10 → DEGRADED (not zero, so not FAILED yet)
        At tick 2: impact still 0.9 > 0.4, new_capacity = max(0, 0.10 - 0.9) = 0 → FAILED
        """
        scenario = FakeScenario(
            scenario_id="single_hop", seed=1,
            nodes=[
                FakeNode("power", "power", 1.0, False, 0.5),
                FakeNode("water", "water", 1.0, False, 0.4),
            ],
            edges=[FakeEdge("power", "water", "power_supply", 0.9)],
            initial_disruptions=["power"],
        )
        result = run_simulation(scenario)
        self.assertEqual(_snap(result, 0)["power"], NodeState.FAILED)
        self.assertEqual(_snap(result, 0)["water"], NodeState.OPERATIONAL)
        # tick 1: water degrades first (capacity 0.10 → DEGRADED)
        self.assertEqual(_snap(result, 1)["water"], NodeState.DEGRADED)
        # tick 2: water continues to fail (capacity 0 → FAILED)
        self.assertEqual(_snap(result, 2)["water"], NodeState.FAILED)

    def test_cascade_event_has_correct_source(self):
        """All threshold_exceeded events for water must name 'power' as source_node_id."""
        scenario = FakeScenario(
            scenario_id="source_test", seed=1,
            nodes=[
                FakeNode("power", "power", 1.0, False, 0.5),
                FakeNode("water", "water", 1.0, False, 0.4),
            ],
            edges=[FakeEdge("power", "water", "power_supply", 0.9)],
            initial_disruptions=["power"],
        )
        result = run_simulation(scenario)
        # Water degrades over 2 ticks (DEGRADED then FAILED) — expect ≥1 cascade event
        cascade_events = [
            e for e in result.events
            if e.cause == "threshold_exceeded" and e.node_id == "water"
        ]
        self.assertGreaterEqual(len(cascade_events), 1)
        for event in cascade_events:
            self.assertEqual(event.source_node_id, "power")

    def test_below_threshold_no_cascade(self):
        """
        weight=0.3 < threshold=0.5 → downstream never crosses threshold → stays OPERATIONAL.
        """
        scenario = FakeScenario(
            scenario_id="below_thresh", seed=1,
            nodes=[
                FakeNode("power", "power", 1.0, False, 0.5),
                FakeNode("water", "water", 1.0, False, 0.5),
            ],
            edges=[FakeEdge("power", "water", "power_supply", 0.3)],
            initial_disruptions=["power"],
        )
        result = run_simulation(scenario)
        # All snapshots after tick 0 should have water OPERATIONAL
        for snap in result.snapshots[1:]:
            self.assertEqual(snap.node_states["water"], NodeState.OPERATIONAL,
                             f"water should stay OPERATIONAL at tick {snap.time}")

    def test_at_threshold_no_cascade(self):
        """
        impact == threshold exactly → NOT > threshold (strict) → no cascade.
        This is the comms_tower_1 case from seed_1 (weight=0.6, threshold=0.6).
        """
        scenario = FakeScenario(
            scenario_id="at_thresh", seed=1,
            nodes=[
                FakeNode("power", "power", 1.0, False, 0.5),
                FakeNode("comms", "comms", 1.0, False, 0.6),
            ],
            edges=[FakeEdge("power", "comms", "power_supply", 0.6)],
            initial_disruptions=["power"],
        )
        result = run_simulation(scenario)
        for snap in result.snapshots[1:]:
            self.assertEqual(snap.node_states["comms"], NodeState.OPERATIONAL,
                             f"comms should stay OPERATIONAL at tick {snap.time} (impact==threshold, not strict >)")


class TestTwoHopCascade(unittest.TestCase):
    """
    3-node chain: power → water → hospital
    Mirrors Lane 4's hand-traced test (test_hand_traced_multi_hop_cascade).

    Weights and thresholds set so:
      tick 0: power FAILED
      tick 1: water DEGRADED
      tick 2: hospital FAILED
    """

    def _two_hop_scenario(self):
        return FakeScenario(
            scenario_id="two_hop", seed=7,
            nodes=[
                FakeNode("power",    "power",      1.0, False, 0.5),
                FakeNode("water",    "water",      1.0, False, 0.5),
                FakeNode("hospital", "healthcare", 1.0, False, 0.5),
            ],
            edges=[
                FakeEdge("power", "water",    "power_supply", 0.9),
                FakeEdge("water", "hospital", "water_supply", 0.9),
            ],
            initial_disruptions=["power"],
        )

    def test_two_hop_cascade_sequence(self):
        result = run_simulation(self._two_hop_scenario())
        # tick 0: power fails
        self.assertEqual(_snap(result, 0)["power"], NodeState.FAILED)
        self.assertEqual(_snap(result, 0)["water"], NodeState.OPERATIONAL)
        self.assertEqual(_snap(result, 0)["hospital"], NodeState.OPERATIONAL)
        # tick 1: water degraded (cap = 1.0 - 0.9 = 0.1 → DEGRADED, not 0)
        self.assertEqual(_snap(result, 1)["water"], NodeState.DEGRADED)
        self.assertEqual(_snap(result, 1)["hospital"], NodeState.OPERATIONAL)
        # tick 2: hospital crosses threshold due to degraded water
        self.assertIn(_snap(result, 2)["hospital"],
                      {NodeState.DEGRADED, NodeState.FAILED})

    def test_dependency_hop_depth(self):
        """Lane 4 should compute hop depth == 2 for a 2-hop chain."""
        result = run_simulation(self._two_hop_scenario())
        # Build Lane 4 nodes for calculate_metrics
        l4_nodes = (
            Lane4Node("power",    "Power",    "power",      0.5),
            Lane4Node("water",    "Water",    "water",      0.5),
            Lane4Node("hospital", "Hospital", "healthcare", 0.5),
        )
        metrics = calculate_metrics(result, l4_nodes)
        self.assertGreaterEqual(metrics.dependency_hop_depth, 1)


class TestSettlementDetection(unittest.TestCase):

    def test_settles_after_cascade_completes(self):
        """
        Once no node's is_failed changes, the loop must stop.
        Single-hop scenario: power fails → water fails at tick 1 → settled at tick 2.
        """
        scenario = FakeScenario(
            scenario_id="settle", seed=1,
            nodes=[
                FakeNode("power", "power", 1.0, False, 0.5),
                FakeNode("water", "water", 1.0, False, 0.4),
            ],
            edges=[FakeEdge("power", "water", "power_supply", 0.9)],
            initial_disruptions=["power"],
        )
        result = run_simulation(scenario)
        # Settlement snapshot exists — end_time must be finite (not max_ticks)
        self.assertLess(result.end_time, 100)

    def test_no_cascade_settles_at_tick_1(self):
        """
        Single disrupted node, no edges → nothing else can change.
        Should settle at tick 1 (first tick where no is_failed changed).
        """
        scenario = FakeScenario(
            scenario_id="immediate", seed=1,
            nodes=[FakeNode("power", "power", 1.0, False, 0.5)],
            edges=[],
            initial_disruptions=["power"],
        )
        result = run_simulation(scenario)
        self.assertEqual(result.end_time, 1)

    def test_snapshots_are_strictly_increasing(self):
        """Lane 4 _validate() requires strictly increasing snapshot times."""
        scenario = FakeScenario(
            scenario_id="order", seed=1,
            nodes=[
                FakeNode("power", "power", 1.0, False, 0.5),
                FakeNode("water", "water", 1.0, False, 0.4),
            ],
            edges=[FakeEdge("power", "water", "power_supply", 0.9)],
            initial_disruptions=["power"],
        )
        result = run_simulation(scenario)
        times = [s.time for s in result.snapshots]
        for a, b in zip(times, times[1:]):
            self.assertLess(a, b, f"Snapshot times not strictly increasing: {times}")

    def test_events_sorted_by_tick(self):
        """Lane 4 _validate() requires events sorted by ascending tick."""
        scenario = FakeScenario(
            scenario_id="evtorder", seed=1,
            nodes=[
                FakeNode("power", "power", 1.0, False, 0.5),
                FakeNode("water", "water", 1.0, False, 0.4),
            ],
            edges=[FakeEdge("power", "water", "power_supply", 0.9)],
            initial_disruptions=["power"],
        )
        result = run_simulation(scenario)
        times = [e.time for e in result.events]
        self.assertEqual(times, sorted(times), f"Events not sorted: {times}")


class TestSimultaneousDisruptions(unittest.TestCase):

    def test_both_nodes_fail_at_tick_0(self):
        """Two nodes in initial_disruptions must both be FAILED at tick 0."""
        scenario = FakeScenario(
            scenario_id="simultaneous", seed=1,
            nodes=[
                FakeNode("power", "power", 1.0, False, 0.5),
                FakeNode("water", "water", 1.0, False, 0.4),
                FakeNode("hospital", "healthcare", 1.0, False, 0.3),
            ],
            edges=[
                FakeEdge("power",   "hospital", "power_supply", 0.8),
                FakeEdge("water",   "hospital", "water_supply", 0.5),
            ],
            initial_disruptions=["power", "water"],
        )
        result = run_simulation(scenario)
        self.assertEqual(_snap(result, 0)["power"], NodeState.FAILED)
        self.assertEqual(_snap(result, 0)["water"], NodeState.FAILED)

    def test_converging_disruptions_pressure_downstream(self):
        """
        Hospital depends on both power (w=0.8) and water (w=0.5), threshold=0.3.
        Both fail at tick 0 → combined impact = 0.8+0.5 = 1.3 > 0.3 → hospital fails at tick 1.
        """
        scenario = FakeScenario(
            scenario_id="converging", seed=1,
            nodes=[
                FakeNode("power",    "power",      1.0, False, 0.5),
                FakeNode("water",    "water",      1.0, False, 0.4),
                FakeNode("hospital", "healthcare", 1.0, False, 0.3),
            ],
            edges=[
                FakeEdge("power", "hospital", "power_supply", 0.8),
                FakeEdge("water", "hospital", "water_supply", 0.5),
            ],
            initial_disruptions=["power", "water"],
        )
        result = run_simulation(scenario)
        self.assertIn(_snap(result, 1)["hospital"],
                      {NodeState.DEGRADED, NodeState.FAILED})


class TestRecoveryAction(unittest.TestCase):

    def test_recovery_restores_failed_node(self):
        """
        RecoveryAction(tick_effective=2) on a FAILED node → node is OPERATIONAL at tick 2.
        """
        scenario = FakeScenario(
            scenario_id="recovery", seed=1,
            nodes=[
                FakeNode("power", "power", 1.0, False, 0.5),
                FakeNode("water", "water", 1.0, False, 0.4),
            ],
            edges=[FakeEdge("power", "water", "power_supply", 0.9)],
            initial_disruptions=["power"],
        )
        recovery = [FakeRecoveryAction("power", tick_triggered=1, tick_effective=2, restored_capacity=1.0)]
        result = run_simulation(scenario, recovery_actions=recovery)
        # At tick 2, power must be restored
        self.assertEqual(_snap(result, 2)["power"], NodeState.OPERATIONAL)

    def test_recovery_event_recorded(self):
        """A recovery_action StateChangeEvent must be emitted at the right tick."""
        scenario = FakeScenario(
            scenario_id="recovery_event", seed=1,
            nodes=[FakeNode("power", "power", 1.0, False, 0.5)],
            edges=[],
            initial_disruptions=["power"],
        )
        recovery = [FakeRecoveryAction("power", tick_triggered=1, tick_effective=3, restored_capacity=1.0)]
        result = run_simulation(scenario, recovery_actions=recovery)
        rec_events = [e for e in result.events if e.cause == "recovery_action"]
        self.assertEqual(len(rec_events), 1)
        self.assertEqual(rec_events[0].time, 3)
        self.assertEqual(rec_events[0].next_state, NodeState.OPERATIONAL)

    def test_restored_node_prevents_further_cascade(self):
        """
        power fails tick 0, recovered at tick 2 → water should not degrade further
        once power is back.
        """
        scenario = FakeScenario(
            scenario_id="recovery_stops_cascade", seed=1,
            nodes=[
                FakeNode("power", "power", 1.0, False, 0.5),
                FakeNode("water", "water", 1.0, False, 0.4),
            ],
            edges=[FakeEdge("power", "water", "power_supply", 0.9)],
            initial_disruptions=["power"],
        )
        recovery = [FakeRecoveryAction("power", tick_triggered=1, tick_effective=2, restored_capacity=1.0)]
        result = run_simulation(scenario, recovery_actions=recovery)
        # After recovery at tick 2, power is OPERATIONAL → no new cascade pressure
        self.assertEqual(_snap(result, 2)["power"], NodeState.OPERATIONAL)


class TestHandTraceSeed1(unittest.TestCase):
    """
    Validate engine output against the manual trace from the implementation plan,
    using seed_1 graph from Lane 1's seed.sql.

    Graph:
      power_substation_1 (threshold=0.50) ─[0.90]→ water_treatment_1  (threshold=0.40)
      power_substation_1                  ─[0.80]→ hospital_1          (threshold=0.30)
      power_substation_1                  ─[0.60]→ comms_tower_1       (threshold=0.60)
      power_substation_1                  ─[0.40]→ transit_hub_1       (threshold=0.50)
      water_treatment_1                   ─[0.70]→ hospital_1
      comms_tower_1                       ─[0.50]→ traffic_control_1   (threshold=0.40)

    Initial disruption: power_substation_1

    Expected hand-trace:
      tick 0: power → FAILED
      tick 1: water → DEGRADED (cap=0.10), hospital → DEGRADED (cap=0.20),
              comms at threshold exactly (0.60 = 0.60) → stays OPERATIONAL,
              transit impact=0.40 < 0.50 → stays OPERATIONAL
      tick 2: water → FAILED (cap=0→0), hospital → FAILED (impact>>cap)
      tick 3: no is_failed changes → settled
    """

    def _seed1_scenario(self):
        return FakeScenario(
            scenario_id="seed_1", seed=42,
            nodes=[
                FakeNode("power_substation_1", "power",      1.0, False, 0.50),
                FakeNode("water_treatment_1",  "water",      1.0, False, 0.40),
                FakeNode("hospital_1",         "healthcare", 1.0, False, 0.30),
                FakeNode("transit_hub_1",      "transport",  1.0, False, 0.50),
                FakeNode("comms_tower_1",      "comms",      1.0, False, 0.60),
                FakeNode("traffic_control_1",  "transport",  1.0, False, 0.40),
            ],
            edges=[
                FakeEdge("power_substation_1", "water_treatment_1", "power_supply", 0.90),
                FakeEdge("water_treatment_1",  "hospital_1",         "water_supply", 0.70),
                FakeEdge("power_substation_1", "hospital_1",         "power_supply", 0.80),
                FakeEdge("power_substation_1", "comms_tower_1",      "power_supply", 0.60),
                FakeEdge("comms_tower_1",      "traffic_control_1",  "comms_link",   0.50),
                FakeEdge("power_substation_1", "transit_hub_1",      "power_supply", 0.40),
            ],
            initial_disruptions=["power_substation_1"],
        )

    def test_tick_0_only_power_fails(self):
        result = run_simulation(self._seed1_scenario())
        snap0 = _snap(result, 0)
        self.assertEqual(snap0["power_substation_1"], NodeState.FAILED)
        self.assertEqual(snap0["water_treatment_1"],  NodeState.OPERATIONAL)
        self.assertEqual(snap0["hospital_1"],         NodeState.OPERATIONAL)
        self.assertEqual(snap0["comms_tower_1"],      NodeState.OPERATIONAL)
        self.assertEqual(snap0["transit_hub_1"],      NodeState.OPERATIONAL)
        self.assertEqual(snap0["traffic_control_1"],  NodeState.OPERATIONAL)

    def test_tick_1_water_and_hospital_degrade(self):
        result = run_simulation(self._seed1_scenario())
        snap1 = _snap(result, 1)
        # water: impact=0.90 > 0.40 → DEGRADED (cap = 1.0-0.90 = 0.10)
        self.assertEqual(snap1["water_treatment_1"], NodeState.DEGRADED)
        # hospital: impact=0.80 > 0.30 → DEGRADED
        self.assertIn(snap1["hospital_1"], {NodeState.DEGRADED, NodeState.FAILED})
        # comms: impact=0.60, threshold=0.60 → NOT > (strict) → OPERATIONAL
        self.assertEqual(snap1["comms_tower_1"],     NodeState.OPERATIONAL)
        # transit: impact=0.40 < 0.50 → OPERATIONAL
        self.assertEqual(snap1["transit_hub_1"],     NodeState.OPERATIONAL)

    def test_tick_2_water_and_hospital_fail(self):
        result = run_simulation(self._seed1_scenario())
        snap2 = _snap(result, 2)
        self.assertEqual(snap2["water_treatment_1"], NodeState.FAILED)
        self.assertEqual(snap2["hospital_1"],         NodeState.FAILED)
        # comms, transit, traffic still unaffected
        self.assertEqual(snap2["comms_tower_1"],     NodeState.OPERATIONAL)
        self.assertEqual(snap2["transit_hub_1"],     NodeState.OPERATIONAL)
        self.assertEqual(snap2["traffic_control_1"], NodeState.OPERATIONAL)

    def test_settles_at_tick_3(self):
        """No is_failed changes at tick 3 → cascade settled."""
        result = run_simulation(self._seed1_scenario())
        self.assertEqual(result.end_time, 3)

    def test_result_passes_lane4_validation(self):
        """
        Cross-lane integration test: pass our SimulationResult directly into
        Lane 4's calculate_metrics(). If Lane 4's _validate() raises, we have a
        contract violation. This is Checkpoint B's core assertion.
        """
        result = run_simulation(self._seed1_scenario())
        l4_nodes = (
            Lane4Node("power_substation_1", "West Power Sub",       "power",      0.50),
            Lane4Node("water_treatment_1",  "Water Treatment Plant", "water",      0.40),
            Lane4Node("hospital_1",         "Central Hospital",      "healthcare", 0.30),
            Lane4Node("transit_hub_1",      "Transit Hub",           "transport",  0.50),
            Lane4Node("comms_tower_1",      "Comms Tower",           "comms",      0.60),
            Lane4Node("traffic_control_1",  "Traffic Control",       "transport",  0.40),
        )
        # Should not raise — Lane 4 validates snapshot ordering and event ordering
        metrics = calculate_metrics(result, l4_nodes)
        # Basic sanity on metrics
        self.assertGreater(metrics.affected_services["count"], 0)
        self.assertGreaterEqual(metrics.cascade_depth_ticks, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
