"""
Lane 2 — Propagation Engine.

Public interface:
    run_simulation(scenario, recovery_actions=None, max_ticks=None) -> SimulationResult
"""
from .engine import run_simulation

__all__ = ["run_simulation"]
