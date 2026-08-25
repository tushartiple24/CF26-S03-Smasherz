import React from 'react';
import { ScenarioRun, SimulationEvent } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Activity,
  Layers,
  TrendingDown,
  Clock,
  ShieldAlert,
  ArrowRight,
  Crosshair,
} from 'lucide-react';

interface AnalyticsDashboardProps {
  scenarioRun: ScenarioRun;
  onJumpToEvent: (tick: number, nodeId: string) => void;
}

const SERVICE_TYPE_COLORS: Record<string, string> = {
  power: '#FFC107',
  water: '#00F0FF',
  healthcare: '#10B981',
  transport: '#A855F7',
  communications: '#EC4899',
};

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  scenarioRun,
  onJumpToEvent,
}) => {
  const { scenario, metrics } = scenarioRun;

  // Prepare data for Recharts Bar Chart
  const chartData = metrics.affected_services.by_service_type.map((item) => ({
    service_type: item.service_type.toUpperCase(),
    rawType: item.service_type,
    count: item.count,
    services: item.services.map((s) => s.name).join(', '),
  }));

  // Merge and sort chronological events
  const allEvents: Array<SimulationEvent & { category: 'initiating' | 'spread' | 'recovery' }> = [
    ...(metrics.timeline.initiating_events || []).map((e) => ({ ...e, category: 'initiating' as const })),
    ...(metrics.timeline.spread_events || []).map((e) => ({ ...e, category: 'spread' as const })),
    ...(metrics.timeline.recovery_events || []).map((e) => ({ ...e, category: 'recovery' as const })),
  ].sort((a, b) => a.time - b.time);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'fully_recovered':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-black font-bold uppercase text-xs font-mono">
            FULLY RECOVERED
          </span>
        );
      case 'partial_recovery':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFC107] text-black font-bold uppercase text-xs font-mono shadow-[0_0_8px_#FFC107]">
            PARTIAL RECOVERY
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FF003C] text-white font-bold uppercase text-xs font-mono shadow-[0_0_8px_#FF003C]">
            NOT RECOVERED
          </span>
        );
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-white dark:bg-[#050505] text-black dark:text-[#E0E0E0] p-4 sm:p-6 lg:p-8 selection:bg-[#FF003C] selection:text-white transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Dashboard Header */}
        <div className="p-6 bg-gray-50 dark:bg-[#0A0A0A] border border-gray-300 dark:border-[#222] rounded-none shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 font-mono">
              <span className="text-[10px] bg-white text-black px-2 py-0.5 font-bold uppercase tracking-wider">
                SCENARIO // {scenario.id.toUpperCase()}
              </span>
              <span className="text-[10px] border border-gray-300 dark:border-[#333] text-[#666] dark:text-[#888] px-2 py-0.5 uppercase">
                SEED: {metrics.seed}
              </span>
              <span className="text-[10px] border border-gray-300 dark:border-[#333] text-[#666] dark:text-[#888] px-2 py-0.5 uppercase">
                GRAPH: {scenario.graph_id}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black italic uppercase leading-none text-black dark:text-white font-display tracking-tight">
              {scenario.name}
            </h1>
            <p className="text-xs text-[#888] max-w-3xl leading-relaxed font-mono uppercase">
              {scenario.description}
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
            <span className="text-[10px] text-[#666] font-bold uppercase tracking-widest font-mono">
              RECOVERY OUTCOME
            </span>
            {renderStatusBadge(metrics.recovery_time.status)}
          </div>
        </div>

        {/* Metrics Grid with Bold Typography */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Cascade Depth */}
          <div className="p-4 bg-gray-50 dark:bg-[#0A0A0A] border border-gray-300 dark:border-[#222] rounded-none flex flex-col gap-1">
            <div className="flex items-center justify-between text-[#666] text-[10px] font-bold uppercase tracking-wider font-mono">
              <span>CASCADE DEPTH</span>
              <Activity className="w-3.5 h-3.5 text-[#00F0FF]" />
            </div>
            <div className="text-3xl font-black font-mono text-black dark:text-white mt-1">
              {metrics.cascade_depth_ticks} <span className="text-xs font-normal text-[#666]">TICKS</span>
            </div>
            <span className="text-[10px] text-[#666] font-mono uppercase">Propagation duration</span>
          </div>

          {/* Dependency Hop Depth */}
          <div className="p-4 bg-gray-50 dark:bg-[#0A0A0A] border border-gray-300 dark:border-[#222] rounded-none flex flex-col gap-1">
            <div className="flex items-center justify-between text-[#666] text-[10px] font-bold uppercase tracking-wider font-mono">
              <span>HOP DEPTH</span>
              <Layers className="w-3.5 h-3.5 text-black dark:text-white" />
            </div>
            <div className="text-3xl font-black font-mono text-black dark:text-white mt-1">
              {metrics.dependency_hop_depth} <span className="text-xs font-normal text-[#666]">HOPS</span>
            </div>
            <span className="text-[10px] text-[#666] font-mono uppercase">Max dependency chain</span>
          </div>

          {/* Peak Impact */}
          <div className="p-4 bg-gray-50 dark:bg-[#0A0A0A] border border-gray-300 dark:border-[#222] rounded-none flex flex-col gap-1">
            <div className="flex items-center justify-between text-[#FF003C] text-[10px] font-bold uppercase tracking-wider font-mono">
              <span>PEAK IMPACT</span>
              <TrendingDown className="w-3.5 h-3.5 text-[#FF003C]" />
            </div>
            <div className="text-3xl font-black font-mono text-[#FF003C] mt-1">
              {metrics.peak_impact.count} <span className="text-xs font-normal text-[#888]">NODES</span>
            </div>
            <span className="text-[10px] text-[#666] font-mono uppercase">At Tick T-{metrics.peak_impact.time}</span>
          </div>

          {/* Total Affected Services */}
          <div className="p-4 bg-gray-50 dark:bg-[#0A0A0A] border border-gray-300 dark:border-[#222] rounded-none flex flex-col gap-1">
            <div className="flex items-center justify-between text-[#FFC107] text-[10px] font-bold uppercase tracking-wider font-mono">
              <span>AFFECTED NODES</span>
              <ShieldAlert className="w-3.5 h-3.5 text-[#FFC107]" />
            </div>
            <div className="text-3xl font-black font-mono text-[#FFC107] mt-1">
              {metrics.affected_services.count} <span className="text-xs font-normal text-[#666]">/ {scenario.nodes.length}</span>
            </div>
            <span className="text-[10px] text-[#666] font-mono uppercase">Unique impacted units</span>
          </div>

          {/* Recovery Time */}
          <div className="p-4 bg-gray-50 dark:bg-[#0A0A0A] border border-gray-300 dark:border-[#222] rounded-none flex flex-col gap-1">
            <div className="flex items-center justify-between text-[#666] text-[10px] font-bold uppercase tracking-wider font-mono">
              <span>RECOVERY TIME</span>
              <Clock className="w-3.5 h-3.5 text-[#10B981]" />
            </div>
            <div className="text-3xl font-black font-mono text-black dark:text-white mt-1">
              {metrics.recovery_time.duration_ticks !== null ? (
                <>
                  {metrics.recovery_time.duration_ticks} <span className="text-xs font-normal text-[#666]">TICKS</span>
                </>
              ) : (
                <span className="text-[#555]">—</span>
              )}
            </div>
            <span className="text-[10px] text-[#666] font-mono uppercase">
              {metrics.recovery_time.recovered_at !== null ? `Stabilized at T-${metrics.recovery_time.recovered_at}` : 'No recovery'}
            </span>
          </div>
        </div>

        {/* Middle Section: Recharts Bar Chart of Affected Services by Service Type */}
        <div className="p-6 bg-gray-50 dark:bg-[#0A0A0A] border border-gray-300 dark:border-[#222] rounded-none shadow-xl flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-[#666] font-bold uppercase tracking-widest font-mono">
              INFRASTRUCTURE SECTOR BREAKDOWN
            </p>
            <h3 className="text-xl font-black italic uppercase text-black dark:text-white font-display">
              Impact Distribution by Service Type
            </h3>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#222" vertical={false} />
                <XAxis
                  dataKey="service_type"
                  tick={{ fill: '#888', fontSize: 10, fontFamily: 'monospace' }}
                  tickLine={{ stroke: '#333' }}
                  axisLine={{ stroke: '#333' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#888', fontSize: 10, fontFamily: 'monospace' }}
                  tickLine={{ stroke: '#333' }}
                  axisLine={{ stroke: '#333' }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 bg-white dark:bg-[#0A0A0A] border border-gray-300 dark:border-[#333] text-xs font-mono text-black dark:text-[#E0E0E0] shadow-2xl">
                          <div className="font-bold text-black dark:text-white mb-1 uppercase">[SECTOR: {data.service_type}]</div>
                          <div className="text-[#00F0FF] font-bold">IMPACTED NODES: {data.count}</div>
                          <div className="text-[#888] text-[10px] mt-1 max-w-xs uppercase">{data.services}</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[0, 0, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={SERVICE_TYPE_COLORS[entry.rawType] || '#FFFFFF'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Section: Chronological Event Timeline */}
        <div className="p-6 bg-gray-50 dark:bg-[#0A0A0A] border border-gray-300 dark:border-[#222] rounded-none shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-gray-300 dark:border-[#222] pb-3">
            <div className="flex flex-col gap-1">
              <p className="text-[10px] text-[#666] font-bold uppercase tracking-widest font-mono">
                SIMULATION AUDIT LOG
              </p>
              <h3 className="text-xl font-black italic uppercase text-black dark:text-white font-display">
                Chronological Cascade Timeline
              </h3>
            </div>
            <span className="text-xs font-mono text-[#666] uppercase font-bold">{allEvents.length} Events Total</span>
          </div>

          <div className="flex flex-col gap-2 font-mono">
            {allEvents.map((evt, idx) => {
              const nodeObj = scenario.nodes.find((n) => n.id === evt.node_id);
              const isInitiating = evt.category === 'initiating';
              const isRecovery = evt.category === 'recovery';

              return (
                <div
                  key={`${evt.time}-${evt.node_id}-${idx}`}
                  className={`p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                    evt.next_state === 'failed'
                      ? 'bg-red-50 dark:bg-[#180508] border-red-200 dark:border-[#FF003C]/50'
                      : evt.next_state === 'operational'
                      ? 'bg-green-50 dark:bg-[#05180f] border-green-200 dark:border-[#10B981]/50'
                      : 'bg-gray-100 dark:bg-[#111] border-gray-300 dark:border-[#222] hover:border-gray-400 dark:hover:border-[#444]'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="flex flex-col items-center">
                      <span className="font-mono text-xs font-black px-2 py-0.5 bg-white text-black uppercase">
                        T-{evt.time < 10 ? `0${evt.time}` : evt.time}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm uppercase">
                          {nodeObj ? nodeObj.name : evt.node_id}
                        </span>
                        <span className="text-[10px] uppercase px-1.5 py-0.2 border border-[#333] text-[#888]">
                          {nodeObj ? nodeObj.service_type : 'node'}
                        </span>
                        {isInitiating && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-[#FF003C] text-white font-bold uppercase shadow-[0_0_6px_#FF003C]">
                            ORIGIN SHOCK
                          </span>
                        )}
                        {isRecovery && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-white text-black font-bold uppercase">
                            RECOVERY RESTORE
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-[#888] flex flex-wrap items-center gap-2">
                        <span>CAUSE: <strong className="text-white font-normal uppercase">{evt.cause}</strong></span>
                        {evt.source_node_id && (
                          <span className="text-[#666]">
                            (PROPAGATED FROM <span className="text-[#00F0FF]">[{evt.source_node_id}]</span>)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      <span className="text-[#666] uppercase">{evt.previous_state}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#444]" />
                      <span
                        className={`font-bold uppercase ${
                          evt.next_state === 'operational'
                            ? 'text-white'
                            : evt.next_state === 'degraded'
                            ? 'text-[#FFC107]'
                            : 'text-[#FF003C]'
                        }`}
                      >
                        {evt.next_state}
                      </span>
                    </div>

                    <button
                      onClick={() => onJumpToEvent(evt.time, evt.node_id)}
                      className="px-2.5 py-1 text-xs font-bold text-white hover:text-black hover:bg-white border border-[#333] uppercase transition-colors flex items-center gap-1"
                      title="Jump to this snapshot in 3D City View"
                    >
                      <Crosshair className="w-3 h-3 text-[#FF003C]" />
                      <span>Jump 3D</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

