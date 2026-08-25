import React from 'react';
import {
  X,
  Zap,
  Droplets,
  HeartPulse,
  Truck,
  Radio,
  Activity,
  Layers,
  Compass,
} from 'lucide-react';

interface HelpLegendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpLegendModal: React.FC<HelpLegendModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#0A0A0A] border border-[#222] rounded-none shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#E0E0E0]">
        {/* Header */}
        <div className="p-5 border-b border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white text-black font-black">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-[#666] font-bold uppercase tracking-widest font-mono">
                OPERATIONAL RUNBOOK // FIELD GUIDE
              </p>
              <h2 className="text-xl font-black italic uppercase text-white font-display">
                Cascade City Visual Guide & Legend
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 border border-[#333] hover:border-white hover:bg-white hover:text-black text-[#888] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6 text-xs text-[#AAA] font-mono">
          {/* Section 1: Building State Visual Language */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-[10px] text-[#666] font-bold uppercase tracking-widest">
                TELEMETRY MAPPING
              </p>
              <h3 className="text-base font-black italic uppercase text-white font-display flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#00F0FF]" />
                <span>3-Way Discrete State Representation</span>
              </h3>
            </div>
            <p className="text-[#888] leading-relaxed uppercase text-[11px]">
              States in the simulation engine are strictly discrete string values (<span className="text-white font-bold">OPERATIONAL</span>, <span className="text-[#FFC107] font-bold">DEGRADED</span>, <span className="text-[#FF003C] font-bold">FAILED</span>). Visual state is communicated through night-city illumination, glowing roof beacons, and dynamic smoke/spark particles rather than building height.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3.5 bg-[#0D0D0D] border border-[#222] flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-white font-bold uppercase">
                  <span className="w-2.5 h-2.5 bg-white inline-block"></span>
                  <span>Operational</span>
                </div>
                <div className="text-[10px] text-[#888] leading-relaxed uppercase">
                  Windows emit warm/white steady glow, green roof beacon light, nominal energy pulse across outgoing conduits.
                </div>
              </div>

              <div className="p-3.5 bg-[#141005] border border-[#FFC107]/40 flex flex-col gap-1.5 shadow-[0_0_12px_rgba(255,193,7,0.1)]">
                <div className="flex items-center gap-2 text-[#FFC107] font-bold uppercase">
                  <span className="w-2.5 h-2.5 bg-[#FFC107] inline-block shadow-[0_0_6px_#FFC107]"></span>
                  <span>Degraded</span>
                </div>
                <div className="text-[10px] text-[#BBB] leading-relaxed uppercase">
                  Amber window flicker, strobe amber beacon, rising light smoke haze, reduced conduit energy throughput.
                </div>
              </div>

              <div className="p-3.5 bg-[#180508] border border-[#FF003C]/50 flex flex-col gap-1.5 shadow-[0_0_12px_rgba(255,0,60,0.15)]">
                <div className="flex items-center gap-2 text-[#FF003C] font-bold uppercase">
                  <span className="w-2.5 h-2.5 bg-[#FF003C] inline-block shadow-[0_0_6px_#FF003C]"></span>
                  <span>Failed</span>
                </div>
                <div className="text-[10px] text-[#BBB] leading-relaxed uppercase">
                  Building dark (unlit windows), intense red rooftop emergency beacon strobe, heavy smoke and sparks, conduit dims/sparks.
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Architectural Kits by Service Type */}
          <div className="flex flex-col gap-3 pt-4 border-t border-[#222]">
            <div className="flex flex-col gap-1">
              <p className="text-[10px] text-[#666] font-bold uppercase tracking-widest">
                DISTRICT INFRASTRUCTURE
              </p>
              <h3 className="text-base font-black italic uppercase text-white font-display flex items-center gap-2">
                <Layers className="w-4 h-4 text-white" />
                <span>Service Type Architectural Districts</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 bg-[#0D0D0D] border border-[#222] flex items-center gap-3">
                <div className="p-2 bg-[#FFC107] text-black">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white uppercase">Power & Grid</div>
                  <div className="text-[10px] text-[#888] uppercase">Transformer substations, cooling silos, glowing core</div>
                </div>
              </div>

              <div className="p-3 bg-[#0D0D0D] border border-[#222] flex items-center gap-3">
                <div className="p-2 bg-[#00F0FF] text-black">
                  <Droplets className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white uppercase">Water Utilities</div>
                  <div className="text-[10px] text-[#888] uppercase">Filtration reservoirs, water level gauge, pump housing</div>
                </div>
              </div>

              <div className="p-3 bg-[#0D0D0D] border border-[#222] flex items-center gap-3">
                <div className="p-2 bg-[#10B981] text-black">
                  <HeartPulse className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white uppercase">Healthcare & Life Support</div>
                  <div className="text-[10px] text-[#888] uppercase">Multi-tier medical ward, green cross, helipad</div>
                </div>
              </div>

              <div className="p-3 bg-[#0D0D0D] border border-[#222] flex items-center gap-3">
                <div className="p-2 bg-[#A855F7] text-black">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white uppercase">Transit & Logistics</div>
                  <div className="text-[10px] text-[#888] uppercase">Terminal platform, elevated dispatch tower, rail track</div>
                </div>
              </div>

              <div className="p-3 bg-[#0D0D0D] border border-[#222] flex items-center gap-3 sm:col-span-2">
                <div className="p-2 bg-[#EC4899] text-black">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white uppercase">Communications & Networks</div>
                  <div className="text-[10px] text-[#888] uppercase">Bunker server vault, tall lattice antenna mast, satellite microwave dishes</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Conduit Flow & Diagnostics */}
          <div className="flex flex-col gap-2 pt-4 border-t border-[#222]">
            <h4 className="font-bold text-white uppercase">Camera & Interaction Controls</h4>
            <ul className="list-disc list-inside space-y-1 text-[#888] text-[10px] uppercase">
              <li><strong className="text-white">Left-Click + Drag:</strong> Orbit camera around the city center</li>
              <li><strong className="text-white">Right-Click + Drag:</strong> Pan camera horizontally and vertically</li>
              <li><strong className="text-white">Scroll Wheel:</strong> Zoom in and out</li>
              <li><strong className="text-white">Click any Building:</strong> Smoothly pivots camera to target and opens the Node Inspector drawer</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0A0A0A] border-t border-[#222] flex justify-end font-mono">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-[#FF003C] hover:text-white text-black font-black uppercase text-xs transition-colors"
          >
            CONFIRM & RETURN TO SIMULATION
          </button>
        </div>
      </div>
    </div>
  );
};

