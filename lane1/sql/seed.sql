-- Two hardcoded seed scenarios so Lanes 2/3/4 can build against real
-- data from hour one instead of waiting on Lane 1.
--
-- seed_1: small, simple chain -- good for hand-tracing / Lane 2's
--          Checkpoint A (must match a hand-traced example exactly).
-- seed_2: slightly larger, has a fan-out and a cycle-adjacent shape --
--          good for testing multi-path cascades once seed_1 works.

-- ============================================================
-- seed_1 -- 6 nodes, mostly linear power -> water -> healthcare
--           plus a transport/comms side branch
-- ============================================================

INSERT INTO scenarios (scenario_id, seed) VALUES ('seed_1', 42);

INSERT INTO scenario_nodes
    (scenario_id, node_id, type, current_capacity, is_failed, threshold, active_disruptions)
VALUES
    ('seed_1', 'power_substation_1', 'power',      1.0, FALSE, 0.50, '[]'),
    ('seed_1', 'water_treatment_1',  'water',      1.0, FALSE, 0.40, '[]'),
    ('seed_1', 'hospital_1',         'healthcare', 1.0, FALSE, 0.30, '[]'),
    ('seed_1', 'transit_hub_1',      'transport',  1.0, FALSE, 0.50, '[]'),
    ('seed_1', 'comms_tower_1',      'comms',      1.0, FALSE, 0.60, '[]'),
    ('seed_1', 'traffic_control_1',  'transport',  1.0, FALSE, 0.40, '[]');

-- Directed edges: source is what fails FIRST, target is what depends on it.
INSERT INTO scenario_edges (scenario_id, source_id, target_id, dependency_type, weight)
VALUES
    ('seed_1', 'power_substation_1', 'water_treatment_1', 'power_supply', 0.90),
    ('seed_1', 'water_treatment_1',  'hospital_1',         'water_supply', 0.70),
    ('seed_1', 'power_substation_1', 'hospital_1',         'power_supply', 0.80),
    ('seed_1', 'power_substation_1', 'comms_tower_1',      'power_supply', 0.60),
    ('seed_1', 'comms_tower_1',      'traffic_control_1',  'comms_link',   0.50),
    ('seed_1', 'power_substation_1', 'transit_hub_1',      'power_supply', 0.40);

INSERT INTO scenario_initial_disruptions (scenario_id, node_id)
VALUES ('seed_1', 'power_substation_1');

-- ============================================================
-- seed_2 -- 8 nodes, wider fan-out from a single power failure,
--           two independent branches converging on traffic_control_2
-- ============================================================

INSERT INTO scenarios (scenario_id, seed) VALUES ('seed_2', 7);

INSERT INTO scenario_nodes
    (scenario_id, node_id, type, current_capacity, is_failed, threshold, active_disruptions)
VALUES
    ('seed_2', 'power_substation_2', 'power',      1.0, FALSE, 0.45, '[]'),
    ('seed_2', 'power_substation_3', 'power',      1.0, FALSE, 0.45, '[]'),
    ('seed_2', 'water_treatment_2',  'water',      1.0, FALSE, 0.35, '[]'),
    ('seed_2', 'hospital_2',         'healthcare', 1.0, FALSE, 0.30, '[]'),
    ('seed_2', 'comms_tower_2',      'comms',      1.0, FALSE, 0.55, '[]'),
    ('seed_2', 'transit_hub_2',      'transport',  1.0, FALSE, 0.50, '[]'),
    ('seed_2', 'traffic_control_2',  'transport',  1.0, FALSE, 0.35, '[]'),
    ('seed_2', 'emergency_dispatch_2','healthcare', 1.0, FALSE, 0.40, '[]');

INSERT INTO scenario_edges (scenario_id, source_id, target_id, dependency_type, weight)
VALUES
    ('seed_2', 'power_substation_2', 'water_treatment_2',   'power_supply', 0.85),
    ('seed_2', 'power_substation_2', 'comms_tower_2',        'power_supply', 0.65),
    ('seed_2', 'water_treatment_2',  'hospital_2',            'water_supply', 0.60),
    ('seed_2', 'comms_tower_2',      'transit_hub_2',         'comms_link',   0.55),
    ('seed_2', 'power_substation_3', 'transit_hub_2',         'power_supply', 0.50),
    ('seed_2', 'transit_hub_2',      'traffic_control_2',     'transport_link',0.70),
    ('seed_2', 'hospital_2',         'emergency_dispatch_2',  'staffing',      0.45),
    ('seed_2', 'comms_tower_2',      'emergency_dispatch_2',  'comms_link',    0.40);

INSERT INTO scenario_initial_disruptions (scenario_id, node_id)
VALUES ('seed_2', 'power_substation_2'), ('seed_2', 'power_substation_3');