import React from 'react';
import { ScenarioRun } from '../types';
import {
  Building2,
  BarChart3,
  Box,
  FileCode,
  HelpCircle,
  ChevronDown,
  Activity,
  Sun,
  Moon,
} from 'lucide-react';

interface HeaderNavProps {
  scenarioList: ScenarioRun[];
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
  activeTab: '3d-city' | 'analytics';
  onSelectTab: (tab: '3d-city' | 'analytics') => void;
  onOpenDataModal: () => void;
  onOpenHelpModal: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  scenarioList,
  activeScenarioId,
  onSelectScenario,
  activeTab,
  onSelectTab,
  onOpenDataModal,
  onOpenHelpModal,
  isDarkMode,
  onToggleTheme,
}) => {
  const currentScenario = scenarioList.find((s) => s.scenario.id === activeScenarioId);

  return (
    <header
      id="main-header-nav"
      className="w-full bg-gray-50 dark:bg-[#0A0A0A] border-b border-gray-300 dark:border-[#222] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4 z-40 relative transition-colors duration-300"
    >
      {/* Brand & Subtitle with Bold Typography */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter leading-none italic uppercase text-black dark:text-white font-display flex items-baseline">
            CASCADE CITY
            <span className="text-[10px] font-mono not-italic tracking-[0.25em] text-[#666] ml-2 font-normal hidden sm:inline">
              V.01.LANE3
            </span>
          </h1>
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-2 h-2 rounded-full bg-[#FF003C] shadow-[0_0_8px_#FF003C] animate-pulse"></div>
            <span className="text-[10px] font-bold text-[#FF003C] uppercase tracking-wider hidden md:inline font-mono">
              Live Engine
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <span className="text-[10px] bg-black dark:bg-white text-white dark:text-black px-1.5 py-0.5 font-bold uppercase tracking-wider">
            SCENARIO: {activeScenarioId.toUpperCase()}
          </span>
          <span className="text-[10px] border border-gray-300 dark:border-[#333] text-gray-600 dark:text-[#888] px-1.5 py-0.5 font-mono uppercase">
            SEED: {currentScenario?.result.seed ?? 2002}
          </span>
          <span className="text-[10px] border border-gray-300 dark:border-[#333] text-gray-600 dark:text-[#888] px-1.5 py-0.5 font-mono uppercase hidden lg:inline">
            NODES: {currentScenario?.scenario.nodes.length ?? 0}
          </span>
        </div>
      </div>

      {/* Center: Scenario Switcher & View Switcher */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Scenario Selector Dropdown */}
        <div className="relative">
          <select
            id="scenario-selector-dropdown"
            value={activeScenarioId}
            onChange={(e) => onSelectScenario(e.target.value)}
            aria-label="Select Infrastructure Failure Scenario"
            className="appearance-none bg-gray-100 dark:bg-[#111] hover:bg-gray-200 dark:hover:bg-[#181818] border border-gray-300 dark:border-[#333] hover:border-gray-400 dark:hover:border-[#555] rounded-none px-3 py-1.5 pr-8 text-xs font-mono font-bold text-black dark:text-white uppercase focus:outline-none focus:border-[#FF003C] cursor-pointer transition-colors"
          >
            {scenarioList.map((s) => (
              <option key={s.scenario.id} value={s.scenario.id} className="bg-gray-100 dark:bg-[#111] text-black dark:text-white">
                {s.scenario.name.toUpperCase()} [{s.scenario.id}]
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-500 dark:text-[#888] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Center Tabs: 3D View vs Analytics */}
        <div className="flex items-center bg-gray-200 dark:bg-[#111] border border-gray-300 dark:border-[#222] p-0.5 rounded-none transition-colors duration-300">
          <button
            id="tab-btn-3d-city"
            onClick={() => onSelectTab('3d-city')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wider font-bold transition-all ${
              activeTab === '3d-city'
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-[0_0_10px_rgba(0,0,0,0.1)] dark:shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                : 'text-gray-600 dark:text-[#888] hover:text-black dark:hover:text-white hover:bg-gray-300 dark:hover:bg-[#1a1a1a]'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D City View</span>
          </button>

          <button
            id="tab-btn-analytics"
            onClick={() => onSelectTab('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wider font-bold transition-all ${
              activeTab === 'analytics'
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-[0_0_10px_rgba(0,0,0,0.1)] dark:shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                : 'text-gray-600 dark:text-[#888] hover:text-black dark:hover:text-white hover:bg-gray-300 dark:hover:bg-[#1a1a1a]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics Grid</span>
          </button>
        </div>
      </div>

      {/* Right Utilities: Import/Export & Guide */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleTheme}
          className="p-1.5 border border-gray-300 dark:border-[#333] hover:border-black dark:hover:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black text-gray-600 dark:text-[#CCC] transition-colors"
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          id="btn-open-data-modal"
          onClick={onOpenDataModal}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-[#333] hover:border-black dark:hover:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black text-xs font-mono uppercase font-bold text-gray-600 dark:text-[#CCC] transition-colors"
          title="Import or Export Scenario JSON"
        >
          <FileCode className="w-3.5 h-3.5 text-[#FF003C]" />
          <span className="hidden md:inline">Data Contract</span>
        </button>

        <button
          id="btn-open-help-guide"
          onClick={onOpenHelpModal}
          className="p-1.5 border border-gray-300 dark:border-[#333] hover:border-black dark:hover:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black text-gray-600 dark:text-[#CCC] transition-colors"
          title="Visual Guide & Legend"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

