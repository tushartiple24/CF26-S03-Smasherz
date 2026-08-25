/**
 * Cascade City - Exact Data Contract & Application Types
 */

export type NodeState = 'operational' | 'degraded' | 'failed';

export type ServiceType = 
  | 'power' 
  | 'water' 
  | 'healthcare' 
  | 'transport' 
  | 'communications' 
  | string;

export interface ScenarioNode {
  id: string;
  name: string;
  service_type: ServiceType;
  failure_threshold: number;
}

export interface ScenarioEdge {
  upstream_id: string;
  dependent_id: string;
  weight: number;
}

export interface ScenarioDef {
  id: string;
  name: string;
  description: string;
  graph_id: string;
  nodes: ScenarioNode[];
  edges: ScenarioEdge[];
  initial_disruptions: string[];
}

export interface Snapshot {
  time: number;
  node_states: Record<string, NodeState>;
}

export interface SimulationEvent {
  time: number;
  node_id: string;
  previous_state: NodeState;
  next_state: NodeState;
  cause: string;
  source_node_id?: string | null;
}

export interface SimulationResult {
  scenario_id: string;
  seed: number;
  start_time: number;
  end_time: number;
  snapshots: Snapshot[];
  events: SimulationEvent[];
}

export interface AffectedServiceItem {
  id: string;
  name: string;
}

export interface ServiceTypeImpact {
  service_type: ServiceType;
  count: number;
  services: AffectedServiceItem[];
}

export interface ScenarioMetrics {
  scenario_id: string;
  seed: number;
  headline: {
    cascade_depth_ticks: number;
    affected_services: number;
    recovery_time_ticks: number | null;
    recovery_status: string;
    peak_impact: number;
  };
  cascade_depth_ticks: number;
  dependency_hop_depth: number;
  affected_services: {
    count: number;
    node_ids: string[];
    by_service_type: ServiceTypeImpact[];
  };
  recovery_time: {
    duration_ticks: number | null;
    recovered_at: number | null;
    status: string;
  };
  peak_impact: {
    count: number;
    time: number;
  };
  timeline: {
    initiating_events: SimulationEvent[];
    spread_events: SimulationEvent[];
    recovery_events: SimulationEvent[];
    final_system_condition: Record<string, NodeState>;
  };
}

export interface ScenarioRun {
  scenario: ScenarioDef;
  result: SimulationResult;
  metrics: ScenarioMetrics;
}

export interface DistrictLayoutInfo {
  center: [number, number]; // x, z in 3D world
  label: string;
  color: string;
  iconName: string;
}
