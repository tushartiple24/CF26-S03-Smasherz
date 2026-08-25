import { ScenarioDef, ScenarioMetrics, ScenarioRun, SimulationResult } from '../types';

function buildGeneratedMetrics(scenario: ScenarioDef, result: SimulationResult): ScenarioMetrics {
  const affectedNodeIds = [...new Set(result.events.map((event) => event.node_id))];
  const affectedServices = scenario.nodes.filter((node) => affectedNodeIds.includes(node.id));
  const byServiceType = [...new Set(affectedServices.map((node) => node.service_type))].map((serviceType) => {
    const services = affectedServices.filter((node) => node.service_type === serviceType);
    return {
      service_type: serviceType,
      count: services.length,
      services: services.map((node) => ({ id: node.id, name: node.name })),
    };
  });
  const recoveryEvents = result.events.filter((event) => event.next_state === 'operational');
  const finalCondition = result.snapshots[result.snapshots.length - 1]?.node_states ?? {};
  const fullyRecovered = affectedNodeIds.every((nodeId) => finalCondition[nodeId] === 'operational');
  const recoveryTick = recoveryEvents.length > 0 ? Math.max(...recoveryEvents.map((event) => event.time)) : null;
  const peakSnapshot = result.snapshots.reduce((peak, snapshot) => {
    const failedCount = Object.values(snapshot.node_states).filter((state) => state !== 'operational').length;
    return failedCount > peak.count ? { count: failedCount, time: snapshot.time } : peak;
  }, { count: 0, time: 0 });

  return {
    scenario_id: scenario.id,
    seed: result.seed,
    headline: {
      cascade_depth_ticks: result.events.length ? Math.max(...result.events.map((event) => event.time)) : 0,
      affected_services: affectedNodeIds.length,
      recovery_time_ticks: fullyRecovered ? recoveryTick : null,
      recovery_status: fullyRecovered ? 'fully_recovered' : recoveryEvents.length ? 'partial_recovery' : 'not_recovered',
      peak_impact: peakSnapshot.count,
    },
    cascade_depth_ticks: result.events.length ? Math.max(...result.events.map((event) => event.time)) : 0,
    dependency_hop_depth: 0,
    affected_services: { count: affectedNodeIds.length, node_ids: affectedNodeIds, by_service_type: byServiceType },
    recovery_time: {
      duration_ticks: fullyRecovered ? recoveryTick : null,
      recovered_at: fullyRecovered ? recoveryTick : null,
      status: fullyRecovered ? 'fully_recovered' : recoveryEvents.length ? 'partial_recovery' : 'not_recovered',
    },
    peak_impact: peakSnapshot,
    timeline: {
      initiating_events: result.events.filter((event) => event.time === 0),
      spread_events: result.events.filter((event) => event.time > 0 && event.next_state !== 'operational'),
      recovery_events: recoveryEvents,
      final_system_condition: finalCondition,
    },
  };
}

