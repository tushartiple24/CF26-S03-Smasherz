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
  ShieldAlert,
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
  const alternativePaths = getAlternativeSupplyPaths(scenarioRun, nodeId, currentTick);

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
      className="w-full max-w-md bg-white dark:bg-[#0A0A0A] border-l border-gray-300 dark:border-[#222] shadow-2xl flex flex-col h-full overflow-y-auto text-black dark:text-[#E0E0E0] z-30 animate-in slide-in-from-right duration-200 selection:bg-[#FF003C] selection:text-white"
    >
      {/* Header & Main Spec Section */}
      <div className="flex items-center justify-between p-4 border-b border-gray-300 dark:border-[#222]">
        <div>
          <h2 className="text-sm font-bold text-black dark:text-white flex items-center gap-2">
            <span className="font-mono text-gray-500 dark:text-[#888]">{nodeId}</span>
          </h2>
          <p className="text-lg font-black italic tracking-tighter uppercase text-black dark:text-white mt-1">
            {node.name || 'Unknown Facility'}
          </p>
        </div>
        <button
          id="btn-close-node-inspector"
          onClick={onClose}
          className="p-2 text-gray-500 dark:text-[#888] hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#222] transition-colors"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 flex flex-col gap-6 flex-1">
        
        {/* METRICS & PARAMETERS */}
        <section className="flex flex-col gap-3">
          <p className="text-[10px] text-gray-500 dark:text-[#666] font-bold uppercase tracking-widest font-mono">
            Node Parameters
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 p-3 bg-gray-100 dark:bg-[#111] border border-gray-300 dark:border-[#222]">
              <span className="text-[9px] text-gray-500 dark:text-[#888] font-mono uppercase">Service Type</span>
              <span className="text-xs font-bold uppercase">{node.service_type || 'Unknown'}</span>
            </div>
            <div className="flex flex-col gap-1 p-3 bg-gray-100 dark:bg-[#111] border border-gray-300 dark:border-[#222]">
              <span className="text-[9px] text-gray-500 dark:text-[#888] font-mono uppercase">Failure Threshold</span>
              <span className="text-xs font-bold uppercase">
                {(node.failure_threshold * 100).toFixed(0)}% LOAD
              </span>
            </div>
          </div>
          
          <div className="flex flex-col gap-1 p-3 bg-gray-100 dark:bg-[#111] border border-gray-300 dark:border-[#222]">
            <span className="text-[9px] text-gray-500 dark:text-[#888] font-mono uppercase">Current Condition</span>
            <span className={`text-xs font-bold uppercase ${
              currentState === 'failed' ? 'text-[#FF003C]' : 
              currentState === 'degraded' ? 'text-[#FFC107]' : 'text-green-600 dark:text-[#00F0FF]'
            }`}>
              {currentState}
            </span>
          </div>
        </section>

        {/* MITIGATION & ROOT CAUSE SECTION */}
        <section className="flex flex-col gap-3">
            <p className="text-[10px] text-gray-500 dark:text-[#666] font-bold uppercase tracking-widest font-mono">
              Diagnostic & Mitigation Analysis
            </p>

            {rootCause && (
              rootCause.isRootDisruption ? (
                <div className="bg-red-50 dark:bg-[#150005] border border-red-200 dark:border-[#331111] p-4 text-center">
                  <p className="text-xs font-bold text-[#FF003C] mb-1 tracking-wider uppercase font-mono">
                    ORIGIN DISRUPTION TRIGGER
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-gray-500 dark:text-[#888] font-mono uppercase tracking-wider">
                    Root Cause Propagation Chain:
                  </span>
                  <div className="space-y-2 font-mono text-[11px]">
                    {rootCause.steps.map((step, idx) => (
                      <div
                        key={`${step.nodeId}-${idx}`}
                        className={`p-2.5 border flex flex-col gap-1 ${
                          idx === 0
                            ? 'bg-red-50 dark:bg-[#180508] border-[#FF003C]/50'
                            : 'bg-gray-100 dark:bg-[#111] border-gray-300 dark:border-[#222]'
                        }`}
                      >
                        <button
                          onClick={() => onSelectNode(step.nodeId)}
                          className="font-bold hover:underline text-left flex items-center gap-1.5 uppercase"
                        >
                          <Crosshair className="w-3 h-3 text-[#FF003C]" />
                          <span>{step.name}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* Alternative Supply Paths / Redundancy */}
            <div className="flex flex-col gap-2 mt-4">
              <span className="text-[10px] text-gray-500 dark:text-[#888] font-mono uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                Alternative Feeds (Redundancy):
              </span>
              {alternativePaths.length === 0 ? (
                <div className="p-3 border border-gray-300 dark:border-[#333] bg-gray-100 dark:bg-[#111] text-gray-500 dark:text-[#666] text-xs font-mono text-center">
                  NO ALTERNATIVE SUPPLY ROUTES AVAILABLE
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 font-mono">
                  {alternativePaths.map((path) => (
                    <div
                      key={path.upstreamId}
                      className="p-2.5 bg-gray-100 dark:bg-[#111] border border-gray-300 dark:border-[#222] flex items-center justify-between text-xs"
                    >
                      <div className="flex flex-col">
                        <button
                          onClick={() => onSelectNode(path.upstreamId)}
                          className="font-bold text-black dark:text-white hover:underline text-left uppercase"
                        >
                          {path.upstreamName}
                        </button>
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
              )}
            </div>
        </section>

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

