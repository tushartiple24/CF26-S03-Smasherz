import React from 'react';
import { ScenarioRun } from '../types';
import {
  getCurrentNodeState,
  getNodeEventsUpToTick,
  getRootCauseChain,
  getAlternativeSupplyPaths,
} from '../data/dataStore';
import {
  X,
  Zap,
  Droplets,
  HeartPulse,
  Truck,
  Radio,
  Layers,
  GitFork,
  ArrowRight,
  Clock,
  Crosshair,
  AlertTriangle,
} from 'lucide-react';

interface NodeInspectorProps {
  scenarioRun: ScenarioRun;
  nodeId: string;
  currentTick: number;
  onClose: () => void;
  onSelectNode: (id: string) => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  scenarioRun,
  nodeId,
  currentTick,
  onClose,
  onSelectNode,
}) => {
  const node = scenarioRun.scenario.nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const currentState = getCurrentNodeState(scenarioRun, nodeId, currentTick);
  const events = getNodeEventsUpToTick(scenarioRun, nodeId, currentTick);
  const isStruggling = currentState === 'degraded' || currentState === 'failed';

  const rootCause = isStruggling ? getRootCauseChain(scenarioRun, nodeId, currentTick) : null;
  const alternativePaths = isStruggling ? getAlternativeSupplyPaths(scenarioRun, nodeId, currentTick) : [];

  const renderServiceIcon = (type: string) => {
    switch (type) {
      case 'power':
        return <Zap className="w-4 h-4 text-[#FFC107]" />;
      case 'water':
        return <Droplets className="w-4 h-4 text-[#00F0FF]" />;
      case 'healthcare':
        return <HeartPulse className="w-4 h-4 text-[#10B981]" />;
      case 'transport':
        return <Truck className="w-4 h-4 text-[#A855F7]" />;
      case 'communications':
        return <Radio className="w-4 h-4 text-[#EC4899]" />;
      default:
        return <Layers className="w-4 h-4 text-[#888]" />;
    }
  };

  return (
    <aside
      id="node-inspector-panel"
      className="w-full max-w-md bg-[#0A0A0A] border-l border-[#222] shadow-2xl flex flex-col h-full overflow-y-auto text-[#E0E0E0] z-30 animate-in slide-in-from-right duration-200 selection:bg-[#FF003C] selection:text-white"
    >
      {/* Header & Main Spec Section */}
      <div className="p-6 border-b border-[#222] bg-[#0A0A0A]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] text-[#666] font-bold uppercase tracking-widest font-mono">
            NODE INSPECTOR // {node.id.toUpperCase()}
          </p>
          <button
            id="btn-close-inspector"
            onClick={onClose}
            className="p-1 border border-[#333] hover:border-white hover:bg-white hover:text-black text-[#888] transition-colors"
            title="Close Inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-between items-start mb-2 gap-3">
          <h2 className="text-2xl sm:text-3xl font-black italic uppercase leading-tight text-white font-display tracking-tight">
            {node.name}
          </h2>

          <span
            className={`text-[10px] px-2 py-0.5 font-bold uppercase shrink-0 font-mono tracking-wider ${
              currentState === 'failed'
                ? 'bg-[#FF003C] text-white shadow-[0_0_8px_#FF003C]'
                : currentState === 'degraded'
                ? 'bg-[#FFC107] text-black shadow-[0_0_8px_#FFC107]'
                : 'bg-white text-black'
            }`}
          >
            {currentState}
          </span>
        </div>

        <p className="text-xs text-[#888] font-mono mb-4 flex items-center gap-2">
          <span>ID: <strong className="text-white font-normal">{node.id}</strong></span>
          <span>|</span>
          <span className="flex items-center gap-1">
            TYPE: <strong className="text-white uppercase font-normal">{node.service_type}</strong>
          </span>
        </p>

        {/* Threshold & Condition stats */}
        <div className="grid grid-cols-2 gap-4 py-4 border-y border-[#222]">
          <div>
            <p className="text-[10px] text-[#666] uppercase font-bold tracking-wider">Threshold</p>
            <p className="text-2xl font-black font-mono text-white mt-0.5">
              {node.failure_threshold.toFixed(2)}
            </p>
          </div>

          <div>
            <p className="text-[10px] text-[#666] uppercase font-bold tracking-wider">Condition</p>
            <p
              className={`text-2xl font-black font-mono mt-0.5 uppercase ${
                currentState === 'failed'
                  ? 'text-[#FF003C]'
                  : currentState === 'degraded'
                  ? 'text-[#FFC107]'
                  : 'text-[#00F0FF]'
              }`}
            >
              {currentState === 'failed' ? 'CRITICAL' : currentState === 'degraded' ? 'WARNING' : 'NOMINAL'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-6 flex-1">
        {/* MITIGATION & ROOT CAUSE SECTION (Only when Degraded or Failed) */}
        {isStruggling && rootCause && (
          <section className="flex flex-col gap-3">
            <p className="text-[10px] text-[#666] font-bold uppercase tracking-widest font-mono">
              Diagnostic & Mitigation Analysis
            </p>

            {/* Root cause trace chain */}
            {rootCause.isRootDisruption ? (
              <div className="bg-[#150005] border border-[#331111] p-4 text-center">
                <p className="text-xs font-bold text-[#FF003C] mb-1 tracking-wider uppercase font-mono">
                  ORIGIN DISRUPTION TRIGGER
                </p>
                <p className="text-[11px] text-[#888] leading-relaxed font-mono">
                  THIS BUILDING IS THE INITIAL SHOCK ORIGIN IN THIS SIMULATION RUN. FAILURE OCCURRED AT TICK 0.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-[#888] font-mono uppercase tracking-wider">
                  Root Cause Propagation Chain:
                </span>
                <div className="space-y-2 font-mono text-[11px]">
                  {rootCause.steps.map((step, idx) => (
                    <div
                      key={`${step.nodeId}-${idx}`}
                      className={`p-2.5 border flex flex-col gap-1 transition-all ${
                        idx === 0
                          ? 'bg-[#180508] border-[#FF003C]/50 text-white'
                          : step.isInitialDisruption
                          ? 'bg-[#181305] border-[#FFC107]/50 text-[#FFC107]'
                          : 'bg-[#111] border-[#222] text-[#AAA]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => onSelectNode(step.nodeId)}
                          className="font-bold hover:underline text-left text-white flex items-center gap-1.5 uppercase"
                        >
                          <Crosshair className="w-3 h-3 text-[#FF003C]" />
                          <span>{step.name}</span>
                        </button>
                        <span
                          className={`text-[9px] px-1 font-bold uppercase ${
                            step.state === 'failed'
                              ? 'bg-[#FF003C] text-white'
                              : step.state === 'degraded'
                              ? 'bg-[#FFC107] text-black'
                              : 'bg-white text-black'
                          }`}
                        >
                          {step.state}
                        </span>
                      </div>

                      <div className="text-[10px] text-[#888] flex items-center justify-between mt-0.5">
                        <span>Cause: {step.cause}</span>
                        <span className="text-[#666]">T-{step.time < 10 ? `0${step.time}` : step.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alternative Supply Paths / Redundancy */}
            <div className="mt-2">
              <span className="text-[10px] text-[#888] font-mono uppercase tracking-wider block mb-2">
                Alternative Feeds (Redundancy):
              </span>

              {alternativePaths.length > 0 ? (
                <div className="flex flex-col gap-1.5 font-mono">
                  {alternativePaths.map((path) => (
                    <div
                      key={path.upstreamId}
                      className="p-2.5 bg-[#111] border border-[#222] flex items-center justify-between text-xs"
                    >
                      <div className="flex flex-col">
                        <button
                          onClick={() => onSelectNode(path.upstreamId)}
                          className="font-bold text-white hover:underline text-left uppercase"
                        >
                          {path.upstreamName}
                        </button>
                        <span className="text-[10px] text-[#666]">
                          FEED WEIGHT: {path.weight.toFixed(2)}
                        </span>
                      </div>

                      <span
                        className={`text-[9px] px-1.5 py-0.5 uppercase font-bold ${
                          path.currentState === 'operational'
                            ? 'bg-white text-black'
                            : path.currentState === 'degraded'
                            ? 'bg-[#FFC107] text-black'
                            : 'bg-[#FF003C] text-white'
                        }`}
                      >
                        {path.currentState}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#150005] border border-[#331111] p-3.5 text-center">
                  <p className="text-xs font-bold text-[#FF003C] mb-1 font-mono tracking-wider">
                    RED ALERT // NO REDUNDANCY
                  </p>
                  <p className="text-[10px] text-[#888] font-mono uppercase">
                    NO REDUNDANT PATH AVAILABLE FOR DOWNSTREAM NODES. SINGLE POINT OF FAILURE.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Event Trace up to Current Tick */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-[#666] font-bold uppercase tracking-widest font-mono">
              EVENT TRACE // (T-00 TO T-{currentTick < 10 ? `0${currentTick}` : currentTick})
            </p>
            <span className="text-[10px] font-mono text-[#666]">{events.length} EVENTS</span>
          </div>

          {events.length === 0 ? (
            <div className="p-4 text-center text-xs font-mono text-[#666] bg-[#111] border border-[#222]">
              NO STATE TRANSITION LOGGED FOR THIS NODE UP TO CURRENT TIMESTEP.
            </div>
          ) : (
            <div className="space-y-3 font-mono text-[11px]">
              {events.map((evt, idx) => {
                const isFail = evt.next_state === 'failed';
                const isDeg = evt.next_state === 'degraded';
                return (
                  <div
                    key={`${evt.time}-${evt.cause}-${idx}`}
                    className={`relative pl-4 border-l ${
                      isFail ? 'border-[#FF003C]' : isDeg ? 'border-[#FFC107]' : 'border-[#444]'
                    } pb-2`}
                  >
                    <div
                      className={`absolute -left-[5px] top-0 w-2 h-2 rounded-full ${
                        isFail
                          ? 'bg-[#FF003C] shadow-[0_0_6px_#FF003C]'
                          : isDeg
                          ? 'bg-[#FFC107] shadow-[0_0_6px_#FFC107]'
                          : 'bg-white'
                      }`}
                    />

                    <p className="text-white font-bold uppercase flex items-center justify-between">
                      <span>[T-{evt.time < 10 ? `0${evt.time}` : evt.time}] STATE: {evt.next_state.toUpperCase()}</span>
                      <span className="text-[9px] text-[#666]">PREV: {evt.previous_state.toUpperCase()}</span>
                    </p>

                    <p className="text-[#888] text-[10px] mt-0.5">
                      Cause: <span className="text-white">{evt.cause}</span>
                    </p>

                    {evt.source_node_id && (
                      <p className="text-[10px] text-[#666] mt-0.5">
                        Propagated from:{' '}
                        <button
                          onClick={() => onSelectNode(evt.source_node_id!)}
                          className="text-[#00F0FF] hover:underline"
                        >
                          [{evt.source_node_id}]
                        </button>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
};

