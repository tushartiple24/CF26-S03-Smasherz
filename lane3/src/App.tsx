import React, { useState } from 'react';
import { ScenarioRun } from './types';
import { SAMPLE_SCENARIOS } from './data/sampleScenarios';
import { HeaderNav } from './components/HeaderNav';
import { CityCanvas } from './components/CityCanvas';
import { PlaybackControls } from './components/PlaybackControls';
import { NodeInspector } from './components/NodeInspector';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { DataImportModal } from './components/DataImportModal';
import { HelpLegendModal } from './components/HelpLegendModal';

export default function App() {
  // Scenario library state (starts with the 4 required mock datasets)
  const [scenarios, setScenarios] = useState<Record<string, ScenarioRun>>(SAMPLE_SCENARIOS);
  const [activeScenarioId, setActiveScenarioId] = useState<string>('cross-service-cascade');

  // Simulation tick state
  const [currentTick, setCurrentTick] = useState<number>(0);

  // Inspector & selection state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'3d-city' | 'analytics'>('3d-city');

  // Modals state
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Active scenario run
  const activeScenarioRun = scenarios[activeScenarioId] || scenarios['cross-service-cascade'];

  // Handle switching scenario
  const handleSelectScenario = (id: string) => {
    setActiveScenarioId(id);
    setCurrentTick(0);
    setSelectedNodeId(null);
  };

  // Handle loading new custom scenario JSON
  const handleLoadCustomScenario = (newRun: ScenarioRun) => {
    setScenarios((prev) => ({
      ...prev,
      [newRun.scenario.id]: newRun,
    }));
    setActiveScenarioId(newRun.scenario.id);
    setCurrentTick(0);
    setSelectedNodeId(null);
  };

  // Handle resetting back to original sample scenarios
  const handleResetSamples = () => {
    setScenarios(SAMPLE_SCENARIOS);
    setActiveScenarioId('cross-service-cascade');
    setCurrentTick(0);
    setSelectedNodeId(null);
  };

  // Handle jumping to a timeline event from analytics dashboard
  const handleJumpToEvent = (tick: number, nodeId: string) => {
    setActiveTab('3d-city');
    setCurrentTick(tick);
    setSelectedNodeId(nodeId);
  };

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-[#050505] text-[#E0E0E0] font-sans selection:bg-[#FF003C] selection:text-white">
      {/* Top Navigation */}
      <HeaderNav
        scenarioList={Object.values(scenarios)}
        activeScenarioId={activeScenarioId}
        onSelectScenario={handleSelectScenario}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenDataModal={() => setIsDataModalOpen(true)}
        onOpenHelpModal={() => setIsHelpModalOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 relative overflow-hidden flex">
        {activeTab === '3d-city' ? (
          <div className="relative w-full h-full flex flex-col">
            {/* 3D Viewport & Inspector Container */}
            <div className="flex-1 relative flex overflow-hidden">
              <CityCanvas
                scenarioRun={activeScenarioRun}
                currentTick={currentTick}
                selectedNodeId={selectedNodeId}
                onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
                onOpenLegend={() => setIsHelpModalOpen(true)}
              />

              {/* Node Inspector Drawer */}
              {selectedNodeId && (
                <div className="absolute top-0 right-0 bottom-0 z-30 flex">
                  <NodeInspector
                    scenarioRun={activeScenarioRun}
                    nodeId={selectedNodeId}
                    currentTick={currentTick}
                    onClose={() => setSelectedNodeId(null)}
                    onSelectNode={(id) => setSelectedNodeId(id)}
                  />
                </div>
              )}
            </div>

            {/* Bottom Floating Playback Scrub Bar */}
            <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none flex justify-center">
              <div className="pointer-events-auto w-full max-w-4xl">
                <PlaybackControls
                  scenarioRun={activeScenarioRun}
                  currentTick={currentTick}
                  onTickChange={(newTick) => setCurrentTick(newTick)}
                />
              </div>
            </div>
          </div>
        ) : (
          <AnalyticsDashboard
            scenarioRun={activeScenarioRun}
            onJumpToEvent={handleJumpToEvent}
          />
        )}
      </main>

      {/* Data Contract Import / Export Modal */}
      <DataImportModal
        currentScenario={activeScenarioRun}
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        onLoadScenario={handleLoadCustomScenario}
        onResetSamples={handleResetSamples}
      />

      {/* Visual Guide & Legend Modal */}
      <HelpLegendModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </div>
  );
}
