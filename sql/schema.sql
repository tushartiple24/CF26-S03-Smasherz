-- S-03 Urban Infrastructure Cascade Simulator
-- Postgres schema — maps 1:1 onto the dataclasses in models.py / the
-- frozen contract in S-03_Task_Division.md Part 1.
--
-- Two families of tables:
--   scenario_*  -> what gets LOADED at simulation start (Scenario)
--   run_*       -> what gets SAVED at simulation end (RunLog)
-- Nothing here is touched mid-tick. Lane 2 never talks to Postgres.

DROP TABLE IF EXISTS recovery_actions CASCADE;
DROP TABLE IF EXISTS run_ticks CASCADE;
DROP TABLE IF EXISTS runs CASCADE;
DROP TABLE IF EXISTS scenario_initial_disruptions CASCADE;
DROP TABLE IF EXISTS scenario_edges CASCADE;
DROP TABLE IF EXISTS scenario_nodes CASCADE;
DROP TABLE IF EXISTS scenarios CASCADE;

-- ---------------------------------------------------------------------
-- SCENARIO SIDE (loaded once at t=0)
-- ---------------------------------------------------------------------

CREATE TABLE scenarios (
    scenario_id   TEXT PRIMARY KEY,
    seed          INTEGER NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Initial state of every node in this scenario, i.e. the Node objects
-- as they exist at tick 0, before propagation runs.
CREATE TABLE scenario_nodes (
    scenario_id         TEXT NOT NULL REFERENCES scenarios(scenario_id) ON DELETE CASCADE,
    node_id             TEXT NOT NULL,
    type                TEXT NOT NULL CHECK (type IN ('power','water','healthcare','transport','comms')),
    current_capacity    DOUBLE PRECISION NOT NULL CHECK (current_capacity BETWEEN 0 AND 1),
    is_failed           BOOLEAN NOT NULL DEFAULT FALSE,
    threshold           DOUBLE PRECISION NOT NULL CHECK (threshold BETWEEN 0 AND 1),
    active_disruptions  JSONB NOT NULL DEFAULT '[]'::jsonb,
    PRIMARY KEY (scenario_id, node_id)
);

CREATE TABLE scenario_edges (
    scenario_id      TEXT NOT NULL REFERENCES scenarios(scenario_id) ON DELETE CASCADE,
    source_id        TEXT NOT NULL,
    target_id        TEXT NOT NULL,
    dependency_type  TEXT NOT NULL,
    weight           DOUBLE PRECISION NOT NULL CHECK (weight BETWEEN 0 AND 1),
    PRIMARY KEY (scenario_id, source_id, target_id, dependency_type)
);

CREATE TABLE scenario_initial_disruptions (
    scenario_id  TEXT NOT NULL REFERENCES scenarios(scenario_id) ON DELETE CASCADE,
    node_id      TEXT NOT NULL,
    PRIMARY KEY (scenario_id, node_id)
);

-- ---------------------------------------------------------------------
-- RUN SIDE (written once at settlement / demo stop)
-- ---------------------------------------------------------------------

CREATE TABLE runs (
    run_id        TEXT PRIMARY KEY,
    scenario_id   TEXT NOT NULL REFERENCES scenarios(scenario_id),
    metrics       JSONB NOT NULL DEFAULT '{}'::jsonb,   -- Lane 4's compute_metrics() output
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Full tick-by-tick history. Each row is one TickState — the whole
-- node dict for that tick is stored as JSONB rather than one row per
-- node per tick, since it's write-once (at the end) and read-whole
-- (for replay), not queried node-by-node.
CREATE TABLE run_ticks (
    run_id   TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
    tick     INTEGER NOT NULL,
    nodes    JSONB NOT NULL,   -- {node_id: {type, current_capacity, is_failed, threshold, active_disruptions}}
    PRIMARY KEY (run_id, tick)
);

CREATE TABLE recovery_actions (
    run_id             TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
    node_id            TEXT NOT NULL,
    tick_triggered     INTEGER NOT NULL,
    tick_effective     INTEGER NOT NULL,
    restored_capacity  DOUBLE PRECISION NOT NULL CHECK (restored_capacity BETWEEN 0 AND 1)
);

CREATE INDEX idx_run_ticks_run_id ON run_ticks(run_id);
CREATE INDEX idx_recovery_actions_run_id ON recovery_actions(run_id);