"""Versioned, deterministic scenario presets for the hackathon demo."""
from .contracts import DependencyEdge, Disruption, Node, RecoveryAction, Scenario, SimulationSettings

GRAPH_ID = "central-city-services-v1"
NODES = (
    Node("power-west", "West Power Substation", "power", 0.70),
    Node("water-plant", "Water Treatment Plant", "water", 0.50),
    Node("hospital", "Central Hospital", "healthcare", 0.55),
    Node("traffic-control", "Traffic Control Centre", "transport", 0.60),
    Node("emergency-comms", "Emergency Communications", "communications", 0.65),
)
EDGES = (
    DependencyEdge("power-west", "water-plant", 0.80), DependencyEdge("power-west", "hospital", 0.60),
    DependencyEdge("power-west", "traffic-control", 0.65), DependencyEdge("water-plant", "hospital", 0.50),
    DependencyEdge("traffic-control", "emergency-comms", 0.60), DependencyEdge("hospital", "emergency-comms", 0.55),
)
SCENARIOS = (
    Scenario("contained-substation-failure", 1, "Contained power failure", "A local outage is restored before secondary failures.", GRAPH_ID, NODES, EDGES, (Disruption(0, "power-west", "failure"),), (RecoveryAction(1, "power-west", "restore_power"),), SimulationSettings(1001, 8)),
    Scenario("cross-service-cascade", 1, "Cross-service cascade", "Power failure propagates through water and healthcare.", GRAPH_ID, NODES, EDGES, (Disruption(0, "power-west", "failure"),), (RecoveryAction(6, "power-west", "restore_power"),), SimulationSettings(2002, 12)),
    Scenario("converging-disruptions", 1, "Converging disruptions", "Power and water disruptions jointly pressure the hospital.", GRAPH_ID, NODES, EDGES, (Disruption(0, "power-west", "failure"), Disruption(0, "water-plant", "contamination")), (RecoveryAction(7, "power-west", "restore_power"),), SimulationSettings(3003, 12)),
    Scenario("targeted-recovery", 1, "Targeted recovery intervention", "Backup power protects the hospital before communications are hit.", GRAPH_ID, NODES, EDGES, (Disruption(0, "power-west", "failure"),), (RecoveryAction(2, "hospital", "activate_backup_power"), RecoveryAction(5, "power-west", "restore_power")), SimulationSettings(4004, 10)),
)

def get_scenario(scenario_id: str) -> Scenario:
    for scenario in SCENARIOS:
        if scenario.id == scenario_id:
            return scenario
    raise KeyError(f"Unknown scenario: {scenario_id}")

def list_scenarios() -> tuple[Scenario, ...]:
    return SCENARIOS
