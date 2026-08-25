import unittest
from lane4.contracts import Node, NodeState, SimulationResult, StateChangeEvent, TickSnapshot
from lane4.metrics import calculate_metrics
from lane4.scenarios import get_scenario, list_scenarios

NODES = (Node("power", "Power", "power", .7), Node("water", "Water", "water", .5), Node("hospital", "Hospital", "healthcare", .5))

class MetricsTests(unittest.TestCase):
    def test_hand_traced_multi_hop_cascade(self):
        result = SimulationResult("hand", 7, 0, 7, (
            TickSnapshot(0, {"power": NodeState.FAILED, "water": NodeState.OPERATIONAL, "hospital": NodeState.OPERATIONAL}),
            TickSnapshot(1, {"power": NodeState.FAILED, "water": NodeState.DEGRADED, "hospital": NodeState.OPERATIONAL}),
            TickSnapshot(2, {"power": NodeState.FAILED, "water": NodeState.DEGRADED, "hospital": NodeState.FAILED}),
            TickSnapshot(7, {"power": NodeState.OPERATIONAL, "water": NodeState.OPERATIONAL, "hospital": NodeState.OPERATIONAL}),
        ), (
            StateChangeEvent(0, "power", NodeState.OPERATIONAL, NodeState.FAILED, "initial_disruption"),
            StateChangeEvent(1, "water", NodeState.OPERATIONAL, NodeState.DEGRADED, "threshold_exceeded", "power"),
            StateChangeEvent(2, "hospital", NodeState.OPERATIONAL, NodeState.FAILED, "threshold_exceeded", "water"),
            StateChangeEvent(7, "power", NodeState.FAILED, NodeState.OPERATIONAL, "recovery_action"),
            StateChangeEvent(7, "water", NodeState.DEGRADED, NodeState.OPERATIONAL, "automatic_recovery"),
            StateChangeEvent(7, "hospital", NodeState.FAILED, NodeState.OPERATIONAL, "automatic_recovery"),
        ))
        metrics = calculate_metrics(result, NODES)
        self.assertEqual(metrics.cascade_depth_ticks, 2)
        self.assertEqual(metrics.dependency_hop_depth, 2)
        self.assertEqual(metrics.affected_services["count"], 3)
        self.assertEqual(metrics.peak_impact, {"count": 3, "time": 2})
        self.assertEqual(metrics.recovery_time["duration_ticks"], 7)

    def test_simultaneous_disruptions_are_counted_once_each(self):
        result = SimulationResult("simultaneous", 1, 0, 1, (
            TickSnapshot(0, {"power": NodeState.FAILED, "water": NodeState.FAILED, "hospital": NodeState.OPERATIONAL}),
            TickSnapshot(1, {"power": NodeState.FAILED, "water": NodeState.FAILED, "hospital": NodeState.DEGRADED}),
        ), (
            StateChangeEvent(0, "power", NodeState.OPERATIONAL, NodeState.FAILED, "initial_disruption"),
            StateChangeEvent(0, "water", NodeState.OPERATIONAL, NodeState.FAILED, "initial_disruption"),
            StateChangeEvent(1, "hospital", NodeState.OPERATIONAL, NodeState.DEGRADED, "threshold_exceeded", "water"),
        ))
        metrics = calculate_metrics(result, NODES)
        self.assertEqual(metrics.affected_services["count"], 3)
        self.assertEqual(metrics.peak_impact, {"count": 3, "time": 1})

    def test_unrecovered_result(self):
        result = SimulationResult("unrecovered", 1, 0, 2, (TickSnapshot(0, {"power": NodeState.FAILED}), TickSnapshot(2, {"power": NodeState.FAILED})), (StateChangeEvent(0, "power", NodeState.OPERATIONAL, NodeState.FAILED, "initial_disruption"),))
        self.assertEqual(calculate_metrics(result, NODES).recovery_time["status"], "not_recovered")

    def test_scenarios_are_versioned_and_fixed_seed(self):
        self.assertEqual(len(list_scenarios()), 4)
        self.assertEqual(get_scenario("cross-service-cascade").settings.seed, 2002)

if __name__ == "__main__":
    unittest.main()
