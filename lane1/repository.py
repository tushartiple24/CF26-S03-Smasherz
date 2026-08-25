"""
Lane 1 public interface.

These two functions are the ONLY things Lanes 2/3/4 should ever import
from this module:

    load_scenario(scenario_id: str) -> Scenario
    save_run(run_log: RunLog) -> None

Everything else in this file is internal plumbing.
"""

import json
from psycopg2.extras import Json

from db import get_cursor
from models import Node, Edge, TickState, RecoveryAction, Scenario, RunLog


# ---------------------------------------------------------------------
# load_scenario — Postgres -> Scenario (called once, at t=0)
# ---------------------------------------------------------------------

def load_scenario(scenario_id: str) -> Scenario:
    with get_cursor() as cur:
        cur.execute(
            "SELECT scenario_id, seed FROM scenarios WHERE scenario_id = %s",
            (scenario_id,),
        )
        row = cur.fetchone()
        if row is None:
            raise ValueError(f"No scenario found with id={scenario_id!r}")

        cur.execute(
            """
            SELECT node_id, type, current_capacity, is_failed, threshold,
                   active_disruptions
            FROM scenario_nodes
            WHERE scenario_id = %s
            """,
            (scenario_id,),
        )
        nodes = [
            Node(
                node_id=r["node_id"],
                type=r["type"],
                current_capacity=r["current_capacity"],
                is_failed=r["is_failed"],
                threshold=r["threshold"],
                active_disruptions=list(r["active_disruptions"]),
            )
            for r in cur.fetchall()
        ]

        cur.execute(
            """
            SELECT source_id, target_id, dependency_type, weight
            FROM scenario_edges
            WHERE scenario_id = %s
            """,
            (scenario_id,),
        )
        edges = [
            Edge(
                source_id=r["source_id"],
                target_id=r["target_id"],
                dependency_type=r["dependency_type"],
                weight=r["weight"],
            )
            for r in cur.fetchall()
        ]

        cur.execute(
            """
            SELECT node_id FROM scenario_initial_disruptions
            WHERE scenario_id = %s
            """,
            (scenario_id,),
        )
        initial_disruptions = [r["node_id"] for r in cur.fetchall()]

    return Scenario(
        scenario_id=row["scenario_id"],
        seed=row["seed"],
        nodes=nodes,
        edges=edges,
        initial_disruptions=initial_disruptions,
    )


# ---------------------------------------------------------------------
# save_run — RunLog -> Postgres (called once, at settlement / demo stop)
# ---------------------------------------------------------------------

def _node_to_jsonable(node: Node) -> dict:
    return {
        "node_id": node.node_id,
        "type": node.type,
        "current_capacity": node.current_capacity,
        "is_failed": node.is_failed,
        "threshold": node.threshold,
        "active_disruptions": node.active_disruptions,
    }


def save_run(run_log: RunLog) -> None:
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO runs (run_id, scenario_id, metrics)
            VALUES (%s, %s, %s)
            ON CONFLICT (run_id) DO UPDATE
                SET metrics = EXCLUDED.metrics
            """,
            (run_log.run_id, run_log.scenario_id, Json(run_log.metrics)),
        )

        tick_rows = [
            (
                run_log.run_id,
                tick_state.tick,
                Json({nid: _node_to_jsonable(n) for nid, n in tick_state.nodes.items()}),
            )
            for tick_state in run_log.ticks
        ]
        if tick_rows:
            cur.executemany(
                """
                INSERT INTO run_ticks (run_id, tick, nodes)
                VALUES (%s, %s, %s)
                ON CONFLICT (run_id, tick) DO UPDATE
                    SET nodes = EXCLUDED.nodes
                """,
                tick_rows,
            )

        if run_log.recovery_actions:
            cur.executemany(
                """
                INSERT INTO recovery_actions
                    (run_id, node_id, tick_triggered, tick_effective, restored_capacity)
                VALUES (%s, %s, %s, %s, %s)
                """,
                [
                    (
                        run_log.run_id,
                        ra.node_id,
                        ra.tick_triggered,
                        ra.tick_effective,
                        ra.restored_capacity,
                    )
                    for ra in run_log.recovery_actions
                ],
            )


# ---------------------------------------------------------------------
# load_run — bonus helper (not in the frozen contract, but needed for
# Checkpoint C's "round-trip" verification: save, reload, compare)
# ---------------------------------------------------------------------

def load_run(run_id: str) -> RunLog:
    with get_cursor() as cur:
        cur.execute(
            "SELECT run_id, scenario_id, metrics FROM runs WHERE run_id = %s",
            (run_id,),
        )
        row = cur.fetchone()
        if row is None:
            raise ValueError(f"No run found with id={run_id!r}")

        cur.execute(
            "SELECT tick, nodes FROM run_ticks WHERE run_id = %s ORDER BY tick",
            (run_id,),
        )
        ticks = [
            TickState(
                tick=r["tick"],
                nodes={
                    nid: Node(
                        node_id=n["node_id"],
                        type=n["type"],
                        current_capacity=n["current_capacity"],
                        is_failed=n["is_failed"],
                        threshold=n["threshold"],
                        active_disruptions=n["active_disruptions"],
                    )
                    for nid, n in r["nodes"].items()
                },
            )
            for r in cur.fetchall()
        ]

        cur.execute(
            """
            SELECT node_id, tick_triggered, tick_effective, restored_capacity
            FROM recovery_actions WHERE run_id = %s
            ORDER BY tick_triggered
            """,
            (run_id,),
        )
        recovery_actions = [
            RecoveryAction(
                node_id=r["node_id"],
                tick_triggered=r["tick_triggered"],
                tick_effective=r["tick_effective"],
                restored_capacity=r["restored_capacity"],
            )
            for r in cur.fetchall()
        ]

    return RunLog(
        scenario_id=row["scenario_id"],
        run_id=row["run_id"],
        ticks=ticks,
        recovery_actions=recovery_actions,
        metrics=row["metrics"],
    )