const SAMPLE_SCENARIOS_WITHOUT_GENERATED_METRICS = {
  'cross-service-cascade': {
    scenario: {
      id: 'cross-service-cascade',
      name: 'Cross-service cascade',
      description: 'Power failure propagates through water treatment and into central healthcare and transit grids.',
      graph_id: 'central-city-services-v1',
      nodes: [
        { id: 'power-west', name: 'West Power Substation', service_type: 'power', failure_threshold: 0.7 },
        { id: 'power-grid-core', name: 'Central Grid Transformer', service_type: 'power', failure_threshold: 0.75 },
        { id: 'water-plant', name: 'West River Water Plant', service_type: 'water', failure_threshold: 0.65 },
        { id: 'water-pump-main', name: 'Metro Water Booster Station', service_type: 'water', failure_threshold: 0.6 },
        { id: 'hospital-central', name: 'St. Jude General Hospital', service_type: 'healthcare', failure_threshold: 0.5 },
        { id: 'trauma-center', name: 'North Trauma & Surgery Hub', service_type: 'healthcare', failure_threshold: 0.55 },
        { id: 'metro-dispatch', name: 'Central Transit Control', service_type: 'transport', failure_threshold: 0.6 },
        { id: 'comm-tower-1', name: 'West Telecom Tower', service_type: 'communications', failure_threshold: 0.7 },
      ],
      edges: [
        { upstream_id: 'power-west', dependent_id: 'water-plant', weight: 0.85 },
        { upstream_id: 'power-west', dependent_id: 'comm-tower-1', weight: 0.75 },
        { upstream_id: 'power-grid-core', dependent_id: 'water-pump-main', weight: 0.7 },
        { upstream_id: 'water-plant', dependent_id: 'water-pump-main', weight: 0.9 },
        { upstream_id: 'water-pump-main', dependent_id: 'hospital-central', weight: 0.8 },
        { upstream_id: 'power-west', dependent_id: 'hospital-central', weight: 0.65 },
        { upstream_id: 'hospital-central', dependent_id: 'trauma-center', weight: 0.7 },
        { upstream_id: 'comm-tower-1', dependent_id: 'metro-dispatch', weight: 0.8 },
      ],
      initial_disruptions: ['power-west'],
    },
    result: {
      scenario_id: 'cross-service-cascade',
      seed: 2002,
      start_time: 0,
      end_time: 6,
      snapshots: [
        {
          time: 0,
          node_states: {
            'power-west': 'failed',
            'power-grid-core': 'operational',
            'water-plant': 'operational',
            'water-pump-main': 'operational',
            'hospital-central': 'operational',
            'trauma-center': 'operational',
            'metro-dispatch': 'operational',
            'comm-tower-1': 'operational',
          },
        },
        {
          time: 1,
          node_states: {
            'power-west': 'failed',
            'power-grid-core': 'operational',
            'water-plant': 'degraded',
            'water-pump-main': 'operational',
            'hospital-central': 'operational',
            'trauma-center': 'operational',
            'metro-dispatch': 'operational',
            'comm-tower-1': 'degraded',
          },
        },
        {
          time: 2,
          node_states: {
            'power-west': 'failed',
            'power-grid-core': 'operational',
            'water-plant': 'failed',
            'water-pump-main': 'degraded',
            'hospital-central': 'degraded',
            'trauma-center': 'operational',
            'metro-dispatch': 'degraded',
            'comm-tower-1': 'failed',
          },
        },
        {
          time: 3,
          node_states: {
            'power-west': 'failed',
            'power-grid-core': 'operational',
            'water-plant': 'failed',
            'water-pump-main': 'failed',
            'hospital-central': 'failed',
            'trauma-center': 'degraded',
            'metro-dispatch': 'failed',
            'comm-tower-1': 'failed',
          },
        },
        {
          time: 4,
          node_states: {
            'power-west': 'failed',
            'power-grid-core': 'operational',
            'water-plant': 'failed',
            'water-pump-main': 'failed',
            'hospital-central': 'failed',
            'trauma-center': 'failed',
            'metro-dispatch': 'failed',
            'comm-tower-1': 'failed',
          },
        },
        {
          time: 5,
          node_states: {
            'power-west': 'failed',
            'power-grid-core': 'operational',
            'water-plant': 'failed',
            'water-pump-main': 'failed',
            'hospital-central': 'failed',
            'trauma-center': 'failed',
            'metro-dispatch': 'failed',
            'comm-tower-1': 'failed',
          },
        },
        {
          time: 6,
          node_states: {
            'power-west': 'failed',
            'power-grid-core': 'operational',
            'water-plant': 'failed',
            'water-pump-main': 'failed',
            'hospital-central': 'failed',
            'trauma-center': 'failed',
            'metro-dispatch': 'failed',
            'comm-tower-1': 'failed',
          },
        },
      ],
      events: [
        {
          time: 0,
          node_id: 'power-west',
          previous_state: 'operational',
          next_state: 'failed',
          cause: 'initial_shock_transformer_trip',
          source_node_id: null,
        },
        {
          time: 1,
          node_id: 'water-plant',
          previous_state: 'operational',
          next_state: 'degraded',
          cause: 'threshold_exceeded',
          source_node_id: 'power-west',
        },
        {
          time: 1,
          node_id: 'comm-tower-1',
          previous_state: 'operational',
          next_state: 'degraded',
          cause: 'upstream_voltage_sag',
          source_node_id: 'power-west',
        },
        {
          time: 2,
          node_id: 'water-plant',
          previous_state: 'degraded',
          next_state: 'failed',
          cause: 'auxiliary_generator_depletion',
          source_node_id: 'power-west',
        },
        {
          time: 2,
          node_id: 'water-pump-main',
          previous_state: 'operational',
          next_state: 'degraded',
          cause: 'supply_pressure_loss',
          source_node_id: 'water-plant',
        },
        {
          time: 2,
          node_id: 'hospital-central',
          previous_state: 'operational',
          next_state: 'degraded',
          cause: 'dual_feed_degradation',
          source_node_id: 'power-west',
        },
        {
          time: 2,
          node_id: 'comm-tower-1',
          previous_state: 'degraded',
          next_state: 'failed',
          cause: 'battery_bank_exhaustion',
          source_node_id: 'power-west',
        },
        {
          time: 2,
          node_id: 'metro-dispatch',
          previous_state: 'operational',
          next_state: 'degraded',
          cause: 'telecom_link_loss',
          source_node_id: 'comm-tower-1',
        },
        {
          time: 3,
          node_id: 'water-pump-main',
          previous_state: 'degraded',
          next_state: 'failed',
          cause: 'cavitation_lockout',
          source_node_id: 'water-plant',
        },
        {
          time: 3,
          node_id: 'hospital-central',
          previous_state: 'degraded',
          next_state: 'failed',
          cause: 'sterilization_steam_cooling_failure',
          source_node_id: 'water-pump-main',
        },
        {
          time: 3,
          node_id: 'trauma-center',
          previous_state: 'operational',
          next_state: 'degraded',
          cause: 'patient_diversion_overload',
          source_node_id: 'hospital-central',
        },
        {
          time: 3,
          node_id: 'metro-dispatch',
          previous_state: 'degraded',
          next_state: 'failed',
          cause: 'automated_safety_interlock_trip',
          source_node_id: 'comm-tower-1',
        },
        {
          time: 4,
          node_id: 'trauma-center',
          previous_state: 'degraded',
          next_state: 'failed',
          cause: 'surgical_suite_hvac_shutdown',
          source_node_id: 'hospital-central',
        },
      ],
    },
    metrics: {
      scenario_id: 'cross-service-cascade',
      seed: 2002,
      headline: {
        cascade_depth_ticks: 4,
        affected_services: 7,
        recovery_time_ticks: null,
        recovery_status: 'not_recovered',
        peak_impact: 7,
      },
      cascade_depth_ticks: 4,
      dependency_hop_depth: 3,
      affected_services: {
        count: 7,
        node_ids: [
          'power-west',
          'water-plant',
          'water-pump-main',
          'hospital-central',
          'trauma-center',
          'metro-dispatch',
          'comm-tower-1',
        ],
        by_service_type: [
          {
            service_type: 'power',
            count: 1,
            services: [{ id: 'power-west', name: 'West Power Substation' }],
          },
          {
            service_type: 'water',
            count: 2,
            services: [
              { id: 'water-plant', name: 'West River Water Plant' },
              { id: 'water-pump-main', name: 'Metro Water Booster Station' },
            ],
          },
          {
            service_type: 'healthcare',
            count: 2,
            services: [
              { id: 'hospital-central', name: 'St. Jude General Hospital' },
              { id: 'trauma-center', name: 'North Trauma & Surgery Hub' },
            ],
          },
          {
            service_type: 'transport',
            count: 1,
            services: [{ id: 'metro-dispatch', name: 'Central Transit Control' }],
          },
          {
            service_type: 'communications',
            count: 1,
            services: [{ id: 'comm-tower-1', name: 'West Telecom Tower' }],
          },
        ],
      },
      recovery_time: {
        duration_ticks: null,
        recovered_at: null,
        status: 'not_recovered',
      },
      peak_impact: {
        count: 7,
        time: 4,
      },
      timeline: {
        initiating_events: [
          {
            time: 0,
            node_id: 'power-west',
            previous_state: 'operational',
            next_state: 'failed',
            cause: 'initial_shock_transformer_trip',
            source_node_id: null,
          },
        ],
        spread_events: [
          {
            time: 1,
            node_id: 'water-plant',
            previous_state: 'operational',
            next_state: 'degraded',
            cause: 'threshold_exceeded',
            source_node_id: 'power-west',
          },
          {
            time: 1,
            node_id: 'comm-tower-1',
            previous_state: 'operational',
            next_state: 'degraded',
            cause: 'upstream_voltage_sag',
            source_node_id: 'power-west',
          },
          {
            time: 2,
            node_id: 'water-plant',
            previous_state: 'degraded',
            next_state: 'failed',
            cause: 'auxiliary_generator_depletion',
            source_node_id: 'power-west',
          },
          {
            time: 2,
            node_id: 'water-pump-main',
            previous_state: 'operational',
            next_state: 'degraded',
            cause: 'supply_pressure_loss',
            source_node_id: 'water-plant',
          },
          {
            time: 2,
            node_id: 'hospital-central',
            previous_state: 'operational',
            next_state: 'degraded',
            cause: 'dual_feed_degradation',
            source_node_id: 'power-west',
          },
          {
            time: 2,
            node_id: 'comm-tower-1',
            previous_state: 'degraded',
            next_state: 'failed',
            cause: 'battery_bank_exhaustion',
            source_node_id: 'power-west',
          },
          {
            time: 2,
            node_id: 'metro-dispatch',
            previous_state: 'operational',
            next_state: 'degraded',
            cause: 'telecom_link_loss',
            source_node_id: 'comm-tower-1',
          },
          {
            time: 3,
            node_id: 'water-pump-main',
            previous_state: 'degraded',
            next_state: 'failed',
            cause: 'cavitation_lockout',
            source_node_id: 'water-plant',
          },
          {
            time: 3,
            node_id: 'hospital-central',
            previous_state: 'degraded',
            next_state: 'failed',
            cause: 'sterilization_steam_cooling_failure',
            source_node_id: 'water-pump-main',
          },
          {
            time: 3,
            node_id: 'trauma-center',
            previous_state: 'operational',
            next_state: 'degraded',
            cause: 'patient_diversion_overload',
            source_node_id: 'hospital-central',
          },
          {
            time: 3,
            node_id: 'metro-dispatch',
            previous_state: 'degraded',
            next_state: 'failed',
            cause: 'automated_safety_interlock_trip',
            source_node_id: 'comm-tower-1',
          },
          {
            time: 4,
            node_id: 'trauma-center',
            previous_state: 'degraded',
            next_state: 'failed',
            cause: 'surgical_suite_hvac_shutdown',
            source_node_id: 'hospital-central',
          },
        ],
        recovery_events: [],
        final_system_condition: {
          'power-west': 'failed',
          'power-grid-core': 'operational',
          'water-plant': 'failed',
          'water-pump-main': 'failed',
          'hospital-central': 'failed',
          'trauma-center': 'failed',
          'metro-dispatch': 'failed',
          'comm-tower-1': 'failed',
        },
      },
    },
  },

  'contained-substation-failure': {
    scenario: {
      id: 'contained-substation-failure',
      name: 'Contained substation failure',
      description: 'Single substation trip isolated by automated fast-switching feeder line before reaching water or transport grids.',
      graph_id: 'central-city-services-v1',
      nodes: [
        { id: 'power-east', name: 'East Feeder Substation', service_type: 'power', failure_threshold: 0.8 },
        { id: 'power-tie-line', name: 'District Ring Tie Line', service_type: 'power', failure_threshold: 0.85 },
        { id: 'water-east', name: 'East Basin Filtration Plant', service_type: 'water', failure_threshold: 0.7 },
        { id: 'comm-hub-east', name: 'East Fiber Cross-Connect', service_type: 'communications', failure_threshold: 0.75 },
        { id: 'transit-east', name: 'East Line Rail Substation', service_type: 'transport', failure_threshold: 0.65 },
        { id: 'clinic-east', name: 'Eastside Urgent Care Clinic', service_type: 'healthcare', failure_threshold: 0.6 },
      ],
      edges: [
        { upstream_id: 'power-east', dependent_id: 'water-east', weight: 0.7 },
        { upstream_id: 'power-tie-line', dependent_id: 'water-east', weight: 0.9 },
        { upstream_id: 'power-east', dependent_id: 'comm-hub-east', weight: 0.6 },
        { upstream_id: 'power-tie-line', dependent_id: 'comm-hub-east', weight: 0.85 },
        { upstream_id: 'power-east', dependent_id: 'transit-east', weight: 0.65 },
        { upstream_id: 'water-east', dependent_id: 'clinic-east', weight: 0.75 },
      ],
      initial_disruptions: ['power-east'],
    },
    result: {
      scenario_id: 'contained-substation-failure',
      seed: 1044,
      start_time: 0,
      end_time: 5,
      snapshots: [
        {
          time: 0,
          node_states: {
            'power-east': 'failed',
            'power-tie-line': 'operational',
            'water-east': 'operational',
            'comm-hub-east': 'operational',
            'transit-east': 'operational',
            'clinic-east': 'operational',
          },
        },
        {
          time: 1,
          node_states: {
            'power-east': 'failed',
            'power-tie-line': 'operational',
            'water-east': 'degraded',
            'comm-hub-east': 'operational',
            'transit-east': 'degraded',
            'clinic-east': 'operational',
          },
        },
        {
          time: 2,
          node_states: {
            'power-east': 'failed',
            'power-tie-line': 'operational',
            'water-east': 'operational',
            'comm-hub-east': 'operational',
            'transit-east': 'operational',
            'clinic-east': 'operational',
          },
        },
        {
          time: 3,
          node_states: {
            'power-east': 'failed',
            'power-tie-line': 'operational',
            'water-east': 'operational',
            'comm-hub-east': 'operational',
            'transit-east': 'operational',
            'clinic-east': 'operational',
          },
        },
        {
          time: 4,
          node_states: {
            'power-east': 'failed',
            'power-tie-line': 'operational',
            'water-east': 'operational',
            'comm-hub-east': 'operational',
            'transit-east': 'operational',
            'clinic-east': 'operational',
          },
        },
        {
          time: 5,
          node_states: {
            'power-east': 'failed',
            'power-tie-line': 'operational',
            'water-east': 'operational',
            'comm-hub-east': 'operational',
            'transit-east': 'operational',
            'clinic-east': 'operational',
          },
        },
      ],
      events: [
        {
          time: 0,
          node_id: 'power-east',
          previous_state: 'operational',
          next_state: 'failed',
          cause: 'lightning_strike_breaker_fault',
          source_node_id: null,
        },
        {
          time: 1,
          node_id: 'water-east',
          previous_state: 'operational',
          next_state: 'degraded',
          cause: 'instantaneous_feed_interruption',
          source_node_id: 'power-east',
        },
        {
          time: 1,
          node_id: 'transit-east',
          previous_state: 'operational',
          next_state: 'degraded',
          cause: 'third_rail_voltage_drop',
          source_node_id: 'power-east',
        },
        {
          time: 2,
          node_id: 'water-east',
          previous_state: 'degraded',
          next_state: 'operational',
          cause: 'redundant_tie_line_reclosure',
          source_node_id: 'power-tie-line',
        },
        {
          time: 2,
          node_id: 'transit-east',
          previous_state: 'degraded',
          next_state: 'operational',
          cause: 'backup_grid_switchover',
          source_node_id: 'power-tie-line',
        },
      ],
    },
    metrics: {
      scenario_id: 'contained-substation-failure',
      seed: 1044,
      headline: {
        cascade_depth_ticks: 2,
        affected_services: 3,
        recovery_time_ticks: 2,
        recovery_status: 'fully_recovered',
        peak_impact: 3,
      },
      cascade_depth_ticks: 2,
      dependency_hop_depth: 1,
      affected_services: {
        count: 3,
        node_ids: ['power-east', 'water-east', 'transit-east'],
        by_service_type: [
          {
            service_type: 'power',
            count: 1,
            services: [{ id: 'power-east', name: 'East Feeder Substation' }],
          },
          {
            service_type: 'water',
            count: 1,
            services: [{ id: 'water-east', name: 'East Basin Filtration Plant' }],
          },
          {
            service_type: 'transport',
            count: 1,
            services: [{ id: 'transit-east', name: 'East Line Rail Substation' }],
          },
        ],
      },
      recovery_time: {
        duration_ticks: 2,
        recovered_at: 2,
        status: 'fully_recovered',
      },
      peak_impact: {
        count: 3,
        time: 1,
      },
      timeline: {
        initiating_events: [
          {
            time: 0,
            node_id: 'power-east',
            previous_state: 'operational',
            next_state: 'failed',
            cause: 'lightning_strike_breaker_fault',
            source_node_id: null,
          },
        ],
        spread_events: [
          {
            time: 1,
            node_id: 'water-east',
            previous_state: 'operational',
            next_state: 'degraded',
            cause: 'instantaneous_feed_interruption',
            source_node_id: 'power-east',
          },
          {
            time: 1,
            node_id: 'transit-east',
            previous_state: 'operational',
            next_state: 'degraded',
            cause: 'third_rail_voltage_drop',
            source_node_id: 'power-east',
          },
        ],
        recovery_events: [
          {
            time: 2,
            node_id: 'water-east',
            previous_state: 'degraded',
            next_state: 'operational',
            cause: 'redundant_tie_line_reclosure',
            source_node_id: 'power-tie-line',
          },
          {
            time: 2,
            node_id: 'transit-east',
            previous_state: 'degraded',
            next_state: 'operational',
            cause: 'backup_grid_switchover',
            source_node_id: 'power-tie-line',
          },
        ],
        final_system_condition: {
          'power-east': 'failed',
          'power-tie-line': 'operational',
          'water-east': 'operational',
          'comm-hub-east': 'operational',
          'transit-east': 'operational',
          'clinic-east': 'operational',
        },
      },
    },
  },

  'converging-disruptions': {
    scenario: {
      id: 'converging-disruptions',
      name: 'Converging disruptions',
      description: 'Simultaneous fiber backbone severance and water pump station fault converge on metro emergency dispatch and trauma logistics.',
      graph_id: 'central-city-services-v1',
      nodes: [
        { id: 'comm-fiber-hub', name: 'Harbor Fiber Junction', service_type: 'communications', failure_threshold: 0.75 },
        { id: 'water-harbor', name: 'Harbor Surge Pump Station', service_type: 'water', failure_threshold: 0.7 },
        { id: 'power-south', name: 'South Harbor Substation', service_type: 'power', failure_threshold: 0.8 },
        { id: 'metro-dispatch-south', name: 'Harbor Marine & Rail Dispatch', service_type: 'transport', failure_threshold: 0.6 },
        { id: 'medical-evac-hub', name: 'Port Authority Emergency Medical Base', service_type: 'healthcare', failure_threshold: 0.55 },
        { id: 'traffic-signals-south', name: 'South Corridor Traffic Matrix', service_type: 'transport', failure_threshold: 0.65 },
      ],
      edges: [
        { upstream_id: 'comm-fiber-hub', dependent_id: 'metro-dispatch-south', weight: 0.85 },
        { upstream_id: 'water-harbor', dependent_id: 'medical-evac-hub', weight: 0.75 },
        { upstream_id: 'power-south', dependent_id: 'water-harbor', weight: 0.65 },
        { upstream_id: 'power-south', dependent_id: 'traffic-signals-south', weight: 0.7 },
        { upstream_id: 'comm-fiber-hub', dependent_id: 'traffic-signals-south', weight: 0.8 },
        { upstream_id: 'metro-dispatch-south', dependent_id: 'medical-evac-hub', weight: 0.9 },
      ],
      initial_disruptions: ['comm-fiber-hub', 'water-harbor'],
    },
    result: {
      scenario_id: 'converging-disruptions',
      seed: 3108,
      start_time: 0,
      end_time: 5,
      snapshots: [
        {
          time: 0,
          node_states: {
            'comm-fiber-hub': 'failed',
            'water-harbor': 'failed',
            'power-south': 'operational',
            'metro-dispatch-south': 'operational',
            'medical-evac-hub': 'operational',
            'traffic-signals-south': 'operational',
          },
        },
        {
          time: 1,
          node_states: {
            'comm-fiber-hub': 'failed',
            'water-harbor': 'failed',
            'power-south': 'operational',
            'metro-dispatch-south': 'degraded',
            'medical-evac-hub': 'degraded',
            'traffic-signals-south': 'degraded',
          },
        },
        {
          time: 2,
          node_states: {
            'comm-fiber-hub': 'failed',
            'water-harbor': 'failed',
            'power-south': 'operational',
            'metro-dispatch-south': 'failed',
            'medical-evac-hub': 'failed',
            'traffic-signals-south': 'failed',
          },
        },
        {
          time: 3,
          node_states: {
            'comm-fiber-hub': 'failed',
            'water-harbor': 'failed',
            'power-south': 'operational',
            'metro-dispatch-south': 'failed',
            'medical-evac-hub': 'failed',
            'traffic-signals-south': 'failed',
          },
        },
        {
          time: 4,
          node_states: {
            'comm-fiber-hub': 'failed',
            'water-harbor': 'failed',
            'power-south': 'operational',
            'metro-dispatch-south': 'failed',
            'medical-evac-hub': 'failed',
            'traffic-signals-south': 'failed',
          },
        },
        {
          time: 5,
          node_states: {
            'comm-fiber-hub': 'failed',
            'water-harbor': 'failed',
            'power-south': 'operational',
            'metro-dispatch-south': 'failed',
            'medical-evac-hub': 'failed',
            'traffic-signals-south': 'failed',
          },
        },
      ],
      events: [
        {
          time: 0,
          node_id: 'comm-fiber-hub',
          previous_state: 'operational',
          next_state: 'failed',
          cause: 'trenching_physical_cable_severance',
          source_node_id: null,
        },
        {
          time: 0,
          node_id: 'water-harbor',
          previous_state: 'operational',
          next_state: 'failed',
          cause: 'storm_surge_motor_submersion',
          source_node_id: null,
        },
        {
          time: 1,
          node_id: 'metro-dispatch-south',
          previous_state: 'operational',
          next_state: 'degraded',
          cause: 'packet_loss_exceeded_threshold',
          source_node_id: 'comm-fiber-hub',
        },
        {
          time: 1,
          node_id: 'medical-evac-hub',
          previous_state: 'operational',
          next_state: 'degraded',
          cause: 'fire_suppression_pressure_drop',
          source_node_id: 'water-harbor',
        },
        {
          time: 1,
          node_id: 'traffic-signals-south',
          previous_state: 'operational',
          next_state: 'degraded',
          cause: 'sync_signal_timeout',
          source_node_id: 'comm-fiber-hub',
        },
        {
          time: 2,
          node_id: 'metro-dispatch-south',
          previous_state: 'degraded',
          next_state: 'failed',
          cause: 'telemetry_loss_failsafe_shutdown',
          source_node_id: 'comm-fiber-hub',
        },
        {
          time: 2,
          node_id: 'medical-evac-hub',
          previous_state: 'degraded',
          next_state: 'failed',
          cause: 'converged_water_and_dispatch_failure',
          source_node_id: 'metro-dispatch-south',
        },
        {
          time: 2,
          node_id: 'traffic-signals-south',
          previous_state: 'degraded',
          next_state: 'failed',
          cause: 'flashing_yellow_fallback_timeout',
          source_node_id: 'comm-fiber-hub',
        },
      ],
    },
    metrics: {
      scenario_id: 'converging-disruptions',
      seed: 3108,
      headline: {
        cascade_depth_ticks: 2,
        affected_services: 5,
        recovery_time_ticks: null,
        recovery_status: 'not_recovered',
        peak_impact: 5,
      },
      cascade_depth_ticks: 2,
      dependency_hop_depth: 2,
      affected_services: {
        count: 5,
        node_ids: [
          'comm-fiber-hub',
          'water-harbor',
          'metro-dispatch-south',
          'medical-evac-hub',
          'traffic-signals-south',
        ],
        by_service_type: [
          {
            service_type: 'communications',
            count: 1,
            services: [{ id: 'comm-fiber-hub', name: 'Harbor Fiber Junction' }],
          },
          {
            service_type: 'water',
            count: 1,
            services: [{ id: 'water-harbor', name: 'Harbor Surge Pump Station' }],
          },
          {
            service_type: 'transport',
            count: 2,
            services: [
              { id: 'metro-dispatch-south', name: 'Harbor Marine & Rail Dispatch' },
              { id: 'traffic-signals-south', name: 'South Corridor Traffic Matrix' },
            ],
          },
          {
            service_type: 'healthcare',
            count: 1,
            services: [{ id: 'medical-evac-hub', name: 'Port Authority Emergency Medical Base' }],
          },
        ],
      },
      recovery_time: {
        duration_ticks: null,
        recovered_at: null,
        status: 'not_recovered',
      },
      peak_impact: {
        count: 5,
        time: 2,
      },
      timeline: {
        initiating_events: [
          {
            time: 0,
            node_id: 'comm-fiber-hub',
            previous_state: 'operational',
            next_state: 'failed',
            cause: 'trenching_physical_cable_severance',
            source_node_id: null,
          },
          {
            time: 0,
            node_id: 'water-harbor',
            previous_state: 'operational',
            next_state: 'failed',
            cause: 'storm_surge_motor_submersion',
            source_node_id: null,
          },
        ],
        spread_events: [
          {
            time: 1,
            node_id: 'metro-dispatch-south',
            previous_state: 'operational',
            next_state: 'degraded',
            cause: 'packet_loss_exceeded_threshold',
            source_node_id: 'comm-fiber-hub',
          },
          {
            time: 1,
            node_id: 'medical-evac-hub',
            previous_state: 'operational',
            next_state: 'degraded',
            cause: 'fire_suppression_pressure_drop',
            source_node_id: 'water-harbor',
          },
          {
            time: 1,
            node_id: 'traffic-signals-south',
            previous_state: 'operational',
            next_state: 'degraded',
            cause: 'sync_signal_timeout',
            source_node_id: 'comm-fiber-hub',
          },
          {
            time: 2,
            node_id: 'metro-dispatch-south',
            previous_state: 'degraded',
            next_state: 'failed',
            cause: 'telemetry_loss_failsafe_shutdown',
            source_node_id: 'comm-fiber-hub',
          },
          {
            time: 2,
            node_id: 'medical-evac-hub',
            previous_state: 'degraded',
            next_state: 'failed',
            cause: 'converged_water_and_dispatch_failure',
            source_node_id: 'metro-dispatch-south',
          },
          {
            time: 2,
            node_id: 'traffic-signals-south',
            previous_state: 'degraded',
            next_state: 'failed',
            cause: 'flashing_yellow_fallback_timeout',
            source_node_id: 'comm-fiber-hub',
          },
        ],
        recovery_events: [],
        final_system_condition: {
          'comm-fiber-hub': 'failed',
          'water-harbor': 'failed',
          'power-south': 'operational',
          'metro-dispatch-south': 'failed',
          'medical-evac-hub': 'failed',
          'traffic-signals-south': 'failed',
        },
      },
    },
  },

  'targeted-recovery': {
    scenario: {
      id: 'targeted-recovery',
      name: 'Targeted recovery',
      description: 'Major generator failure triggers widespread blackout, followed by prioritized black-start sequencing across healthcare and water life-support grids.',
      graph_id: 'central-city-services-v1',
      nodes: [
        { id: 'power-north-gen', name: 'North Peaker Generator', service_type: 'power', failure_threshold: 0.8 },
        { id: 'power-aux-diesel', name: 'Emergency Diesel Microgrid', service_type: 'power', failure_threshold: 0.9 },
        { id: 'water-treatment-north', name: 'North Aqueduct Treatment Facility', service_type: 'water', failure_threshold: 0.7 },
        { id: 'hospital-north', name: 'University Medical Campus', service_type: 'healthcare', failure_threshold: 0.5 },
        { id: 'comm-relay-north', name: 'Hillside Microwave Relay', service_type: 'communications', failure_threshold: 0.7 },
        { id: 'transport-rapid-bus', name: 'North Rapid Transit Depot', service_type: 'transport', failure_threshold: 0.65 },
      ],
      edges: [
        { upstream_id: 'power-north-gen', dependent_id: 'water-treatment-north', weight: 0.85 },
        { upstream_id: 'power-aux-diesel', dependent_id: 'water-treatment-north', weight: 0.95 },
        { upstream_id: 'power-north-gen', dependent_id: 'hospital-north', weight: 0.9 },
        { upstream_id: 'power-aux-diesel', dependent_id: 'hospital-north', weight: 0.98 },
        { upstream_id: 'power-north-gen', dependent_id: 'comm-relay-north', weight: 0.7 },
        { upstream_id: 'comm-relay-north', dependent_id: 'transport-rapid-bus', weight: 0.8 },
      ],
      initial_disruptions: ['power-north-gen'],
    },
    result: {
      scenario_id: 'targeted-recovery',
      seed: 4501,
      start_time: 0,
      end_time: 6,
      snapshots: [
        {
          time: 0,
          node_states: {
            'power-north-gen': 'failed',
            'power-aux-diesel': 'operational',
            'water-treatment-north': 'operational',
            'hospital-north': 'operational',
            'comm-relay-north': 'operational',
            'transport-rapid-bus': 'operational',
          },
        },
        {
          time: 1,
          node_states: {
            'power-north-gen': 'failed',
            'power-aux-diesel': 'operational',
            'water-treatment-north': 'degraded',
            'hospital-north': 'degraded',
            'comm-relay-north': 'degraded',
            'transport-rapid-bus': 'operational',
          },
        },
        {
          time: 2,
          node_states: {
            'power-north-gen': 'failed',
            'power-aux-diesel': 'operational',
            'water-treatment-north': 'failed',
            'hospital-north': 'failed',
            'comm-relay-north': 'failed',
            'transport-rapid-bus': 'degraded',
          },
        },
        {
          time: 3,
          node_states: {
            'power-north-gen': 'failed',
            'power-aux-diesel': 'operational',
            'water-treatment-north': 'degraded',
            'hospital-north': 'degraded',
            'comm-relay-north': 'failed',
            'transport-rapid-bus': 'failed',
          },
        },
        {
          time: 4,
          node_states: {
            'power-north-gen': 'failed',
            'power-aux-diesel': 'operational',
            'water-treatment-north': 'operational',
            'hospital-north': 'operational',
            'comm-relay-north': 'degraded',
            'transport-rapid-bus': 'degraded',
          },
        },
        {
          time: 5,
          node_states: {
            'power-north-gen': 'degraded',
            'power-aux-diesel': 'operational',
            'water-treatment-north': 'operational',
            'hospital-north': 'operational',
            'comm-relay-north': 'operational',
            'transport-rapid-bus': 'operational',
          },
        },
        {
          time: 6,
          node_states: {
            'power-north-gen': 'operational',
            'power-aux-diesel': 'operational',
            'water-treatment-north': 'operational',
            'hospital-north': 'operational',
            'comm-relay-north': 'operational',
            'transport-rapid-bus': 'operational',
          },
        },
      ],
      events: [
        {
          time: 0,
          node_id: 'power-north-gen',
          previous_state: 'operational',
          next_state: 'failed',
          cause: 'turbine_bearing_overheat_scram',
          source_node_id: null,
        },
        {
          time: 1,
          node_id: 'water-treatment-north',
          previous_state: 'operational',
          next_state: 'degraded',
          cause: 'primary_bus_voltage_drop',
          source_node_id: 'power-north-gen',
        },
        {
          time: 1,
          node_id: 'hospital-north',
          previous_state: 'operational',
          next_state: 'degraded',
          cause: 'grid_frequency_instability',
          source_node_id: 'power-north-gen',
        },
        {
          time: 1,
          node_id: 'comm-relay-north',
          previous_state: 'operational',
          next_state: 'degraded',
          cause: 'power_loss_battery_inverter_active',
          source_node_id: 'power-north-gen',
        },
        {
          time: 2,
          node_id: 'water-treatment-north',
          previous_state: 'degraded',
          next_state: 'failed',
          cause: 'disinfection_circulation_halt',
          source_node_id: 'power-north-gen',
        },
        {
          time: 2,
          node_id: 'hospital-north',
          previous_state: 'degraded',
          next_state: 'failed',
          cause: 'transfer_switch_delay_lockout',
          source_node_id: 'power-north-gen',
        },
        {
          time: 2,
          node_id: 'comm-relay-north',
          previous_state: 'degraded',
          next_state: 'failed',
          cause: 'battery_depletion',
          source_node_id: 'power-north-gen',
        },
        {
          time: 2,
          node_id: 'transport-rapid-bus',
          previous_state: 'operational',
          next_state: 'degraded',
          cause: 'telemetry_link_interruption',
          source_node_id: 'comm-relay-north',
        },
        {
          time: 3,
          node_id: 'hospital-north',
          previous_state: 'failed',
          next_state: 'degraded',
          cause: 'diesel_microgrid_priority_coupling',
          source_node_id: 'power-aux-diesel',
        },
        {
          time: 3,
          node_id: 'water-treatment-north',
          previous_state: 'failed',
          next_state: 'degraded',
          cause: 'diesel_aux_feed_energized',
          source_node_id: 'power-aux-diesel',
        },
        {
          time: 3,
          node_id: 'transport-rapid-bus',
          previous_state: 'degraded',
          next_state: 'failed',
          cause: 'dispatch_queue_overflow',
          source_node_id: 'comm-relay-north',
        },
        {
          time: 4,
          node_id: 'hospital-north',
          previous_state: 'degraded',
          next_state: 'operational',
          cause: 'full_life_support_bus_stabilized',
          source_node_id: 'power-aux-diesel',
        },
        {
          time: 4,
          node_id: 'water-treatment-north',
          previous_state: 'degraded',
          next_state: 'operational',
          cause: 'filtration_pumps_restored',
          source_node_id: 'power-aux-diesel',
        },
        {
          time: 4,
          node_id: 'comm-relay-north',
          previous_state: 'failed',
          next_state: 'degraded',
          cause: 'auxiliary_line_backfeed',
          source_node_id: 'power-aux-diesel',
        },
        {
          time: 4,
          node_id: 'transport-rapid-bus',
          previous_state: 'failed',
          next_state: 'degraded',
          cause: 'telemetry_restoration_handshake',
          source_node_id: 'comm-relay-north',
        },
        {
          time: 5,
          node_id: 'power-north-gen',
          previous_state: 'failed',
          next_state: 'degraded',
          cause: 'black_start_combustion_turbine_sync',
          source_node_id: null,
        },
        {
          time: 5,
          node_id: 'comm-relay-north',
          previous_state: 'degraded',
          next_state: 'operational',
          cause: 'grid_synchronization_lock',
          source_node_id: 'power-north-gen',
        },
        {
          time: 5,
          node_id: 'transport-rapid-bus',
          previous_state: 'degraded',
          next_state: 'operational',
          cause: 'route_clearance_restored',
          source_node_id: 'comm-relay-north',
        },
        {
          time: 6,
          node_id: 'power-north-gen',
          previous_state: 'degraded',
          next_state: 'operational',
          cause: 'rated_output_achieved',
          source_node_id: null,
        },
      ],
    },
    metrics: {
      scenario_id: 'targeted-recovery',
      seed: 4501,
      headline: {
        cascade_depth_ticks: 3,
        affected_services: 5,
        recovery_time_ticks: 6,
        recovery_status: 'fully_recovered',
        peak_impact: 5,
      },
      cascade_depth_ticks: 3,
      dependency_hop_depth: 2,
      affected_services: {
        count: 5,
        node_ids: [
          'power-north-gen',
          'water-treatment-north',
          'hospital-north',
          'comm-relay-north',
          'transport-rapid-bus',
        ],
        by_service_type: [
          {
            service_type: 'power',
            count: 1,
            services: [{ id: 'power-north-gen', name: 'North Peaker Generator' }],
          },
          {
            service_type: 'water',
            count: 1,
            services: [{ id: 'water-treatment-north', name: 'North Aqueduct Treatment Facility' }],
          },
          {
            service_type: 'healthcare',
            count: 1,
            services: [{ id: 'hospital-north', name: 'University Medical Campus' }],
          },
          {
            service_type: 'communications',
            count: 1,
            services: [{ id: 'comm-relay-north', name: 'Hillside Microwave Relay' }],
          },
          {
            service_type: 'transport',
            count: 1,
            services: [{ id: 'transport-rapid-bus', name: 'North Rapid Transit Depot' }],
          },
        ],
      },
      recovery_time: {
        duration_ticks: 6,
        recovered_at: 6,
        status: 'fully_recovered',
      },
      peak_impact: {
        count: 5,
        time: 2,
      },
      timeline: {
        initiating_events: [
          {
            time: 0,
            node_id: 'power-north-gen',
            previous_state: 'operational',
            next_state: 'failed',
            cause: 'turbine_bearing_overheat_scram',
            source_node_id: null,
          },
        ],
        spread_events: [
          {
            time: 1,
            node_id: 'water-treatment-north',
            previous_state: 'operational',
            next_state: 'degraded',
            cause: 'primary_bus_voltage_drop',
            source_node_id: 'power-north-gen',
          },
          {
            time: 1,
            node_id: 'hospital-north',
            previous_state: 'operational',
            next_state: 'degraded',
            cause: 'grid_frequency_instability',
            source_node_id: 'power-north-gen',
          },
          {
            time: 1,
            node_id: 'comm-relay-north',
            previous_state: 'operational',
            next_state: 'degraded',
            cause: 'power_loss_battery_inverter_active',
            source_node_id: 'power-north-gen',
          },
          {
            time: 2,
            node_id: 'water-treatment-north',
            previous_state: 'degraded',
            next_state: 'failed',
            cause: 'disinfection_circulation_halt',
            source_node_id: 'power-north-gen',
          },
          {
            time: 2,
            node_id: 'hospital-north',
            previous_state: 'degraded',
            next_state: 'failed',
            cause: 'transfer_switch_delay_lockout',
            source_node_id: 'power-north-gen',
          },
          {
            time: 2,
            node_id: 'comm-relay-north',
            previous_state: 'degraded',
            next_state: 'failed',
            cause: 'battery_depletion',
            source_node_id: 'power-north-gen',
          },
          {
            time: 2,
            node_id: 'transport-rapid-bus',
            previous_state: 'operational',
            next_state: 'degraded',
            cause: 'telemetry_link_interruption',
            source_node_id: 'comm-relay-north',
          },
          {
            time: 3,
            node_id: 'transport-rapid-bus',
            previous_state: 'degraded',
            next_state: 'failed',
            cause: 'dispatch_queue_overflow',
            source_node_id: 'comm-relay-north',
          },
        ],
        recovery_events: [
          {
            time: 3,
            node_id: 'hospital-north',
            previous_state: 'failed',
            next_state: 'degraded',
            cause: 'diesel_microgrid_priority_coupling',
            source_node_id: 'power-aux-diesel',
          },
          {
            time: 3,
            node_id: 'water-treatment-north',
            previous_state: 'failed',
            next_state: 'degraded',
            cause: 'diesel_aux_feed_energized',
            source_node_id: 'power-aux-diesel',
          },
          {
            time: 4,
            node_id: 'hospital-north',
            previous_state: 'degraded',
            next_state: 'operational',
            cause: 'full_life_support_bus_stabilized',
            source_node_id: 'power-aux-diesel',
          },
          {
            time: 4,
            node_id: 'water-treatment-north',
            previous_state: 'degraded',
            next_state: 'operational',
            cause: 'filtration_pumps_restored',
            source_node_id: 'power-aux-diesel',
          },
          {
            time: 4,
            node_id: 'comm-relay-north',
            previous_state: 'failed',
            next_state: 'degraded',
            cause: 'auxiliary_line_backfeed',
            source_node_id: 'power-aux-diesel',
          },
          {
            time: 4,
            node_id: 'transport-rapid-bus',
            previous_state: 'failed',
            next_state: 'degraded',
            cause: 'telemetry_restoration_handshake',
            source_node_id: 'comm-relay-north',
          },
          {
            time: 5,
            node_id: 'power-north-gen',
            previous_state: 'failed',
            next_state: 'degraded',
            cause: 'black_start_combustion_turbine_sync',
            source_node_id: null,
          },
          {
            time: 5,
            node_id: 'comm-relay-north',
            previous_state: 'degraded',
            next_state: 'operational',
            cause: 'grid_synchronization_lock',
            source_node_id: 'power-north-gen',
          },
          {
            time: 5,
            node_id: 'transport-rapid-bus',
            previous_state: 'degraded',
            next_state: 'operational',
            cause: 'route_clearance_restored',
            source_node_id: 'comm-relay-north',
          },
          {
            time: 6,
            node_id: 'power-north-gen',
            previous_state: 'degraded',
            next_state: 'operational',
            cause: 'rated_output_achieved',
            source_node_id: null,
          },
        ],
        final_system_condition: {
          'power-north-gen': 'operational',
          'power-aux-diesel': 'operational',
          'water-treatment-north': 'operational',
          'hospital-north': 'operational',
          'comm-relay-north': 'operational',
          'transport-rapid-bus': 'operational',
        },
      },
    },
  },

  'city-wide-blackout': {
  "scenario": {
    "id": "city-wide-blackout",
    "name": "City-Wide Blackout Event",
    "description": "Generated large scenario with 45 nodes",
    "graph_id": "large-graph-v1",
    "nodes": [
      {
        "id": "node-city-wide-blackout-0",
        "name": "Facility 0 (city-wide-blackout)",
        "service_type": "transport",
        "failure_threshold": 0.6123476871444644
      },
      {
        "id": "node-city-wide-blackout-1",
        "name": "Facility 1 (city-wide-blackout)",
        "service_type": "communications",
        "failure_threshold": 0.8976399725983247
      },
      {
        "id": "node-city-wide-blackout-2",
        "name": "Facility 2 (city-wide-blackout)",
        "service_type": "communications",
        "failure_threshold": 0.7031338539737422
      },
      {
        "id": "node-city-wide-blackout-3",
        "name": "Facility 3 (city-wide-blackout)",
        "service_type": "communications",
        "failure_threshold": 0.5146665831156074
      },
      {
        "id": "node-city-wide-blackout-4",
        "name": "Facility 4 (city-wide-blackout)",
        "service_type": "water",
        "failure_threshold": 0.8370036367096249
      },
      {
        "id": "node-city-wide-blackout-5",
        "name": "Facility 5 (city-wide-blackout)",
        "service_type": "water",
        "failure_threshold": 0.6414894090667463
      },
      {
        "id": "node-city-wide-blackout-6",
        "name": "Facility 6 (city-wide-blackout)",
        "service_type": "water",
        "failure_threshold": 0.7887326147470426
      },
      {
        "id": "node-city-wide-blackout-7",
        "name": "Facility 7 (city-wide-blackout)",
        "service_type": "power",
        "failure_threshold": 0.6801534748464853
      },
      {
        "id": "node-city-wide-blackout-8",
        "name": "Facility 8 (city-wide-blackout)",
        "service_type": "communications",
        "failure_threshold": 0.8724236247748611
      },
      {
        "id": "node-city-wide-blackout-9",
        "name": "Facility 9 (city-wide-blackout)",
        "service_type": "water",
        "failure_threshold": 0.8702821490476598
      },
      {
        "id": "node-city-wide-blackout-10",
        "name": "Facility 10 (city-wide-blackout)",
        "service_type": "transport",
        "failure_threshold": 0.821219347671527
      },
      {
        "id": "node-city-wide-blackout-11",
        "name": "Facility 11 (city-wide-blackout)",
        "service_type": "water",
        "failure_threshold": 0.7876744393369589
      },
      {
        "id": "node-city-wide-blackout-12",
        "name": "Facility 12 (city-wide-blackout)",
        "service_type": "communications",
        "failure_threshold": 0.6490944334129065
      },
      {
        "id": "node-city-wide-blackout-13",
        "name": "Facility 13 (city-wide-blackout)",
        "service_type": "transport",
        "failure_threshold": 0.7404524758054041
      },
      {
        "id": "node-city-wide-blackout-14",
        "name": "Facility 14 (city-wide-blackout)",
        "service_type": "transport",
        "failure_threshold": 0.5916577801348452
      },
      {
        "id": "node-city-wide-blackout-15",
        "name": "Facility 15 (city-wide-blackout)",
        "service_type": "healthcare",
        "failure_threshold": 0.6042789983342761
      },
      {
        "id": "node-city-wide-blackout-16",
        "name": "Facility 16 (city-wide-blackout)",
        "service_type": "water",
        "failure_threshold": 0.6648489867108504
      },
      {
        "id": "node-city-wide-blackout-17",
        "name": "Facility 17 (city-wide-blackout)",
        "service_type": "power",
        "failure_threshold": 0.5499532386882577
      },
      {
        "id": "node-city-wide-blackout-18",
        "name": "Facility 18 (city-wide-blackout)",
        "service_type": "healthcare",
        "failure_threshold": 0.6040184051283221
      },
      {
        "id": "node-city-wide-blackout-19",
        "name": "Facility 19 (city-wide-blackout)",
        "service_type": "transport",
        "failure_threshold": 0.532394715266223
      },
      {
        "id": "node-city-wide-blackout-20",
        "name": "Facility 20 (city-wide-blackout)",
        "service_type": "power",
        "failure_threshold": 0.6916156985769026
      },
      {
        "id": "node-city-wide-blackout-21",
        "name": "Facility 21 (city-wide-blackout)",
        "service_type": "power",
        "failure_threshold": 0.7314791264845044
      },
      {
        "id": "node-city-wide-blackout-22",
        "name": "Facility 22 (city-wide-blackout)",
        "service_type": "communications",
        "failure_threshold": 0.8788253871918119
      },
      {
        "id": "node-city-wide-blackout-23",
        "name": "Facility 23 (city-wide-blackout)",
        "service_type": "power",
        "failure_threshold": 0.8585135788345148
      },
      {
        "id": "node-city-wide-blackout-24",
        "name": "Facility 24 (city-wide-blackout)",
        "service_type": "healthcare",
        "failure_threshold": 0.6574882164257528
      },
      {
        "id": "node-city-wide-blackout-25",
        "name": "Facility 25 (city-wide-blackout)",
        "service_type": "healthcare",
        "failure_threshold": 0.6673494239168647
      },
      {
        "id": "node-city-wide-blackout-26",
        "name": "Facility 26 (city-wide-blackout)",
        "service_type": "water",
        "failure_threshold": 0.8050757487408305
      },
      {
        "id": "node-city-wide-blackout-27",
        "name": "Facility 27 (city-wide-blackout)",
        "service_type": "communications",
        "failure_threshold": 0.6295037701107314
      },
      {
        "id": "node-city-wide-blackout-28",
        "name": "Facility 28 (city-wide-blackout)",
        "service_type": "communications",
        "failure_threshold": 0.7920187529667007
      },
      {
        "id": "node-city-wide-blackout-29",
        "name": "Facility 29 (city-wide-blackout)",
        "service_type": "healthcare",
        "failure_threshold": 0.8763285994484803
      },
      {
        "id": "node-city-wide-blackout-30",
        "name": "Facility 30 (city-wide-blackout)",
        "service_type": "healthcare",
        "failure_threshold": 0.8392356718769918
      },
      {
        "id": "node-city-wide-blackout-31",
        "name": "Facility 31 (city-wide-blackout)",
        "service_type": "healthcare",
        "failure_threshold": 0.510930515848046
      },
      {
        "id": "node-city-wide-blackout-32",
        "name": "Facility 32 (city-wide-blackout)",
        "service_type": "communications",
        "failure_threshold": 0.7782841129154068
      },
      {
        "id": "node-city-wide-blackout-33",
        "name": "Facility 33 (city-wide-blackout)",
        "service_type": "communications",
        "failure_threshold": 0.6872882930052481
      },
      {
        "id": "node-city-wide-blackout-34",
        "name": "Facility 34 (city-wide-blackout)",
        "service_type": "power",
        "failure_threshold": 0.5954286283279994
      },
      {
        "id": "node-city-wide-blackout-35",
        "name": "Facility 35 (city-wide-blackout)",
        "service_type": "transport",
        "failure_threshold": 0.5969147081677962
      },
      {
        "id": "node-city-wide-blackout-36",
        "name": "Facility 36 (city-wide-blackout)",
        "service_type": "communications",
        "failure_threshold": 0.881453958617695
      },
      {
        "id": "node-city-wide-blackout-37",
        "name": "Facility 37 (city-wide-blackout)",
        "service_type": "power",
        "failure_threshold": 0.6081254536994993
      },
      {
        "id": "node-city-wide-blackout-38",
        "name": "Facility 38 (city-wide-blackout)",
        "service_type": "power",
        "failure_threshold": 0.8254262911699877
      },
      {
        "id": "node-city-wide-blackout-39",
        "name": "Facility 39 (city-wide-blackout)",
        "service_type": "healthcare",
        "failure_threshold": 0.8208469714721631
      },
      {
        "id": "node-city-wide-blackout-40",
        "name": "Facility 40 (city-wide-blackout)",
        "service_type": "communications",
        "failure_threshold": 0.5361884550793163
      },
      {
        "id": "node-city-wide-blackout-41",
        "name": "Facility 41 (city-wide-blackout)",
        "service_type": "water",
        "failure_threshold": 0.8890425104373181
      },
      {
        "id": "node-city-wide-blackout-42",
        "name": "Facility 42 (city-wide-blackout)",
        "service_type": "power",
        "failure_threshold": 0.5245525436163924
      },
      {
        "id": "node-city-wide-blackout-43",
        "name": "Facility 43 (city-wide-blackout)",
        "service_type": "communications",
        "failure_threshold": 0.7365950699377829
      },
      {
        "id": "node-city-wide-blackout-44",
        "name": "Facility 44 (city-wide-blackout)",
        "service_type": "transport",
        "failure_threshold": 0.8409738897516967
      }
    ],
    "edges": [
      {
        "upstream_id": "node-city-wide-blackout-0",
        "dependent_id": "node-city-wide-blackout-1",
        "weight": 0.5390811834283121
      },
      {
        "upstream_id": "node-city-wide-blackout-0",
        "dependent_id": "node-city-wide-blackout-2",
        "weight": 0.3913793965523541
      },
      {
        "upstream_id": "node-city-wide-blackout-0",
        "dependent_id": "node-city-wide-blackout-3",
        "weight": 0.9247450847440375
      },
      {
        "upstream_id": "node-city-wide-blackout-3",
        "dependent_id": "node-city-wide-blackout-4",
        "weight": 0.3289439869360557
      },
      {
        "upstream_id": "node-city-wide-blackout-2",
        "dependent_id": "node-city-wide-blackout-5",
        "weight": 0.8707436714469461
      },
      {
        "upstream_id": "node-city-wide-blackout-3",
        "dependent_id": "node-city-wide-blackout-5",
        "weight": 0.5552295979208588
      },
      {
        "upstream_id": "node-city-wide-blackout-2",
        "dependent_id": "node-city-wide-blackout-6",
        "weight": 0.7074062070302439
      },
      {
        "upstream_id": "node-city-wide-blackout-5",
        "dependent_id": "node-city-wide-blackout-7",
        "weight": 0.31438962566292267
      },
      {
        "upstream_id": "node-city-wide-blackout-0",
        "dependent_id": "node-city-wide-blackout-7",
        "weight": 0.6197424307865731
      },
      {
        "upstream_id": "node-city-wide-blackout-0",
        "dependent_id": "node-city-wide-blackout-8",
        "weight": 0.9293127578043971
      },
      {
        "upstream_id": "node-city-wide-blackout-2",
        "dependent_id": "node-city-wide-blackout-9",
        "weight": 0.7397455089966479
      },
      {
        "upstream_id": "node-city-wide-blackout-8",
        "dependent_id": "node-city-wide-blackout-10",
        "weight": 0.545233040244611
      },
      {
        "upstream_id": "node-city-wide-blackout-3",
        "dependent_id": "node-city-wide-blackout-10",
        "weight": 0.24738350808154352
      },
      {
        "upstream_id": "node-city-wide-blackout-5",
        "dependent_id": "node-city-wide-blackout-11",
        "weight": 0.3547450227729566
      },
      {
        "upstream_id": "node-city-wide-blackout-3",
        "dependent_id": "node-city-wide-blackout-12",
        "weight": 0.6473556386839321
      },
      {
        "upstream_id": "node-city-wide-blackout-1",
        "dependent_id": "node-city-wide-blackout-13",
        "weight": 0.6665947173841095
      },
      {
        "upstream_id": "node-city-wide-blackout-7",
        "dependent_id": "node-city-wide-blackout-14",
        "weight": 0.42480689698189655
      },
      {
        "upstream_id": "node-city-wide-blackout-3",
        "dependent_id": "node-city-wide-blackout-15",
        "weight": 0.7278846713361479
      },
      {
        "upstream_id": "node-city-wide-blackout-11",
        "dependent_id": "node-city-wide-blackout-16",
        "weight": 0.9490462421674035
      },
      {
        "upstream_id": "node-city-wide-blackout-5",
        "dependent_id": "node-city-wide-blackout-17",
        "weight": 0.7350255001258214
      },
      {
        "upstream_id": "node-city-wide-blackout-15",
        "dependent_id": "node-city-wide-blackout-17",
        "weight": 0.2848914255954289
      },
      {
        "upstream_id": "node-city-wide-blackout-15",
        "dependent_id": "node-city-wide-blackout-18",
        "weight": 0.4650250952247408
      },
      {
        "upstream_id": "node-city-wide-blackout-17",
        "dependent_id": "node-city-wide-blackout-19",
        "weight": 0.9948460009958158
      },
      {
        "upstream_id": "node-city-wide-blackout-16",
        "dependent_id": "node-city-wide-blackout-19",
        "weight": 0.5518124429331721
      },
      {
        "upstream_id": "node-city-wide-blackout-2",
        "dependent_id": "node-city-wide-blackout-20",
        "weight": 0.7413687607312665
      },
      {
        "upstream_id": "node-city-wide-blackout-14",
        "dependent_id": "node-city-wide-blackout-20",
        "weight": 0.5507631944287239
      },
      {
        "upstream_id": "node-city-wide-blackout-2",
        "dependent_id": "node-city-wide-blackout-21",
        "weight": 0.6479939438260265
      },
      {
        "upstream_id": "node-city-wide-blackout-8",
        "dependent_id": "node-city-wide-blackout-21",
        "weight": 0.6278758586909461
      },
      {
        "upstream_id": "node-city-wide-blackout-19",
        "dependent_id": "node-city-wide-blackout-22",
        "weight": 0.4355299851332909
      },
      {
        "upstream_id": "node-city-wide-blackout-2",
        "dependent_id": "node-city-wide-blackout-22",
        "weight": 0.670175703369925
      },
      {
        "upstream_id": "node-city-wide-blackout-16",
        "dependent_id": "node-city-wide-blackout-23",
        "weight": 0.849632393126059
      },
      {
        "upstream_id": "node-city-wide-blackout-12",
        "dependent_id": "node-city-wide-blackout-23",
        "weight": 0.7892627249856541
      },
      {
        "upstream_id": "node-city-wide-blackout-23",
        "dependent_id": "node-city-wide-blackout-24",
        "weight": 0.8974037019949086
      },
      {
        "upstream_id": "node-city-wide-blackout-7",
        "dependent_id": "node-city-wide-blackout-24",
        "weight": 0.6093975823586015
      },
      {
        "upstream_id": "node-city-wide-blackout-23",
        "dependent_id": "node-city-wide-blackout-25",
        "weight": 0.780497100611687
      },
      {
        "upstream_id": "node-city-wide-blackout-17",
        "dependent_id": "node-city-wide-blackout-25",
        "weight": 0.7950372970654518
      },
      {
        "upstream_id": "node-city-wide-blackout-1",
        "dependent_id": "node-city-wide-blackout-26",
        "weight": 0.7750227750209797
      },
      {
        "upstream_id": "node-city-wide-blackout-6",
        "dependent_id": "node-city-wide-blackout-27",
        "weight": 0.3939069336434993
      },
      {
        "upstream_id": "node-city-wide-blackout-5",
        "dependent_id": "node-city-wide-blackout-28",
        "weight": 0.4788254631120209
      },
      {
        "upstream_id": "node-city-wide-blackout-14",
        "dependent_id": "node-city-wide-blackout-28",
        "weight": 0.32728101687309974
      },
      {
        "upstream_id": "node-city-wide-blackout-22",
        "dependent_id": "node-city-wide-blackout-29",
        "weight": 0.6011649435705995
      },
      {
        "upstream_id": "node-city-wide-blackout-28",
        "dependent_id": "node-city-wide-blackout-30",
        "weight": 0.9117723477133246
      },
      {
        "upstream_id": "node-city-wide-blackout-22",
        "dependent_id": "node-city-wide-blackout-30",
        "weight": 0.20941711249913175
      },
      {
        "upstream_id": "node-city-wide-blackout-2",
        "dependent_id": "node-city-wide-blackout-31",
        "weight": 0.35554107445490946
      },
      {
        "upstream_id": "node-city-wide-blackout-8",
        "dependent_id": "node-city-wide-blackout-32",
        "weight": 0.5950324143118617
      },
      {
        "upstream_id": "node-city-wide-blackout-15",
        "dependent_id": "node-city-wide-blackout-32",
        "weight": 0.7333173450777608
      },
      {
        "upstream_id": "node-city-wide-blackout-26",
        "dependent_id": "node-city-wide-blackout-33",
        "weight": 0.7335507864837416
      },
      {
        "upstream_id": "node-city-wide-blackout-1",
        "dependent_id": "node-city-wide-blackout-33",
        "weight": 0.7754494210191241
      },
      {
        "upstream_id": "node-city-wide-blackout-14",
        "dependent_id": "node-city-wide-blackout-34",
        "weight": 0.5547093623430528
      },
      {
        "upstream_id": "node-city-wide-blackout-12",
        "dependent_id": "node-city-wide-blackout-35",
        "weight": 0.8072124961377769
      },
      {
        "upstream_id": "node-city-wide-blackout-34",
        "dependent_id": "node-city-wide-blackout-36",
        "weight": 0.46440617439514836
      },
      {
        "upstream_id": "node-city-wide-blackout-4",
        "dependent_id": "node-city-wide-blackout-36",
        "weight": 0.799054860344151
      },
      {
        "upstream_id": "node-city-wide-blackout-30",
        "dependent_id": "node-city-wide-blackout-37",
        "weight": 0.4588971523595121
      },
      {
        "upstream_id": "node-city-wide-blackout-24",
        "dependent_id": "node-city-wide-blackout-38",
        "weight": 0.3337070924878659
      },
      {
        "upstream_id": "node-city-wide-blackout-16",
        "dependent_id": "node-city-wide-blackout-38",
        "weight": 0.6796113062225035
      },
      {
        "upstream_id": "node-city-wide-blackout-0",
        "dependent_id": "node-city-wide-blackout-39",
        "weight": 0.4101744231546392
      },
      {
        "upstream_id": "node-city-wide-blackout-10",
        "dependent_id": "node-city-wide-blackout-40",
        "weight": 0.9020326921382009
      },
      {
        "upstream_id": "node-city-wide-blackout-30",
        "dependent_id": "node-city-wide-blackout-41",
        "weight": 0.4368229365541434
      },
      {
        "upstream_id": "node-city-wide-blackout-22",
        "dependent_id": "node-city-wide-blackout-41",
        "weight": 0.6928627119816815
      },
      {
        "upstream_id": "node-city-wide-blackout-30",
        "dependent_id": "node-city-wide-blackout-42",
        "weight": 0.3249702293135751
      },
      {
        "upstream_id": "node-city-wide-blackout-2",
        "dependent_id": "node-city-wide-blackout-43",
        "weight": 0.38997875292666623
      },
      {
        "upstream_id": "node-city-wide-blackout-24",
        "dependent_id": "node-city-wide-blackout-44",
        "weight": 0.5205095462332835
      },
      {
        "upstream_id": "node-city-wide-blackout-9",
        "dependent_id": "node-city-wide-blackout-44",
        "weight": 0.6455690075682556
      }
    ],
    "initial_disruptions": [
      "node-city-wide-blackout-0"
    ]
  },
  "result": {
    "scenario_id": "city-wide-blackout",
    "seed": 9001,
    "start_time": 0,
    "end_time": 6,
    "snapshots": [
      {
        "time": 0,
        "node_states": {
          "node-city-wide-blackout-0": "failed",
          "node-city-wide-blackout-1": "operational",
          "node-city-wide-blackout-2": "operational",
          "node-city-wide-blackout-3": "operational",
          "node-city-wide-blackout-4": "operational",
          "node-city-wide-blackout-5": "operational",
          "node-city-wide-blackout-6": "operational",
          "node-city-wide-blackout-7": "operational",
          "node-city-wide-blackout-8": "operational",
          "node-city-wide-blackout-9": "operational",
          "node-city-wide-blackout-10": "operational",
          "node-city-wide-blackout-11": "operational",
          "node-city-wide-blackout-12": "operational",
          "node-city-wide-blackout-13": "operational",
          "node-city-wide-blackout-14": "operational",
          "node-city-wide-blackout-15": "operational",
          "node-city-wide-blackout-16": "operational",
          "node-city-wide-blackout-17": "operational",
          "node-city-wide-blackout-18": "operational",
          "node-city-wide-blackout-19": "operational",
          "node-city-wide-blackout-20": "operational",
          "node-city-wide-blackout-21": "operational",
          "node-city-wide-blackout-22": "operational",
          "node-city-wide-blackout-23": "operational",
          "node-city-wide-blackout-24": "operational",
          "node-city-wide-blackout-25": "operational",
          "node-city-wide-blackout-26": "operational",
          "node-city-wide-blackout-27": "operational",
          "node-city-wide-blackout-28": "operational",
          "node-city-wide-blackout-29": "operational",
          "node-city-wide-blackout-30": "operational",
          "node-city-wide-blackout-31": "operational",
          "node-city-wide-blackout-32": "operational",
          "node-city-wide-blackout-33": "operational",
          "node-city-wide-blackout-34": "operational",
          "node-city-wide-blackout-35": "operational",
          "node-city-wide-blackout-36": "operational",
          "node-city-wide-blackout-37": "operational",
          "node-city-wide-blackout-38": "operational",
          "node-city-wide-blackout-39": "operational",
          "node-city-wide-blackout-40": "operational",
          "node-city-wide-blackout-41": "operational",
          "node-city-wide-blackout-42": "operational",
          "node-city-wide-blackout-43": "operational",
          "node-city-wide-blackout-44": "operational"
        }
      },
      {
        "time": 1,
        "node_states": {
          "node-city-wide-blackout-0": "failed",
          "node-city-wide-blackout-1": "failed",
          "node-city-wide-blackout-2": "failed",
          "node-city-wide-blackout-3": "failed",
          "node-city-wide-blackout-4": "operational",
          "node-city-wide-blackout-5": "operational",
          "node-city-wide-blackout-6": "operational",
          "node-city-wide-blackout-7": "degraded",
          "node-city-wide-blackout-8": "failed",
          "node-city-wide-blackout-9": "operational",
          "node-city-wide-blackout-10": "operational",
          "node-city-wide-blackout-11": "operational",
          "node-city-wide-blackout-12": "operational",
          "node-city-wide-blackout-13": "operational",
          "node-city-wide-blackout-14": "operational",
          "node-city-wide-blackout-15": "operational",
          "node-city-wide-blackout-16": "operational",
          "node-city-wide-blackout-17": "operational",
          "node-city-wide-blackout-18": "operational",
          "node-city-wide-blackout-19": "operational",
          "node-city-wide-blackout-20": "operational",
          "node-city-wide-blackout-21": "operational",
          "node-city-wide-blackout-22": "operational",
          "node-city-wide-blackout-23": "operational",
          "node-city-wide-blackout-24": "operational",
          "node-city-wide-blackout-25": "operational",
          "node-city-wide-blackout-26": "operational",
          "node-city-wide-blackout-27": "operational",
          "node-city-wide-blackout-28": "operational",
          "node-city-wide-blackout-29": "operational",
          "node-city-wide-blackout-30": "operational",
          "node-city-wide-blackout-31": "operational",
          "node-city-wide-blackout-32": "operational",
          "node-city-wide-blackout-33": "operational",
          "node-city-wide-blackout-34": "operational",
          "node-city-wide-blackout-35": "operational",
          "node-city-wide-blackout-36": "operational",
          "node-city-wide-blackout-37": "operational",
          "node-city-wide-blackout-38": "operational",
          "node-city-wide-blackout-39": "failed",
          "node-city-wide-blackout-40": "operational",
          "node-city-wide-blackout-41": "operational",
          "node-city-wide-blackout-42": "operational",
          "node-city-wide-blackout-43": "operational",
          "node-city-wide-blackout-44": "operational"
        }
      },
      {
        "time": 2,
        "node_states": {
          "node-city-wide-blackout-0": "failed",
          "node-city-wide-blackout-1": "failed",
          "node-city-wide-blackout-2": "failed",
          "node-city-wide-blackout-3": "failed",
          "node-city-wide-blackout-4": "failed",
          "node-city-wide-blackout-5": "failed",
          "node-city-wide-blackout-6": "failed",
          "node-city-wide-blackout-7": "degraded",
          "node-city-wide-blackout-8": "failed",
          "node-city-wide-blackout-9": "failed",
          "node-city-wide-blackout-10": "failed",
          "node-city-wide-blackout-11": "operational",
          "node-city-wide-blackout-12": "failed",
          "node-city-wide-blackout-13": "failed",
          "node-city-wide-blackout-14": "failed",
          "node-city-wide-blackout-15": "failed",
          "node-city-wide-blackout-16": "operational",
          "node-city-wide-blackout-17": "operational",
          "node-city-wide-blackout-18": "operational",
          "node-city-wide-blackout-19": "operational",
          "node-city-wide-blackout-20": "degraded",
          "node-city-wide-blackout-21": "failed",
          "node-city-wide-blackout-22": "degraded",
          "node-city-wide-blackout-23": "operational",
          "node-city-wide-blackout-24": "degraded",
          "node-city-wide-blackout-25": "operational",
          "node-city-wide-blackout-26": "failed",
          "node-city-wide-blackout-27": "operational",
          "node-city-wide-blackout-28": "operational",
          "node-city-wide-blackout-29": "operational",
          "node-city-wide-blackout-30": "operational",
          "node-city-wide-blackout-31": "failed",
          "node-city-wide-blackout-32": "degraded",
          "node-city-wide-blackout-33": "degraded",
          "node-city-wide-blackout-34": "operational",
          "node-city-wide-blackout-35": "operational",
          "node-city-wide-blackout-36": "operational",
          "node-city-wide-blackout-37": "operational",
          "node-city-wide-blackout-38": "operational",
          "node-city-wide-blackout-39": "failed",
          "node-city-wide-blackout-40": "operational",
          "node-city-wide-blackout-41": "operational",
          "node-city-wide-blackout-42": "operational",
          "node-city-wide-blackout-43": "failed",
          "node-city-wide-blackout-44": "operational"
        }
      },
      {
        "time": 3,
        "node_states": {
          "node-city-wide-blackout-0": "failed",
          "node-city-wide-blackout-1": "failed",
          "node-city-wide-blackout-2": "failed",
          "node-city-wide-blackout-3": "failed",
          "node-city-wide-blackout-4": "failed",
          "node-city-wide-blackout-5": "failed",
          "node-city-wide-blackout-6": "failed",
          "node-city-wide-blackout-7": "failed",
          "node-city-wide-blackout-8": "failed",
          "node-city-wide-blackout-9": "failed",
          "node-city-wide-blackout-10": "failed",
          "node-city-wide-blackout-11": "failed",
          "node-city-wide-blackout-12": "failed",
          "node-city-wide-blackout-13": "failed",
          "node-city-wide-blackout-14": "failed",
          "node-city-wide-blackout-15": "failed",
          "node-city-wide-blackout-16": "operational",
          "node-city-wide-blackout-17": "failed",
          "node-city-wide-blackout-18": "failed",
          "node-city-wide-blackout-19": "operational",
          "node-city-wide-blackout-20": "failed",
          "node-city-wide-blackout-21": "failed",
          "node-city-wide-blackout-22": "degraded",
          "node-city-wide-blackout-23": "degraded",
          "node-city-wide-blackout-24": "degraded",
          "node-city-wide-blackout-25": "operational",
          "node-city-wide-blackout-26": "failed",
          "node-city-wide-blackout-27": "failed",
          "node-city-wide-blackout-28": "failed",
          "node-city-wide-blackout-29": "failed",
          "node-city-wide-blackout-30": "operational",
          "node-city-wide-blackout-31": "failed",
          "node-city-wide-blackout-32": "failed",
          "node-city-wide-blackout-33": "failed",
          "node-city-wide-blackout-34": "failed",
          "node-city-wide-blackout-35": "failed",
          "node-city-wide-blackout-36": "degraded",
          "node-city-wide-blackout-37": "operational",
          "node-city-wide-blackout-38": "operational",
          "node-city-wide-blackout-39": "failed",
          "node-city-wide-blackout-40": "failed",
          "node-city-wide-blackout-41": "degraded",
          "node-city-wide-blackout-42": "operational",
          "node-city-wide-blackout-43": "failed",
          "node-city-wide-blackout-44": "failed"
        }
      },
      {
        "time": 4,
        "node_states": {
          "node-city-wide-blackout-0": "failed",
          "node-city-wide-blackout-1": "failed",
          "node-city-wide-blackout-2": "failed",
          "node-city-wide-blackout-3": "failed",
          "node-city-wide-blackout-4": "failed",
          "node-city-wide-blackout-5": "failed",
          "node-city-wide-blackout-6": "failed",
          "node-city-wide-blackout-7": "failed",
          "node-city-wide-blackout-8": "failed",
          "node-city-wide-blackout-9": "failed",
          "node-city-wide-blackout-10": "failed",
          "node-city-wide-blackout-11": "failed",
          "node-city-wide-blackout-12": "failed",
          "node-city-wide-blackout-13": "failed",
          "node-city-wide-blackout-14": "failed",
          "node-city-wide-blackout-15": "failed",
          "node-city-wide-blackout-16": "failed",
          "node-city-wide-blackout-17": "failed",
          "node-city-wide-blackout-18": "failed",
          "node-city-wide-blackout-19": "failed",
          "node-city-wide-blackout-20": "failed",
          "node-city-wide-blackout-21": "failed",
          "node-city-wide-blackout-22": "degraded",
          "node-city-wide-blackout-23": "degraded",
          "node-city-wide-blackout-24": "failed",
          "node-city-wide-blackout-25": "failed",
          "node-city-wide-blackout-26": "failed",
          "node-city-wide-blackout-27": "failed",
          "node-city-wide-blackout-28": "failed",
          "node-city-wide-blackout-29": "failed",
          "node-city-wide-blackout-30": "failed",
          "node-city-wide-blackout-31": "failed",
          "node-city-wide-blackout-32": "failed",
          "node-city-wide-blackout-33": "failed",
          "node-city-wide-blackout-34": "failed",
          "node-city-wide-blackout-35": "failed",
          "node-city-wide-blackout-36": "failed",
          "node-city-wide-blackout-37": "operational",
          "node-city-wide-blackout-38": "operational",
          "node-city-wide-blackout-39": "failed",
          "node-city-wide-blackout-40": "failed",
          "node-city-wide-blackout-41": "degraded",
          "node-city-wide-blackout-42": "operational",
          "node-city-wide-blackout-43": "failed",
          "node-city-wide-blackout-44": "failed"
        }
      },
      {
        "time": 5,
        "node_states": {
          "node-city-wide-blackout-0": "failed",
          "node-city-wide-blackout-1": "failed",
          "node-city-wide-blackout-2": "failed",
          "node-city-wide-blackout-3": "failed",
          "node-city-wide-blackout-4": "failed",
          "node-city-wide-blackout-5": "failed",
          "node-city-wide-blackout-6": "failed",
          "node-city-wide-blackout-7": "failed",
          "node-city-wide-blackout-8": "failed",
          "node-city-wide-blackout-9": "failed",
          "node-city-wide-blackout-10": "failed",
          "node-city-wide-blackout-11": "failed",
          "node-city-wide-blackout-12": "failed",
          "node-city-wide-blackout-13": "failed",
          "node-city-wide-blackout-14": "failed",
          "node-city-wide-blackout-15": "failed",
          "node-city-wide-blackout-16": "failed",
          "node-city-wide-blackout-17": "failed",
          "node-city-wide-blackout-18": "failed",
          "node-city-wide-blackout-19": "failed",
          "node-city-wide-blackout-20": "failed",
          "node-city-wide-blackout-21": "failed",
          "node-city-wide-blackout-22": "failed",
          "node-city-wide-blackout-23": "failed",
          "node-city-wide-blackout-24": "failed",
          "node-city-wide-blackout-25": "failed",
          "node-city-wide-blackout-26": "failed",
          "node-city-wide-blackout-27": "failed",
          "node-city-wide-blackout-28": "failed",
          "node-city-wide-blackout-29": "failed",
          "node-city-wide-blackout-30": "failed",
          "node-city-wide-blackout-31": "failed",
          "node-city-wide-blackout-32": "failed",
          "node-city-wide-blackout-33": "failed",
          "node-city-wide-blackout-34": "failed",
          "node-city-wide-blackout-35": "failed",
          "node-city-wide-blackout-36": "failed",
          "node-city-wide-blackout-37": "failed",
          "node-city-wide-blackout-38": "failed",
          "node-city-wide-blackout-39": "failed",
          "node-city-wide-blackout-40": "failed",
          "node-city-wide-blackout-41": "failed",
          "node-city-wide-blackout-42": "failed",
          "node-city-wide-blackout-43": "failed",
          "node-city-wide-blackout-44": "failed"
        }
      },
      {
        "time": 6,
        "node_states": {
          "node-city-wide-blackout-0": "failed",
          "node-city-wide-blackout-1": "failed",
          "node-city-wide-blackout-2": "failed",
          "node-city-wide-blackout-3": "failed",
          "node-city-wide-blackout-4": "failed",
          "node-city-wide-blackout-5": "failed",
          "node-city-wide-blackout-6": "failed",
          "node-city-wide-blackout-7": "failed",
          "node-city-wide-blackout-8": "failed",
          "node-city-wide-blackout-9": "failed",
          "node-city-wide-blackout-10": "failed",
          "node-city-wide-blackout-11": "failed",
          "node-city-wide-blackout-12": "failed",
          "node-city-wide-blackout-13": "failed",
          "node-city-wide-blackout-14": "failed",
          "node-city-wide-blackout-15": "failed",
          "node-city-wide-blackout-16": "failed",
          "node-city-wide-blackout-17": "failed",
          "node-city-wide-blackout-18": "failed",
          "node-city-wide-blackout-19": "failed",
          "node-city-wide-blackout-20": "failed",
          "node-city-wide-blackout-21": "failed",
          "node-city-wide-blackout-22": "failed",
          "node-city-wide-blackout-23": "failed",
          "node-city-wide-blackout-24": "failed",
          "node-city-wide-blackout-25": "failed",
          "node-city-wide-blackout-26": "failed",
          "node-city-wide-blackout-27": "failed",
          "node-city-wide-blackout-28": "failed",
          "node-city-wide-blackout-29": "failed",
          "node-city-wide-blackout-30": "failed",
          "node-city-wide-blackout-31": "failed",
          "node-city-wide-blackout-32": "failed",
          "node-city-wide-blackout-33": "failed",
          "node-city-wide-blackout-34": "failed",
          "node-city-wide-blackout-35": "failed",
          "node-city-wide-blackout-36": "failed",
          "node-city-wide-blackout-37": "failed",
          "node-city-wide-blackout-38": "failed",
          "node-city-wide-blackout-39": "failed",
          "node-city-wide-blackout-40": "failed",
          "node-city-wide-blackout-41": "failed",
          "node-city-wide-blackout-42": "failed",
          "node-city-wide-blackout-43": "failed",
          "node-city-wide-blackout-44": "failed"
        }
      }
    ],
    "events": [
      {
        "time": 0,
        "node_id": "node-city-wide-blackout-0",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "initial_shock",
        "source_node_id": null
      },
      {
        "time": 1,
        "node_id": "node-city-wide-blackout-1",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-0"
      },
      {
        "time": 1,
        "node_id": "node-city-wide-blackout-2",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-0"
      },
      {
        "time": 1,
        "node_id": "node-city-wide-blackout-3",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-0"
      },
      {
        "time": 1,
        "node_id": "node-city-wide-blackout-7",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-city-wide-blackout-0"
      },
      {
        "time": 1,
        "node_id": "node-city-wide-blackout-8",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-0"
      },
      {
        "time": 1,
        "node_id": "node-city-wide-blackout-39",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-0"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-4",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-3"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-5",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-2"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-6",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-2"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-9",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-2"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-10",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-8"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-12",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-3"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-13",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-1"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-14",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-7"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-15",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-3"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-20",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-city-wide-blackout-2"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-21",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-2"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-22",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-city-wide-blackout-2"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-24",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-city-wide-blackout-7"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-26",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-1"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-31",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-2"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-32",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-city-wide-blackout-8"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-33",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-city-wide-blackout-1"
      },
      {
        "time": 2,
        "node_id": "node-city-wide-blackout-43",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-2"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-7",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-5"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-11",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-5"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-17",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-5"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-18",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-15"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-20",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-2"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-23",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-city-wide-blackout-12"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-27",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-6"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-28",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-5"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-29",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-22"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-32",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-8"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-33",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-26"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-34",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-14"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-35",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-12"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-36",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-city-wide-blackout-4"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-40",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-10"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-41",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-city-wide-blackout-22"
      },
      {
        "time": 3,
        "node_id": "node-city-wide-blackout-44",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-24"
      },
      {
        "time": 4,
        "node_id": "node-city-wide-blackout-16",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-11"
      },
      {
        "time": 4,
        "node_id": "node-city-wide-blackout-19",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-17"
      },
      {
        "time": 4,
        "node_id": "node-city-wide-blackout-24",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-23"
      },
      {
        "time": 4,
        "node_id": "node-city-wide-blackout-25",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-23"
      },
      {
        "time": 4,
        "node_id": "node-city-wide-blackout-30",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-28"
      },
      {
        "time": 4,
        "node_id": "node-city-wide-blackout-36",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-34"
      },
      {
        "time": 5,
        "node_id": "node-city-wide-blackout-22",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-19"
      },
      {
        "time": 5,
        "node_id": "node-city-wide-blackout-23",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-16"
      },
      {
        "time": 5,
        "node_id": "node-city-wide-blackout-37",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-30"
      },
      {
        "time": 5,
        "node_id": "node-city-wide-blackout-38",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-24"
      },
      {
        "time": 5,
        "node_id": "node-city-wide-blackout-41",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-30"
      },
      {
        "time": 5,
        "node_id": "node-city-wide-blackout-42",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-city-wide-blackout-30"
      }
    ]
  }
},
  'rolling-recovery': {
  "scenario": {
    "id": "rolling-recovery",
    "name": "Rolling Recovery",
    "description": "Generated large scenario with 40 nodes",
    "graph_id": "large-graph-v1",
    "nodes": [
      {
        "id": "node-rolling-recovery-0",
        "name": "Facility 0 (rolling-recovery)",
        "service_type": "communications",
        "failure_threshold": 0.7300609890881016
      },
      {
        "id": "node-rolling-recovery-1",
        "name": "Facility 1 (rolling-recovery)",
        "service_type": "transport",
        "failure_threshold": 0.642080322425225
      },
      {
        "id": "node-rolling-recovery-2",
        "name": "Facility 2 (rolling-recovery)",
        "service_type": "transport",
        "failure_threshold": 0.7800985607122526
      },
      {
        "id": "node-rolling-recovery-3",
        "name": "Facility 3 (rolling-recovery)",
        "service_type": "transport",
        "failure_threshold": 0.8015472313986655
      },
      {
        "id": "node-rolling-recovery-4",
        "name": "Facility 4 (rolling-recovery)",
        "service_type": "power",
        "failure_threshold": 0.5438904653997427
      },
      {
        "id": "node-rolling-recovery-5",
        "name": "Facility 5 (rolling-recovery)",
        "service_type": "communications",
        "failure_threshold": 0.5420062225248294
      },
      {
        "id": "node-rolling-recovery-6",
        "name": "Facility 6 (rolling-recovery)",
        "service_type": "healthcare",
        "failure_threshold": 0.5151844593677514
      },
      {
        "id": "node-rolling-recovery-7",
        "name": "Facility 7 (rolling-recovery)",
        "service_type": "communications",
        "failure_threshold": 0.6537280349257892
      },
      {
        "id": "node-rolling-recovery-8",
        "name": "Facility 8 (rolling-recovery)",
        "service_type": "power",
        "failure_threshold": 0.8528468008402544
      },
      {
        "id": "node-rolling-recovery-9",
        "name": "Facility 9 (rolling-recovery)",
        "service_type": "communications",
        "failure_threshold": 0.8032337564783261
      },
      {
        "id": "node-rolling-recovery-10",
        "name": "Facility 10 (rolling-recovery)",
        "service_type": "healthcare",
        "failure_threshold": 0.5889385481027921
      },
      {
        "id": "node-rolling-recovery-11",
        "name": "Facility 11 (rolling-recovery)",
        "service_type": "power",
        "failure_threshold": 0.8895140144788936
      },
      {
        "id": "node-rolling-recovery-12",
        "name": "Facility 12 (rolling-recovery)",
        "service_type": "healthcare",
        "failure_threshold": 0.6247011276510642
      },
      {
        "id": "node-rolling-recovery-13",
        "name": "Facility 13 (rolling-recovery)",
        "service_type": "transport",
        "failure_threshold": 0.8568142182947371
      },
      {
        "id": "node-rolling-recovery-14",
        "name": "Facility 14 (rolling-recovery)",
        "service_type": "power",
        "failure_threshold": 0.8955448989581642
      },
      {
        "id": "node-rolling-recovery-15",
        "name": "Facility 15 (rolling-recovery)",
        "service_type": "transport",
        "failure_threshold": 0.8507581438231102
      },
      {
        "id": "node-rolling-recovery-16",
        "name": "Facility 16 (rolling-recovery)",
        "service_type": "water",
        "failure_threshold": 0.6049078622468937
      },
      {
        "id": "node-rolling-recovery-17",
        "name": "Facility 17 (rolling-recovery)",
        "service_type": "power",
        "failure_threshold": 0.6431413794124061
      },
      {
        "id": "node-rolling-recovery-18",
        "name": "Facility 18 (rolling-recovery)",
        "service_type": "power",
        "failure_threshold": 0.6324807380049029
      },
      {
        "id": "node-rolling-recovery-19",
        "name": "Facility 19 (rolling-recovery)",
        "service_type": "healthcare",
        "failure_threshold": 0.7780978418087442
      },
      {
        "id": "node-rolling-recovery-20",
        "name": "Facility 20 (rolling-recovery)",
        "service_type": "water",
        "failure_threshold": 0.6106949163067532
      },
      {
        "id": "node-rolling-recovery-21",
        "name": "Facility 21 (rolling-recovery)",
        "service_type": "power",
        "failure_threshold": 0.7949356029247616
      },
      {
        "id": "node-rolling-recovery-22",
        "name": "Facility 22 (rolling-recovery)",
        "service_type": "communications",
        "failure_threshold": 0.8813072169567406
      },
      {
        "id": "node-rolling-recovery-23",
        "name": "Facility 23 (rolling-recovery)",
        "service_type": "water",
        "failure_threshold": 0.6130307865981056
      },
      {
        "id": "node-rolling-recovery-24",
        "name": "Facility 24 (rolling-recovery)",
        "service_type": "healthcare",
        "failure_threshold": 0.6797725967877115
      },
      {
        "id": "node-rolling-recovery-25",
        "name": "Facility 25 (rolling-recovery)",
        "service_type": "communications",
        "failure_threshold": 0.8082177988534467
      },
      {
        "id": "node-rolling-recovery-26",
        "name": "Facility 26 (rolling-recovery)",
        "service_type": "water",
        "failure_threshold": 0.8641403234577425
      },
      {
        "id": "node-rolling-recovery-27",
        "name": "Facility 27 (rolling-recovery)",
        "service_type": "healthcare",
        "failure_threshold": 0.6772244046815316
      },
      {
        "id": "node-rolling-recovery-28",
        "name": "Facility 28 (rolling-recovery)",
        "service_type": "healthcare",
        "failure_threshold": 0.8506449806093708
      },
      {
        "id": "node-rolling-recovery-29",
        "name": "Facility 29 (rolling-recovery)",
        "service_type": "water",
        "failure_threshold": 0.8945493920480321
      },
      {
        "id": "node-rolling-recovery-30",
        "name": "Facility 30 (rolling-recovery)",
        "service_type": "transport",
        "failure_threshold": 0.7978859170825994
      },
      {
        "id": "node-rolling-recovery-31",
        "name": "Facility 31 (rolling-recovery)",
        "service_type": "water",
        "failure_threshold": 0.733484902446374
      },
      {
        "id": "node-rolling-recovery-32",
        "name": "Facility 32 (rolling-recovery)",
        "service_type": "communications",
        "failure_threshold": 0.8555007512402673
      },
      {
        "id": "node-rolling-recovery-33",
        "name": "Facility 33 (rolling-recovery)",
        "service_type": "water",
        "failure_threshold": 0.5816596665595137
      },
      {
        "id": "node-rolling-recovery-34",
        "name": "Facility 34 (rolling-recovery)",
        "service_type": "water",
        "failure_threshold": 0.6255624399480664
      },
      {
        "id": "node-rolling-recovery-35",
        "name": "Facility 35 (rolling-recovery)",
        "service_type": "water",
        "failure_threshold": 0.6810372566957361
      },
      {
        "id": "node-rolling-recovery-36",
        "name": "Facility 36 (rolling-recovery)",
        "service_type": "transport",
        "failure_threshold": 0.8534104070014741
      },
      {
        "id": "node-rolling-recovery-37",
        "name": "Facility 37 (rolling-recovery)",
        "service_type": "power",
        "failure_threshold": 0.7247622778099958
      },
      {
        "id": "node-rolling-recovery-38",
        "name": "Facility 38 (rolling-recovery)",
        "service_type": "transport",
        "failure_threshold": 0.5283277513093602
      },
      {
        "id": "node-rolling-recovery-39",
        "name": "Facility 39 (rolling-recovery)",
        "service_type": "communications",
        "failure_threshold": 0.6387801019855791
      }
    ],
    "edges": [
      {
        "upstream_id": "node-rolling-recovery-0",
        "dependent_id": "node-rolling-recovery-1",
        "weight": 0.3881445146912937
      },
      {
        "upstream_id": "node-rolling-recovery-1",
        "dependent_id": "node-rolling-recovery-2",
        "weight": 0.7811454626619596
      },
      {
        "upstream_id": "node-rolling-recovery-0",
        "dependent_id": "node-rolling-recovery-3",
        "weight": 0.4606972150431099
      },
      {
        "upstream_id": "node-rolling-recovery-1",
        "dependent_id": "node-rolling-recovery-4",
        "weight": 0.7488258958881603
      },
      {
        "upstream_id": "node-rolling-recovery-0",
        "dependent_id": "node-rolling-recovery-5",
        "weight": 0.3176195633565101
      },
      {
        "upstream_id": "node-rolling-recovery-4",
        "dependent_id": "node-rolling-recovery-6",
        "weight": 0.5637485273304133
      },
      {
        "upstream_id": "node-rolling-recovery-1",
        "dependent_id": "node-rolling-recovery-6",
        "weight": 0.40765461186295204
      },
      {
        "upstream_id": "node-rolling-recovery-5",
        "dependent_id": "node-rolling-recovery-7",
        "weight": 0.5649025811589421
      },
      {
        "upstream_id": "node-rolling-recovery-3",
        "dependent_id": "node-rolling-recovery-8",
        "weight": 0.913849760097053
      },
      {
        "upstream_id": "node-rolling-recovery-1",
        "dependent_id": "node-rolling-recovery-9",
        "weight": 0.6749718102845268
      },
      {
        "upstream_id": "node-rolling-recovery-4",
        "dependent_id": "node-rolling-recovery-9",
        "weight": 0.4644988310199282
      },
      {
        "upstream_id": "node-rolling-recovery-3",
        "dependent_id": "node-rolling-recovery-10",
        "weight": 0.423779972437378
      },
      {
        "upstream_id": "node-rolling-recovery-8",
        "dependent_id": "node-rolling-recovery-10",
        "weight": 0.27230869888827147
      },
      {
        "upstream_id": "node-rolling-recovery-1",
        "dependent_id": "node-rolling-recovery-11",
        "weight": 0.686531663383525
      },
      {
        "upstream_id": "node-rolling-recovery-4",
        "dependent_id": "node-rolling-recovery-12",
        "weight": 0.8755405858045957
      },
      {
        "upstream_id": "node-rolling-recovery-11",
        "dependent_id": "node-rolling-recovery-13",
        "weight": 0.546602034704758
      },
      {
        "upstream_id": "node-rolling-recovery-5",
        "dependent_id": "node-rolling-recovery-13",
        "weight": 0.3629040412516026
      },
      {
        "upstream_id": "node-rolling-recovery-9",
        "dependent_id": "node-rolling-recovery-14",
        "weight": 0.9214026154378703
      },
      {
        "upstream_id": "node-rolling-recovery-12",
        "dependent_id": "node-rolling-recovery-14",
        "weight": 0.46128137841997435
      },
      {
        "upstream_id": "node-rolling-recovery-14",
        "dependent_id": "node-rolling-recovery-15",
        "weight": 0.43288456573872325
      },
      {
        "upstream_id": "node-rolling-recovery-0",
        "dependent_id": "node-rolling-recovery-16",
        "weight": 0.3497987510074341
      },
      {
        "upstream_id": "node-rolling-recovery-15",
        "dependent_id": "node-rolling-recovery-17",
        "weight": 0.9386148292588219
      },
      {
        "upstream_id": "node-rolling-recovery-13",
        "dependent_id": "node-rolling-recovery-17",
        "weight": 0.503866603533162
      },
      {
        "upstream_id": "node-rolling-recovery-2",
        "dependent_id": "node-rolling-recovery-18",
        "weight": 0.49056516456182336
      },
      {
        "upstream_id": "node-rolling-recovery-8",
        "dependent_id": "node-rolling-recovery-19",
        "weight": 0.8172778141683454
      },
      {
        "upstream_id": "node-rolling-recovery-7",
        "dependent_id": "node-rolling-recovery-20",
        "weight": 0.8811709847995322
      },
      {
        "upstream_id": "node-rolling-recovery-14",
        "dependent_id": "node-rolling-recovery-21",
        "weight": 0.776481230607638
      },
      {
        "upstream_id": "node-rolling-recovery-2",
        "dependent_id": "node-rolling-recovery-22",
        "weight": 0.9558589627835952
      },
      {
        "upstream_id": "node-rolling-recovery-1",
        "dependent_id": "node-rolling-recovery-23",
        "weight": 0.94572972290794
      },
      {
        "upstream_id": "node-rolling-recovery-9",
        "dependent_id": "node-rolling-recovery-23",
        "weight": 0.7789395135130941
      },
      {
        "upstream_id": "node-rolling-recovery-4",
        "dependent_id": "node-rolling-recovery-24",
        "weight": 0.45133757635738936
      },
      {
        "upstream_id": "node-rolling-recovery-9",
        "dependent_id": "node-rolling-recovery-24",
        "weight": 0.5066671746630966
      },
      {
        "upstream_id": "node-rolling-recovery-23",
        "dependent_id": "node-rolling-recovery-25",
        "weight": 0.8018431615533781
      },
      {
        "upstream_id": "node-rolling-recovery-9",
        "dependent_id": "node-rolling-recovery-26",
        "weight": 0.41321985927885635
      },
      {
        "upstream_id": "node-rolling-recovery-18",
        "dependent_id": "node-rolling-recovery-27",
        "weight": 0.8439928898202902
      },
      {
        "upstream_id": "node-rolling-recovery-1",
        "dependent_id": "node-rolling-recovery-27",
        "weight": 0.23367345382764504
      },
      {
        "upstream_id": "node-rolling-recovery-5",
        "dependent_id": "node-rolling-recovery-28",
        "weight": 0.7363322893419719
      },
      {
        "upstream_id": "node-rolling-recovery-4",
        "dependent_id": "node-rolling-recovery-29",
        "weight": 0.7529066008130582
      },
      {
        "upstream_id": "node-rolling-recovery-7",
        "dependent_id": "node-rolling-recovery-29",
        "weight": 0.5007895817344876
      },
      {
        "upstream_id": "node-rolling-recovery-9",
        "dependent_id": "node-rolling-recovery-30",
        "weight": 0.5789517537361442
      },
      {
        "upstream_id": "node-rolling-recovery-15",
        "dependent_id": "node-rolling-recovery-30",
        "weight": 0.657895202936398
      },
      {
        "upstream_id": "node-rolling-recovery-0",
        "dependent_id": "node-rolling-recovery-31",
        "weight": 0.6297117244891305
      },
      {
        "upstream_id": "node-rolling-recovery-1",
        "dependent_id": "node-rolling-recovery-31",
        "weight": 0.6831941332612856
      },
      {
        "upstream_id": "node-rolling-recovery-12",
        "dependent_id": "node-rolling-recovery-32",
        "weight": 0.3098821988680963
      },
      {
        "upstream_id": "node-rolling-recovery-31",
        "dependent_id": "node-rolling-recovery-33",
        "weight": 0.42215898052493267
      },
      {
        "upstream_id": "node-rolling-recovery-18",
        "dependent_id": "node-rolling-recovery-33",
        "weight": 0.3451541646028279
      },
      {
        "upstream_id": "node-rolling-recovery-11",
        "dependent_id": "node-rolling-recovery-34",
        "weight": 0.8141949846898557
      },
      {
        "upstream_id": "node-rolling-recovery-3",
        "dependent_id": "node-rolling-recovery-35",
        "weight": 0.8541171520195601
      },
      {
        "upstream_id": "node-rolling-recovery-18",
        "dependent_id": "node-rolling-recovery-35",
        "weight": 0.5962540351219552
      },
      {
        "upstream_id": "node-rolling-recovery-12",
        "dependent_id": "node-rolling-recovery-36",
        "weight": 0.645456385074233
      },
      {
        "upstream_id": "node-rolling-recovery-5",
        "dependent_id": "node-rolling-recovery-36",
        "weight": 0.7555677038058666
      },
      {
        "upstream_id": "node-rolling-recovery-33",
        "dependent_id": "node-rolling-recovery-37",
        "weight": 0.9622685763902696
      },
      {
        "upstream_id": "node-rolling-recovery-21",
        "dependent_id": "node-rolling-recovery-37",
        "weight": 0.6495595960196852
      },
      {
        "upstream_id": "node-rolling-recovery-14",
        "dependent_id": "node-rolling-recovery-38",
        "weight": 0.7871772105378179
      },
      {
        "upstream_id": "node-rolling-recovery-27",
        "dependent_id": "node-rolling-recovery-38",
        "weight": 0.5675408665337177
      },
      {
        "upstream_id": "node-rolling-recovery-17",
        "dependent_id": "node-rolling-recovery-39",
        "weight": 0.7437583368309316
      }
    ],
    "initial_disruptions": [
      "node-rolling-recovery-0"
    ]
  },
  "result": {
    "scenario_id": "rolling-recovery",
    "seed": 9002,
    "start_time": 0,
    "end_time": 11,
    "snapshots": [
      {
        "time": 0,
        "node_states": {
          "node-rolling-recovery-0": "failed",
          "node-rolling-recovery-1": "operational",
          "node-rolling-recovery-2": "operational",
          "node-rolling-recovery-3": "operational",
          "node-rolling-recovery-4": "operational",
          "node-rolling-recovery-5": "operational",
          "node-rolling-recovery-6": "operational",
          "node-rolling-recovery-7": "operational",
          "node-rolling-recovery-8": "operational",
          "node-rolling-recovery-9": "operational",
          "node-rolling-recovery-10": "operational",
          "node-rolling-recovery-11": "operational",
          "node-rolling-recovery-12": "operational",
          "node-rolling-recovery-13": "operational",
          "node-rolling-recovery-14": "operational",
          "node-rolling-recovery-15": "operational",
          "node-rolling-recovery-16": "operational",
          "node-rolling-recovery-17": "operational",
          "node-rolling-recovery-18": "operational",
          "node-rolling-recovery-19": "operational",
          "node-rolling-recovery-20": "operational",
          "node-rolling-recovery-21": "operational",
          "node-rolling-recovery-22": "operational",
          "node-rolling-recovery-23": "operational",
          "node-rolling-recovery-24": "operational",
          "node-rolling-recovery-25": "operational",
          "node-rolling-recovery-26": "operational",
          "node-rolling-recovery-27": "operational",
          "node-rolling-recovery-28": "operational",
          "node-rolling-recovery-29": "operational",
          "node-rolling-recovery-30": "operational",
          "node-rolling-recovery-31": "operational",
          "node-rolling-recovery-32": "operational",
          "node-rolling-recovery-33": "operational",
          "node-rolling-recovery-34": "operational",
          "node-rolling-recovery-35": "operational",
          "node-rolling-recovery-36": "operational",
          "node-rolling-recovery-37": "operational",
          "node-rolling-recovery-38": "operational",
          "node-rolling-recovery-39": "operational"
        }
      },
      {
        "time": 1,
        "node_states": {
          "node-rolling-recovery-0": "failed",
          "node-rolling-recovery-1": "failed",
          "node-rolling-recovery-2": "operational",
          "node-rolling-recovery-3": "failed",
          "node-rolling-recovery-4": "operational",
          "node-rolling-recovery-5": "failed",
          "node-rolling-recovery-6": "operational",
          "node-rolling-recovery-7": "operational",
          "node-rolling-recovery-8": "operational",
          "node-rolling-recovery-9": "operational",
          "node-rolling-recovery-10": "operational",
          "node-rolling-recovery-11": "operational",
          "node-rolling-recovery-12": "operational",
          "node-rolling-recovery-13": "operational",
          "node-rolling-recovery-14": "operational",
          "node-rolling-recovery-15": "operational",
          "node-rolling-recovery-16": "failed",
          "node-rolling-recovery-17": "operational",
          "node-rolling-recovery-18": "operational",
          "node-rolling-recovery-19": "operational",
          "node-rolling-recovery-20": "operational",
          "node-rolling-recovery-21": "operational",
          "node-rolling-recovery-22": "operational",
          "node-rolling-recovery-23": "operational",
          "node-rolling-recovery-24": "operational",
          "node-rolling-recovery-25": "operational",
          "node-rolling-recovery-26": "operational",
          "node-rolling-recovery-27": "operational",
          "node-rolling-recovery-28": "operational",
          "node-rolling-recovery-29": "operational",
          "node-rolling-recovery-30": "operational",
          "node-rolling-recovery-31": "degraded",
          "node-rolling-recovery-32": "operational",
          "node-rolling-recovery-33": "operational",
          "node-rolling-recovery-34": "operational",
          "node-rolling-recovery-35": "operational",
          "node-rolling-recovery-36": "operational",
          "node-rolling-recovery-37": "operational",
          "node-rolling-recovery-38": "operational",
          "node-rolling-recovery-39": "operational"
        }
      },
      {
        "time": 2,
        "node_states": {
          "node-rolling-recovery-0": "failed",
          "node-rolling-recovery-1": "failed",
          "node-rolling-recovery-2": "failed",
          "node-rolling-recovery-3": "failed",
          "node-rolling-recovery-4": "failed",
          "node-rolling-recovery-5": "failed",
          "node-rolling-recovery-6": "degraded",
          "node-rolling-recovery-7": "failed",
          "node-rolling-recovery-8": "failed",
          "node-rolling-recovery-9": "degraded",
          "node-rolling-recovery-10": "failed",
          "node-rolling-recovery-11": "failed",
          "node-rolling-recovery-12": "operational",
          "node-rolling-recovery-13": "operational",
          "node-rolling-recovery-14": "operational",
          "node-rolling-recovery-15": "operational",
          "node-rolling-recovery-16": "failed",
          "node-rolling-recovery-17": "operational",
          "node-rolling-recovery-18": "operational",
          "node-rolling-recovery-19": "operational",
          "node-rolling-recovery-20": "operational",
          "node-rolling-recovery-21": "operational",
          "node-rolling-recovery-22": "operational",
          "node-rolling-recovery-23": "degraded",
          "node-rolling-recovery-24": "operational",
          "node-rolling-recovery-25": "operational",
          "node-rolling-recovery-26": "operational",
          "node-rolling-recovery-27": "operational",
          "node-rolling-recovery-28": "failed",
          "node-rolling-recovery-29": "operational",
          "node-rolling-recovery-30": "operational",
          "node-rolling-recovery-31": "failed",
          "node-rolling-recovery-32": "operational",
          "node-rolling-recovery-33": "degraded",
          "node-rolling-recovery-34": "operational",
          "node-rolling-recovery-35": "degraded",
          "node-rolling-recovery-36": "degraded",
          "node-rolling-recovery-37": "operational",
          "node-rolling-recovery-38": "operational",
          "node-rolling-recovery-39": "operational"
        }
      },
      {
        "time": 3,
        "node_states": {
          "node-rolling-recovery-0": "failed",
          "node-rolling-recovery-1": "failed",
          "node-rolling-recovery-2": "failed",
          "node-rolling-recovery-3": "failed",
          "node-rolling-recovery-4": "failed",
          "node-rolling-recovery-5": "failed",
          "node-rolling-recovery-6": "failed",
          "node-rolling-recovery-7": "failed",
          "node-rolling-recovery-8": "failed",
          "node-rolling-recovery-9": "failed",
          "node-rolling-recovery-10": "failed",
          "node-rolling-recovery-11": "failed",
          "node-rolling-recovery-12": "failed",
          "node-rolling-recovery-13": "failed",
          "node-rolling-recovery-14": "degraded",
          "node-rolling-recovery-15": "operational",
          "node-rolling-recovery-16": "failed",
          "node-rolling-recovery-17": "operational",
          "node-rolling-recovery-18": "failed",
          "node-rolling-recovery-19": "failed",
          "node-rolling-recovery-20": "failed",
          "node-rolling-recovery-21": "operational",
          "node-rolling-recovery-22": "failed",
          "node-rolling-recovery-23": "failed",
          "node-rolling-recovery-24": "failed",
          "node-rolling-recovery-25": "failed",
          "node-rolling-recovery-26": "failed",
          "node-rolling-recovery-27": "operational",
          "node-rolling-recovery-28": "failed",
          "node-rolling-recovery-29": "failed",
          "node-rolling-recovery-30": "degraded",
          "node-rolling-recovery-31": "failed",
          "node-rolling-recovery-32": "operational",
          "node-rolling-recovery-33": "degraded",
          "node-rolling-recovery-34": "failed",
          "node-rolling-recovery-35": "degraded",
          "node-rolling-recovery-36": "degraded",
          "node-rolling-recovery-37": "degraded",
          "node-rolling-recovery-38": "operational",
          "node-rolling-recovery-39": "operational"
        }
      },
      {
        "time": 4,
        "node_states": {
          "node-rolling-recovery-0": "failed",
          "node-rolling-recovery-1": "failed",
          "node-rolling-recovery-2": "failed",
          "node-rolling-recovery-3": "failed",
          "node-rolling-recovery-4": "failed",
          "node-rolling-recovery-5": "failed",
          "node-rolling-recovery-6": "failed",
          "node-rolling-recovery-7": "failed",
          "node-rolling-recovery-8": "failed",
          "node-rolling-recovery-9": "failed",
          "node-rolling-recovery-10": "failed",
          "node-rolling-recovery-11": "failed",
          "node-rolling-recovery-12": "failed",
          "node-rolling-recovery-13": "failed",
          "node-rolling-recovery-14": "failed",
          "node-rolling-recovery-15": "failed",
          "node-rolling-recovery-16": "failed",
          "node-rolling-recovery-17": "degraded",
          "node-rolling-recovery-18": "failed",
          "node-rolling-recovery-19": "failed",
          "node-rolling-recovery-20": "failed",
          "node-rolling-recovery-21": "failed",
          "node-rolling-recovery-22": "failed",
          "node-rolling-recovery-23": "failed",
          "node-rolling-recovery-24": "failed",
          "node-rolling-recovery-25": "failed",
          "node-rolling-recovery-26": "failed",
          "node-rolling-recovery-27": "failed",
          "node-rolling-recovery-28": "failed",
          "node-rolling-recovery-29": "failed",
          "node-rolling-recovery-30": "degraded",
          "node-rolling-recovery-31": "failed",
          "node-rolling-recovery-32": "failed",
          "node-rolling-recovery-33": "failed",
          "node-rolling-recovery-34": "failed",
          "node-rolling-recovery-35": "failed",
          "node-rolling-recovery-36": "failed",
          "node-rolling-recovery-37": "degraded",
          "node-rolling-recovery-38": "failed",
          "node-rolling-recovery-39": "operational"
        }
      },
      {
        "time": 5,
        "node_states": {
          "node-rolling-recovery-0": "failed",
          "node-rolling-recovery-1": "failed",
          "node-rolling-recovery-2": "failed",
          "node-rolling-recovery-3": "failed",
          "node-rolling-recovery-4": "failed",
          "node-rolling-recovery-5": "failed",
          "node-rolling-recovery-6": "failed",
          "node-rolling-recovery-7": "failed",
          "node-rolling-recovery-8": "failed",
          "node-rolling-recovery-9": "failed",
          "node-rolling-recovery-10": "failed",
          "node-rolling-recovery-11": "failed",
          "node-rolling-recovery-12": "failed",
          "node-rolling-recovery-13": "failed",
          "node-rolling-recovery-14": "failed",
          "node-rolling-recovery-15": "failed",
          "node-rolling-recovery-16": "failed",
          "node-rolling-recovery-17": "failed",
          "node-rolling-recovery-18": "failed",
          "node-rolling-recovery-19": "failed",
          "node-rolling-recovery-20": "failed",
          "node-rolling-recovery-21": "failed",
          "node-rolling-recovery-22": "failed",
          "node-rolling-recovery-23": "failed",
          "node-rolling-recovery-24": "failed",
          "node-rolling-recovery-25": "failed",
          "node-rolling-recovery-26": "failed",
          "node-rolling-recovery-27": "failed",
          "node-rolling-recovery-28": "failed",
          "node-rolling-recovery-29": "failed",
          "node-rolling-recovery-30": "failed",
          "node-rolling-recovery-31": "failed",
          "node-rolling-recovery-32": "failed",
          "node-rolling-recovery-33": "failed",
          "node-rolling-recovery-34": "failed",
          "node-rolling-recovery-35": "failed",
          "node-rolling-recovery-36": "failed",
          "node-rolling-recovery-37": "failed",
          "node-rolling-recovery-38": "failed",
          "node-rolling-recovery-39": "failed"
        }
      },
      {
        "time": 6,
        "node_states": {
          "node-rolling-recovery-0": "failed",
          "node-rolling-recovery-1": "failed",
          "node-rolling-recovery-2": "failed",
          "node-rolling-recovery-3": "failed",
          "node-rolling-recovery-4": "failed",
          "node-rolling-recovery-5": "failed",
          "node-rolling-recovery-6": "failed",
          "node-rolling-recovery-7": "failed",
          "node-rolling-recovery-8": "failed",
          "node-rolling-recovery-9": "failed",
          "node-rolling-recovery-10": "failed",
          "node-rolling-recovery-11": "failed",
          "node-rolling-recovery-12": "failed",
          "node-rolling-recovery-13": "failed",
          "node-rolling-recovery-14": "failed",
          "node-rolling-recovery-15": "failed",
          "node-rolling-recovery-16": "failed",
          "node-rolling-recovery-17": "failed",
          "node-rolling-recovery-18": "failed",
          "node-rolling-recovery-19": "failed",
          "node-rolling-recovery-20": "failed",
          "node-rolling-recovery-21": "failed",
          "node-rolling-recovery-22": "failed",
          "node-rolling-recovery-23": "failed",
          "node-rolling-recovery-24": "failed",
          "node-rolling-recovery-25": "failed",
          "node-rolling-recovery-26": "failed",
          "node-rolling-recovery-27": "failed",
          "node-rolling-recovery-28": "failed",
          "node-rolling-recovery-29": "failed",
          "node-rolling-recovery-30": "failed",
          "node-rolling-recovery-31": "failed",
          "node-rolling-recovery-32": "failed",
          "node-rolling-recovery-33": "failed",
          "node-rolling-recovery-34": "failed",
          "node-rolling-recovery-35": "failed",
          "node-rolling-recovery-36": "failed",
          "node-rolling-recovery-37": "failed",
          "node-rolling-recovery-38": "failed",
          "node-rolling-recovery-39": "failed"
        }
      },
      {
        "time": 7,
        "node_states": {
          "node-rolling-recovery-0": "operational",
          "node-rolling-recovery-1": "failed",
          "node-rolling-recovery-2": "failed",
          "node-rolling-recovery-3": "failed",
          "node-rolling-recovery-4": "failed",
          "node-rolling-recovery-5": "failed",
          "node-rolling-recovery-6": "failed",
          "node-rolling-recovery-7": "failed",
          "node-rolling-recovery-8": "failed",
          "node-rolling-recovery-9": "failed",
          "node-rolling-recovery-10": "failed",
          "node-rolling-recovery-11": "failed",
          "node-rolling-recovery-12": "failed",
          "node-rolling-recovery-13": "failed",
          "node-rolling-recovery-14": "failed",
          "node-rolling-recovery-15": "failed",
          "node-rolling-recovery-16": "failed",
          "node-rolling-recovery-17": "failed",
          "node-rolling-recovery-18": "failed",
          "node-rolling-recovery-19": "failed",
          "node-rolling-recovery-20": "failed",
          "node-rolling-recovery-21": "failed",
          "node-rolling-recovery-22": "failed",
          "node-rolling-recovery-23": "failed",
          "node-rolling-recovery-24": "failed",
          "node-rolling-recovery-25": "failed",
          "node-rolling-recovery-26": "failed",
          "node-rolling-recovery-27": "failed",
          "node-rolling-recovery-28": "failed",
          "node-rolling-recovery-29": "failed",
          "node-rolling-recovery-30": "failed",
          "node-rolling-recovery-31": "failed",
          "node-rolling-recovery-32": "failed",
          "node-rolling-recovery-33": "failed",
          "node-rolling-recovery-34": "failed",
          "node-rolling-recovery-35": "failed",
          "node-rolling-recovery-36": "failed",
          "node-rolling-recovery-37": "failed",
          "node-rolling-recovery-38": "failed",
          "node-rolling-recovery-39": "failed"
        }
      },
      {
        "time": 8,
        "node_states": {
          "node-rolling-recovery-0": "operational",
          "node-rolling-recovery-1": "operational",
          "node-rolling-recovery-2": "failed",
          "node-rolling-recovery-3": "operational",
          "node-rolling-recovery-4": "failed",
          "node-rolling-recovery-5": "operational",
          "node-rolling-recovery-6": "failed",
          "node-rolling-recovery-7": "failed",
          "node-rolling-recovery-8": "failed",
          "node-rolling-recovery-9": "failed",
          "node-rolling-recovery-10": "failed",
          "node-rolling-recovery-11": "failed",
          "node-rolling-recovery-12": "failed",
          "node-rolling-recovery-13": "failed",
          "node-rolling-recovery-14": "failed",
          "node-rolling-recovery-15": "failed",
          "node-rolling-recovery-16": "operational",
          "node-rolling-recovery-17": "failed",
          "node-rolling-recovery-18": "failed",
          "node-rolling-recovery-19": "failed",
          "node-rolling-recovery-20": "failed",
          "node-rolling-recovery-21": "failed",
          "node-rolling-recovery-22": "failed",
          "node-rolling-recovery-23": "failed",
          "node-rolling-recovery-24": "failed",
          "node-rolling-recovery-25": "failed",
          "node-rolling-recovery-26": "failed",
          "node-rolling-recovery-27": "failed",
          "node-rolling-recovery-28": "failed",
          "node-rolling-recovery-29": "failed",
          "node-rolling-recovery-30": "failed",
          "node-rolling-recovery-31": "failed",
          "node-rolling-recovery-32": "failed",
          "node-rolling-recovery-33": "failed",
          "node-rolling-recovery-34": "failed",
          "node-rolling-recovery-35": "failed",
          "node-rolling-recovery-36": "failed",
          "node-rolling-recovery-37": "failed",
          "node-rolling-recovery-38": "failed",
          "node-rolling-recovery-39": "failed"
        }
      },
      {
        "time": 9,
        "node_states": {
          "node-rolling-recovery-0": "operational",
          "node-rolling-recovery-1": "operational",
          "node-rolling-recovery-2": "operational",
          "node-rolling-recovery-3": "operational",
          "node-rolling-recovery-4": "operational",
          "node-rolling-recovery-5": "operational",
          "node-rolling-recovery-6": "failed",
          "node-rolling-recovery-7": "operational",
          "node-rolling-recovery-8": "operational",
          "node-rolling-recovery-9": "failed",
          "node-rolling-recovery-10": "failed",
          "node-rolling-recovery-11": "operational",
          "node-rolling-recovery-12": "failed",
          "node-rolling-recovery-13": "failed",
          "node-rolling-recovery-14": "failed",
          "node-rolling-recovery-15": "failed",
          "node-rolling-recovery-16": "operational",
          "node-rolling-recovery-17": "failed",
          "node-rolling-recovery-18": "failed",
          "node-rolling-recovery-19": "failed",
          "node-rolling-recovery-20": "failed",
          "node-rolling-recovery-21": "failed",
          "node-rolling-recovery-22": "failed",
          "node-rolling-recovery-23": "failed",
          "node-rolling-recovery-24": "failed",
          "node-rolling-recovery-25": "failed",
          "node-rolling-recovery-26": "failed",
          "node-rolling-recovery-27": "failed",
          "node-rolling-recovery-28": "operational",
          "node-rolling-recovery-29": "failed",
          "node-rolling-recovery-30": "failed",
          "node-rolling-recovery-31": "operational",
          "node-rolling-recovery-32": "failed",
          "node-rolling-recovery-33": "failed",
          "node-rolling-recovery-34": "failed",
          "node-rolling-recovery-35": "failed",
          "node-rolling-recovery-36": "failed",
          "node-rolling-recovery-37": "failed",
          "node-rolling-recovery-38": "failed",
          "node-rolling-recovery-39": "failed"
        }
      },
      {
        "time": 10,
        "node_states": {
          "node-rolling-recovery-0": "operational",
          "node-rolling-recovery-1": "operational",
          "node-rolling-recovery-2": "operational",
          "node-rolling-recovery-3": "operational",
          "node-rolling-recovery-4": "operational",
          "node-rolling-recovery-5": "operational",
          "node-rolling-recovery-6": "operational",
          "node-rolling-recovery-7": "operational",
          "node-rolling-recovery-8": "operational",
          "node-rolling-recovery-9": "operational",
          "node-rolling-recovery-10": "operational",
          "node-rolling-recovery-11": "operational",
          "node-rolling-recovery-12": "operational",
          "node-rolling-recovery-13": "operational",
          "node-rolling-recovery-14": "failed",
          "node-rolling-recovery-15": "failed",
          "node-rolling-recovery-16": "operational",
          "node-rolling-recovery-17": "failed",
          "node-rolling-recovery-18": "operational",
          "node-rolling-recovery-19": "operational",
          "node-rolling-recovery-20": "operational",
          "node-rolling-recovery-21": "failed",
          "node-rolling-recovery-22": "operational",
          "node-rolling-recovery-23": "failed",
          "node-rolling-recovery-24": "failed",
          "node-rolling-recovery-25": "failed",
          "node-rolling-recovery-26": "failed",
          "node-rolling-recovery-27": "failed",
          "node-rolling-recovery-28": "operational",
          "node-rolling-recovery-29": "operational",
          "node-rolling-recovery-30": "failed",
          "node-rolling-recovery-31": "operational",
          "node-rolling-recovery-32": "failed",
          "node-rolling-recovery-33": "failed",
          "node-rolling-recovery-34": "operational",
          "node-rolling-recovery-35": "failed",
          "node-rolling-recovery-36": "failed",
          "node-rolling-recovery-37": "failed",
          "node-rolling-recovery-38": "failed",
          "node-rolling-recovery-39": "failed"
        }
      },
      {
        "time": 11,
        "node_states": {
          "node-rolling-recovery-0": "operational",
          "node-rolling-recovery-1": "operational",
          "node-rolling-recovery-2": "operational",
          "node-rolling-recovery-3": "operational",
          "node-rolling-recovery-4": "operational",
          "node-rolling-recovery-5": "operational",
          "node-rolling-recovery-6": "operational",
          "node-rolling-recovery-7": "operational",
          "node-rolling-recovery-8": "operational",
          "node-rolling-recovery-9": "operational",
          "node-rolling-recovery-10": "operational",
          "node-rolling-recovery-11": "operational",
          "node-rolling-recovery-12": "operational",
          "node-rolling-recovery-13": "operational",
          "node-rolling-recovery-14": "operational",
          "node-rolling-recovery-15": "failed",
          "node-rolling-recovery-16": "operational",
          "node-rolling-recovery-17": "failed",
          "node-rolling-recovery-18": "operational",
          "node-rolling-recovery-19": "operational",
          "node-rolling-recovery-20": "operational",
          "node-rolling-recovery-21": "failed",
          "node-rolling-recovery-22": "operational",
          "node-rolling-recovery-23": "operational",
          "node-rolling-recovery-24": "operational",
          "node-rolling-recovery-25": "failed",
          "node-rolling-recovery-26": "operational",
          "node-rolling-recovery-27": "operational",
          "node-rolling-recovery-28": "operational",
          "node-rolling-recovery-29": "operational",
          "node-rolling-recovery-30": "failed",
          "node-rolling-recovery-31": "operational",
          "node-rolling-recovery-32": "operational",
          "node-rolling-recovery-33": "operational",
          "node-rolling-recovery-34": "operational",
          "node-rolling-recovery-35": "operational",
          "node-rolling-recovery-36": "operational",
          "node-rolling-recovery-37": "failed",
          "node-rolling-recovery-38": "failed",
          "node-rolling-recovery-39": "failed"
        }
      }
    ],
    "events": [
      {
        "time": 0,
        "node_id": "node-rolling-recovery-0",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "initial_shock",
        "source_node_id": null
      },
      {
        "time": 1,
        "node_id": "node-rolling-recovery-1",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-0"
      },
      {
        "time": 1,
        "node_id": "node-rolling-recovery-3",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-0"
      },
      {
        "time": 1,
        "node_id": "node-rolling-recovery-5",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-0"
      },
      {
        "time": 1,
        "node_id": "node-rolling-recovery-16",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-0"
      },
      {
        "time": 1,
        "node_id": "node-rolling-recovery-31",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-rolling-recovery-0"
      },
      {
        "time": 2,
        "node_id": "node-rolling-recovery-2",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-1"
      },
      {
        "time": 2,
        "node_id": "node-rolling-recovery-4",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-1"
      },
      {
        "time": 2,
        "node_id": "node-rolling-recovery-6",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-rolling-recovery-1"
      },
      {
        "time": 2,
        "node_id": "node-rolling-recovery-7",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-5"
      },
      {
        "time": 2,
        "node_id": "node-rolling-recovery-8",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-3"
      },
      {
        "time": 2,
        "node_id": "node-rolling-recovery-9",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-rolling-recovery-1"
      },
      {
        "time": 2,
        "node_id": "node-rolling-recovery-10",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-3"
      },
      {
        "time": 2,
        "node_id": "node-rolling-recovery-11",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-1"
      },
      {
        "time": 2,
        "node_id": "node-rolling-recovery-23",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-rolling-recovery-1"
      },
      {
        "time": 2,
        "node_id": "node-rolling-recovery-28",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-5"
      },
      {
        "time": 2,
        "node_id": "node-rolling-recovery-31",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-0"
      },
      {
        "time": 2,
        "node_id": "node-rolling-recovery-33",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-rolling-recovery-31"
      },
      {
        "time": 2,
        "node_id": "node-rolling-recovery-35",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-rolling-recovery-3"
      },
      {
        "time": 2,
        "node_id": "node-rolling-recovery-36",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-rolling-recovery-5"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-6",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-4"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-9",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-1"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-12",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-4"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-13",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-11"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-14",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-rolling-recovery-9"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-18",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-2"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-19",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-8"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-20",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-7"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-22",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-2"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-23",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-1"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-24",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-4"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-25",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-23"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-26",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-9"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-29",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-4"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-30",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-rolling-recovery-9"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-34",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-11"
      },
      {
        "time": 3,
        "node_id": "node-rolling-recovery-37",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-rolling-recovery-33"
      },
      {
        "time": 4,
        "node_id": "node-rolling-recovery-14",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-9"
      },
      {
        "time": 4,
        "node_id": "node-rolling-recovery-15",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-14"
      },
      {
        "time": 4,
        "node_id": "node-rolling-recovery-17",
        "previous_state": "operational",
        "next_state": "degraded",
        "cause": "supply_drop",
        "source_node_id": "node-rolling-recovery-13"
      },
      {
        "time": 4,
        "node_id": "node-rolling-recovery-21",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-14"
      },
      {
        "time": 4,
        "node_id": "node-rolling-recovery-27",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-18"
      },
      {
        "time": 4,
        "node_id": "node-rolling-recovery-32",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-12"
      },
      {
        "time": 4,
        "node_id": "node-rolling-recovery-33",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-31"
      },
      {
        "time": 4,
        "node_id": "node-rolling-recovery-35",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-3"
      },
      {
        "time": 4,
        "node_id": "node-rolling-recovery-36",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-12"
      },
      {
        "time": 4,
        "node_id": "node-rolling-recovery-38",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-14"
      },
      {
        "time": 5,
        "node_id": "node-rolling-recovery-17",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-15"
      },
      {
        "time": 5,
        "node_id": "node-rolling-recovery-30",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-9"
      },
      {
        "time": 5,
        "node_id": "node-rolling-recovery-37",
        "previous_state": "degraded",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-33"
      },
      {
        "time": 5,
        "node_id": "node-rolling-recovery-39",
        "previous_state": "operational",
        "next_state": "failed",
        "cause": "threshold_exceeded",
        "source_node_id": "node-rolling-recovery-17"
      },
      {
        "time": 7,
        "node_id": "node-rolling-recovery-0",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 8,
        "node_id": "node-rolling-recovery-1",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 8,
        "node_id": "node-rolling-recovery-3",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 8,
        "node_id": "node-rolling-recovery-5",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 8,
        "node_id": "node-rolling-recovery-16",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 9,
        "node_id": "node-rolling-recovery-2",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 9,
        "node_id": "node-rolling-recovery-4",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 9,
        "node_id": "node-rolling-recovery-7",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 9,
        "node_id": "node-rolling-recovery-8",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 9,
        "node_id": "node-rolling-recovery-11",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 9,
        "node_id": "node-rolling-recovery-28",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 9,
        "node_id": "node-rolling-recovery-31",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 10,
        "node_id": "node-rolling-recovery-6",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 10,
        "node_id": "node-rolling-recovery-9",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 10,
        "node_id": "node-rolling-recovery-10",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 10,
        "node_id": "node-rolling-recovery-12",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 10,
        "node_id": "node-rolling-recovery-13",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 10,
        "node_id": "node-rolling-recovery-18",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 10,
        "node_id": "node-rolling-recovery-19",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 10,
        "node_id": "node-rolling-recovery-20",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 10,
        "node_id": "node-rolling-recovery-22",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 10,
        "node_id": "node-rolling-recovery-29",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 10,
        "node_id": "node-rolling-recovery-34",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 11,
        "node_id": "node-rolling-recovery-14",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 11,
        "node_id": "node-rolling-recovery-23",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 11,
        "node_id": "node-rolling-recovery-24",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 11,
        "node_id": "node-rolling-recovery-26",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 11,
        "node_id": "node-rolling-recovery-27",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 11,
        "node_id": "node-rolling-recovery-32",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 11,
        "node_id": "node-rolling-recovery-33",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 11,
        "node_id": "node-rolling-recovery-35",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      },
      {
        "time": 11,
        "node_id": "node-rolling-recovery-36",
        "previous_state": "failed",
        "next_state": "operational",
        "cause": "rated_output_achieved",
        "source_node_id": null
      }
    ]
  }
}
};

export const SAMPLE_SCENARIOS: Record<string, ScenarioRun> = Object.fromEntries(
  Object.entries(SAMPLE_SCENARIOS_WITHOUT_GENERATED_METRICS).map(([id, run]) => [
    id,
    'metrics' in run
      ? run
      : { ...run, metrics: buildGeneratedMetrics(run.scenario as ScenarioDef, run.result as SimulationResult) },
  ]),
) as Record<string, ScenarioRun>;