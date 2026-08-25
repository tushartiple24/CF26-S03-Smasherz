import { ScenarioRun, NodeState, SimulationEvent, ScenarioNode } from '../types';
import { SAMPLE_SCENARIOS } from './sampleScenarios';

/**
 * Validate an unknown object against the ScenarioRun contract
 */
export function validateScenarioRun(data: unknown): { valid: boolean; error?: string; data?: ScenarioRun } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Input must be a valid JSON object.' };
  }

  const obj = data as Record<string, unknown>;

  if (!obj.scenario || typeof obj.scenario !== 'object') {
    return { valid: false, error: 'Missing or invalid "scenario" section.' };
  }
  if (!obj.result || typeof obj.result !== 'object') {
    return { valid: false, error: 'Missing or invalid "result" section.' };
  }
  if (!obj.metrics || typeof obj.metrics !== 'object') {
    return { valid: false, error: 'Missing or invalid "metrics" section.' };
  }

  const scenario = obj.scenario as Record<string, unknown>;
  const result = obj.result as Record<string, unknown>;
  const metrics = obj.metrics as Record<string, unknown>;

  if (typeof scenario.id !== 'string' || !scenario.id) {
    return { valid: false, error: 'scenario.id must be a non-empty string.' };
  }
  if (typeof scenario.name !== 'string') {
    return { valid: false, error: 'scenario.name must be a string.' };
  }
  if (!Array.isArray(scenario.nodes) || scenario.nodes.length === 0) {
    return { valid: false, error: 'scenario.nodes must be a non-empty array.' };
  }
  if (!Array.isArray(scenario.edges)) {
    return { valid: false, error: 'scenario.edges must be an array.' };
  }

  if (!Array.isArray(result.snapshots) || result.snapshots.length === 0) {
    return { valid: false, error: 'result.snapshots must be a non-empty array.' };
  }
  if (!Array.isArray(result.events)) {
    return { valid: false, error: 'result.events must be an array.' };
  }

  // Validate node_states values strictly
  for (const snapshot of result.snapshots as Array<Record<string, unknown>>) {
    if (typeof snapshot.time !== 'number' || !snapshot.node_states || typeof snapshot.node_states !== 'object') {
      return { valid: false, error: 'Each snapshot must have a numeric "time" and "node_states" map.' };
    }
    const nodeStates = snapshot.node_states as Record<string, unknown>;
    for (const [nodeId, state] of Object.entries(nodeStates)) {
      if (state !== 'operational' && state !== 'degraded' && state !== 'failed') {
        return {
          valid: false,
          error: `Invalid node_state "${state}" for node "${nodeId}" at tick ${snapshot.time}. Must be "operational", "degraded", or "failed".`,
        };
      }
    }
  }

  return { valid: true, data: data as ScenarioRun };
}

/**
 * Get current state of a node at a given tick
 */
export function getCurrentNodeState(run: ScenarioRun, nodeId: string, currentTick: number): NodeState {
  const snapshot = run.result.snapshots.find(s => s.time === currentTick);
  if (snapshot && snapshot.node_states[nodeId]) {
    return snapshot.node_states[nodeId];
  }
  // Fallback to nearest preceding snapshot
  const precedingSnapshots = run.result.snapshots
    .filter(s => s.time <= currentTick)
    .sort((a, b) => b.time - a.time);
  if (precedingSnapshots.length > 0 && precedingSnapshots[0].node_states[nodeId]) {
    return precedingSnapshots[0].node_states[nodeId];
  }
  return 'operational';
}

/**
 * Get all events for a node up to current tick, sorted most recent first
 */
export function getNodeEventsUpToTick(run: ScenarioRun, nodeId: string, currentTick: number): SimulationEvent[] {
  return run.result.events
    .filter(e => e.node_id === nodeId && e.time <= currentTick)
    .sort((a, b) => b.time - a.time);
}

/**
 * Trace root cause back through source_node_id chains up to the initial disruption
 */
export interface CauseChainStep {
  nodeId: string;
  name: string;
  serviceType: string;
  state: NodeState;
  cause: string;
  time: number;
  isInitialDisruption: boolean;
}

export function getRootCauseChain(run: ScenarioRun, nodeId: string, currentTick: number): {
  steps: CauseChainStep[];
  isRootDisruption: boolean;
  initialRootId: string | null;
} {
  const nodeMap = new Map<string, ScenarioNode>(run.scenario.nodes.map(n => [n.id, n]));
  const isInitial = run.scenario.initial_disruptions.includes(nodeId);

  const steps: CauseChainStep[] = [];
  const visited = new Set<string>();

  let currId: string | null = nodeId;

  while (currId && !visited.has(currId)) {
    visited.add(currId);
    const nodeObj = nodeMap.get(currId);
    const nodeEvents = getNodeEventsUpToTick(run, currId, currentTick);
    const latestEvent = nodeEvents[0];
    const currState = getCurrentNodeState(run, currId, currentTick);
    const isRoot = run.scenario.initial_disruptions.includes(currId);

    steps.push({
      nodeId: currId,
      name: nodeObj ? nodeObj.name : currId,
      serviceType: nodeObj ? nodeObj.service_type : 'unknown',
      state: currState,
      cause: latestEvent ? latestEvent.cause : isRoot ? 'Initial Disruption Origin' : 'Operational / Nominal',
      time: latestEvent ? latestEvent.time : 0,
      isInitialDisruption: isRoot,
    });

    if (isRoot || !latestEvent || !latestEvent.source_node_id) {
      break;
    }

    currId = latestEvent.source_node_id;
  }

  const initialRoot = steps.length > 0 && steps[steps.length - 1].isInitialDisruption
    ? steps[steps.length - 1].nodeId
    : null;

  return {
    steps,
    isRootDisruption: isInitial,
    initialRootId: initialRoot,
  };
}

/**
 * Find alternative/redundant supply paths from scenario.edges for other upstream_ids feeding the dependent_id
 */
export interface AlternativeSupplyPath {
  upstreamId: string;
  upstreamName: string;
  serviceType: string;
  weight: number;
  currentState: NodeState;
}

export function getAlternativeSupplyPaths(
  run: ScenarioRun,
  dependentNodeId: string,
  currentTick: number
): AlternativeSupplyPath[] {
  const nodeMap = new Map<string, ScenarioNode>(run.scenario.nodes.map(n => [n.id, n]));
  
  // Find all edges feeding into this dependent_id
  const incomingEdges = run.scenario.edges.filter(e => e.dependent_id === dependentNodeId);

  return incomingEdges.map(edge => {
    const upstreamNode = nodeMap.get(edge.upstream_id);
    const state = getCurrentNodeState(run, edge.upstream_id, currentTick);
    return {
      upstreamId: edge.upstream_id,
      upstreamName: upstreamNode ? upstreamNode.name : edge.upstream_id,
      serviceType: upstreamNode ? upstreamNode.service_type : 'power',
      weight: edge.weight,
      currentState: state,
    };
  });
}

/**
 * Get aggregate breakdown count for active snapshot
 */
export function getSystemConditionCounts(run: ScenarioRun, currentTick: number): {
  operational: number;
  degraded: number;
  failed: number;
  total: number;
} {
  let operational = 0;
  let degraded = 0;
  let failed = 0;

  for (const node of run.scenario.nodes) {
    const state = getCurrentNodeState(run, node.id, currentTick);
    if (state === 'operational') operational++;
    else if (state === 'degraded') degraded++;
    else if (state === 'failed') failed++;
  }

  return {
    operational,
    degraded,
    failed,
    total: run.scenario.nodes.length,
  };
}

export { SAMPLE_SCENARIOS };
