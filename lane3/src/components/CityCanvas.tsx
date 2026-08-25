import React, { useEffect, useRef, useState } from 'react';
import { ScenarioRun, NodeState } from '../types';
import { CityScene } from './CityScene';
import { getCurrentNodeState } from '../data/dataStore';
import {
  RotateCcw,
  Compass,
  Maximize2,
  Zap,
  Droplets,
  HeartPulse,
  Truck,
  Radio,
  HelpCircle,
  Eye,
  Crosshair,
} from 'lucide-react';

interface CityCanvasProps {
  scenarioRun: ScenarioRun;
  currentTick: number;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onOpenLegend?: () => void;
  isDarkMode: boolean;
}

export const CityCanvas: React.FC<CityCanvasProps> = ({
  scenarioRun,
  currentTick,
  selectedNodeId,
  onSelectNode,
  onOpenLegend,
  isDarkMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CityScene | null>(null);

  const [hoveredNode, setHoveredNode] = useState<{
    id: string;
    name: string;
    serviceType: string;
    state: NodeState;
    threshold: number;
    pos: { x: number; y: number };
  } | null>(null);

  // Initialize CityScene
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new CityScene(containerRef.current, {
      onNodeClick: (nodeId) => {
        onSelectNode(nodeId);
      },
      onNodeHover: (nodeId, mousePos) => {
        if (!nodeId || !mousePos) {
          setHoveredNode(null);
          return;
        }
        const node = scenarioRun.scenario.nodes.find((n) => n.id === nodeId);
        if (node) {
          const state = getCurrentNodeState(scenarioRun, nodeId, currentTick);
          setHoveredNode({
            id: node.id,
            name: node.name,
            serviceType: node.service_type,
            state,
            threshold: node.failure_threshold,
            pos: mousePos,
          });
        }
      },
    });

    sceneRef.current = scene;
    scene.loadScenario(scenarioRun, currentTick);

    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, [scenarioRun.scenario.id]); // Re-create scene only if scenario ID changes

  // Update scene when tick or selection changes
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.updateSceneState(currentTick, selectedNodeId);
    }
  }, [currentTick, selectedNodeId]);

  // Handle camera buttons
  const handleResetCamera = () => {
    sceneRef.current?.resetCamera();
  };

  const handleIsoCamera = () => {
    sceneRef.current?.setIsometricCamera();
  };

  const handleTopDownCamera = () => {
    sceneRef.current?.setTopDownCamera();
  };

  const handleFocusSelected = () => {
    if (selectedNodeId && sceneRef.current) {
      sceneRef.current.flyToBuilding(selectedNodeId);
    }
  };

  // Helper for service icon
  const renderServiceIcon = (type: string, className = 'w-3.5 h-3.5') => {
    switch (type) {
      case 'power':
        return <Zap className={`${className} text-[#FFC107]`} />;
      case 'water':
        return <Droplets className={`${className} text-[#00F0FF]`} />;
      case 'healthcare':
        return <HeartPulse className={`${className} text-[#10B981]`} />;
      case 'transport':
        return <Truck className={`${className} text-[#A855F7]`} />;
      case 'communications':
        return <Radio className={`${className} text-[#EC4899]`} />;
      default:
        return <Zap className={`${className} text-[#888]`} />;
    }
  };

  return (
    <div className={`relative w-full h-full min-h-[500px] overflow-hidden select-none ${isDarkMode ? 'bg-[#050505]' : 'bg-slate-100'}`}>
      {/* 3D Canvas Mount Point */}
      <div id="city-viewport-mount" ref={containerRef} className="w-full h-full absolute inset-0" />

      {/* Floating Viewport Controls (Top Left) */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-auto">
        <div className="flex items-center gap-1.5 p-1 bg-[#0A0A0A]/90 backdrop-blur-md border border-[#222] rounded-none shadow-2xl">
          <button
            id="btn-camera-iso"
            onClick={handleIsoCamera}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono uppercase font-bold text-[#CCC] hover:text-black hover:bg-white rounded-none transition-colors"
            title="Isometric 3D View"
          >
            <Compass className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span>Isometric</span>
          </button>

          <button
            id="btn-camera-top"
            onClick={handleTopDownCamera}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono uppercase font-bold text-[#CCC] hover:text-black hover:bg-white rounded-none transition-colors"
            title="Overhead Top-down Grid View"
          >
            <Maximize2 className="w-3.5 h-3.5 text-white" />
            <span>Top-Down</span>
          </button>

          <button
            id="btn-camera-reset"
            onClick={handleResetCamera}
            className="p-1.5 text-[#888] hover:text-black hover:bg-white rounded-none transition-colors"
            title="Reset Default Orbit"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {selectedNodeId && (
            <button
              id="btn-camera-focus"
              onClick={handleFocusSelected}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono uppercase font-bold text-black bg-[#00F0FF] hover:bg-white rounded-none transition-colors shadow-[0_0_8px_#00F0FF]"
              title="Fly to Selected Building"
            >
              <Eye className="w-3.5 h-3.5 text-black" />
              <span>Target [{selectedNodeId}]</span>
            </button>
          )}
        </div>
      </div>

      {/* District & Visual State Legend Overlay (Top Right) */}
      <div className="absolute top-4 right-4 z-10 hidden sm:flex items-center gap-2 pointer-events-auto">
        <div className="flex items-center gap-3 px-3 py-1.5 bg-[#0A0A0A]/90 backdrop-blur-md border border-[#222] text-xs text-[#AAA] shadow-xl font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#00F0FF] shadow-[0_0_6px_#00F0FF]" />
            <span className="text-[10px] uppercase font-bold text-[#888]">LIT (NOMINAL)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#FFC107] shadow-[0_0_6px_#FFC107] animate-pulse" />
            <span className="text-[10px] uppercase font-bold text-[#888]">AMBER (DEGRADED)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#FF003C] shadow-[0_0_6px_#FF003C] animate-ping" />
            <span className="text-[10px] uppercase font-bold text-[#888]">BLACKOUT (FAILED)</span>
          </div>
        </div>

        {onOpenLegend && (
          <button
            id="btn-open-legend"
            onClick={onOpenLegend}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A0A0A]/90 backdrop-blur-md border border-[#222] hover:border-white hover:bg-white hover:text-black text-xs font-mono uppercase font-bold text-[#CCC] shadow-xl transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#FF003C]" />
            <span>Guide</span>
          </button>
        )}
      </div>

      {/* Interactive Tooltip on Hover */}
      {hoveredNode && (
        <div
          id="node-hover-tooltip"
          className="pointer-events-none fixed z-50 transform -translate-x-1/2 -translate-y-full mb-3 px-3 py-2.5 bg-[#0A0A0A] border border-[#333] shadow-2xl text-xs text-white flex flex-col gap-1.5 min-w-[200px] max-w-[280px] font-mono rounded-none"
          style={{
            left: `${hoveredNode.pos.x}px`,
            top: `${hoveredNode.pos.y - 12}px`,
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#222] pb-1.5">
            <div className="flex items-center gap-1.5 font-bold uppercase truncate text-white">
              {renderServiceIcon(hoveredNode.serviceType)}
              <span className="truncate">{hoveredNode.name}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-[#888] uppercase">State:</span>
            <span
              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 ${
                hoveredNode.state === 'operational'
                  ? 'bg-white text-black'
                  : hoveredNode.state === 'degraded'
                  ? 'bg-[#FFC107] text-black shadow-[0_0_6px_#FFC107]'
                  : 'bg-[#FF003C] text-white shadow-[0_0_6px_#FF003C]'
              }`}
            >
              {hoveredNode.state}
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-[#888] uppercase">
            <span>Threshold:</span>
            <span className="text-white font-bold">{hoveredNode.threshold.toFixed(2)}</span>
          </div>

          <div className="text-[9px] text-[#FF003C] pt-0.5 uppercase tracking-wider text-center font-bold">
            [CLICK TO INSPECT ROOT CAUSE]
          </div>
        </div>
      )}

      {/* Bottom Subtle Navigation Hint */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none hidden md:block">
        <div className="text-[10px] text-[#666] font-mono bg-[#0A0A0A]/90 px-3 py-1 border border-[#222] uppercase tracking-wider">
          ORBIT: L-CLICK • PAN: R-CLICK • ZOOM: SCROLL • SELECT: CLICK NODE
        </div>
      </div>
    </div>
  );
};

