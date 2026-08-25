import React, { useEffect, useState } from 'react';
import { ScenarioRun } from '../types';
import { getSystemConditionCounts } from '../data/dataStore';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

interface PlaybackControlsProps {
  scenarioRun: ScenarioRun;
  currentTick: number;
  onTickChange: (tick: number) => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  scenarioRun,
  currentTick,
  onTickChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1 = 1.2s per tick

  const snapshots = scenarioRun.result.snapshots;
  const maxTick = snapshots.length > 0 ? snapshots[snapshots.length - 1].time : 0;
  const minTick = snapshots.length > 0 ? snapshots[0].time : 0;

  // Auto-advance loop when playing
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = Math.max(300, 1200 / playbackSpeed);
    const interval = setInterval(() => {
      onTickChange((prev) => {
        if (prev >= maxTick) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, maxTick, onTickChange]);

  const handleTogglePlay = () => {
    if (currentTick >= maxTick && !isPlaying) {
      onTickChange(minTick);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleStepBack = () => {
    setIsPlaying(false);
    onTickChange(Math.max(minTick, currentTick - 1));
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    onTickChange(Math.min(maxTick, currentTick + 1));
  };

  const handleJumpStart = () => {
    setIsPlaying(false);
    onTickChange(minTick);
  };

  const handleJumpEnd = () => {
    setIsPlaying(false);
    onTickChange(maxTick);
  };

  const conditionCounts = getSystemConditionCounts(scenarioRun, currentTick);

  return (
    <div
      id="playback-dock"
      className="w-full max-w-5xl mx-auto px-4 py-3 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-xl border border-gray-300 dark:border-[#222] rounded-none shadow-2xl flex flex-col gap-3 transition-colors duration-300"
    >
      {/* Top Row: System Condition Breakdown & Playback Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Current Time Stamp */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black dark:bg-white text-white dark:text-black font-mono font-bold text-xs uppercase tracking-wider shadow-[0_0_8px_rgba(0,0,0,0.2)] dark:shadow-[0_0_8px_rgba(255,255,255,0.3)]">
            <Clock className="w-3.5 h-3.5" />
            <span>T-{currentTick < 10 ? `0${currentTick}` : currentTick}</span>
          </div>

          <span className="text-gray-500 dark:text-[#888] hidden sm:inline text-[11px] font-mono uppercase tracking-wider">
            {currentTick === 0
              ? '[INIT_STATE: SHOCK_ORIGIN]'
              : currentTick === maxTick
              ? '[FINAL_STATE: STABILIZED]'
              : '[PROPAGATING_CASCADE]'}
          </span>
        </div>

        {/* Real-time discrete condition tally */}
        <div className="flex items-center gap-2 font-mono">
          <div className="flex items-center gap-1.5 px-2 py-0.5 border border-gray-300 dark:border-[#333] text-[#0090AA] dark:text-[#00F0FF] text-[11px] font-bold uppercase">
            <div className="w-1.5 h-1.5 rounded-full bg-[#0090AA] dark:bg-[#00F0FF] shadow-[0_0_6px_#0090AA] dark:shadow-[0_0_6px_#00F0FF]" />
            <span>{conditionCounts.operational} OPERATIONAL</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 border border-gray-300 dark:border-[#333] text-[#D4A000] dark:text-[#FFC107] text-[11px] font-bold uppercase">
            <div className="w-1.5 h-1.5 rounded-full bg-[#D4A000] dark:bg-[#FFC107] shadow-[0_0_6px_#D4A000] dark:shadow-[0_0_6px_#FFC107]" />
            <span>{conditionCounts.degraded} DEGRADED</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#FF003C] text-white text-[11px] font-bold uppercase shadow-[0_0_8px_rgba(255,0,60,0.4)]">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
            <span>{conditionCounts.failed} FAILED</span>
          </div>
        </div>
      </div>

      {/* Center Row: Scrub Slider with Tick Markers */}
      <div className="flex items-center gap-3 w-full">
        <span className="text-[11px] text-gray-500 dark:text-[#666] font-mono whitespace-nowrap uppercase font-bold">T-00</span>

        <div className="relative flex-1 flex items-center">
          <input
            id="tick-scrubber-slider"
            type="range"
            min={minTick}
            max={maxTick}
            step={1}
            value={currentTick}
            onChange={(e) => {
              setIsPlaying(false);
              onTickChange(Number(e.target.value));
            }}
            className="w-full h-2 bg-gray-200 dark:bg-[#1A1A1A] rounded-none appearance-none cursor-pointer accent-black dark:accent-white hover:accent-[#FF003C] transition-all focus:outline-none"
          />

          {/* Tick step pips */}
          <div className="absolute left-0 right-0 top-3 flex justify-between pointer-events-none px-1">
            {snapshots.map((snap) => (
              <div key={snap.time} className="flex flex-col items-center">
                <div
                  className={`w-1 h-1.5 ${
                    snap.time === currentTick ? 'bg-black dark:bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)] dark:shadow-[0_0_8px_#FFF]' : 'bg-gray-300 dark:bg-[#333]'
                  }`}
                />
                <span
                  className={`text-[9px] font-mono mt-0.5 ${
                    snap.time === currentTick ? 'text-black dark:text-white font-bold' : 'text-gray-400 dark:text-[#555]'
                  }`}
                >
                  {snap.time}
                </span>
              </div>
            ))}
          </div>
        </div>

        <span className="text-[11px] text-gray-500 dark:text-[#666] font-mono whitespace-nowrap uppercase font-bold">
          T-{maxTick < 10 ? `0${maxTick}` : maxTick}
        </span>
      </div>

      {/* Bottom Row: Media Transport Buttons & Speed Toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-300 dark:border-[#222]">
        {/* Left: Speed selector */}
        <div className="flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-gray-500 dark:text-[#666]" />
          <span className="text-[11px] text-gray-500 dark:text-[#666] font-mono uppercase font-bold mr-1">Speed:</span>
          {[0.5, 1, 2].map((speed) => (
            <button
              key={speed}
              id={`btn-speed-${speed}x`}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-2 py-0.5 text-[11px] font-mono uppercase font-bold transition-colors ${
                playbackSpeed === speed
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'text-gray-500 dark:text-[#888] hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#222]'
              }`}
            >
              {speed}X
            </button>
          ))}
        </div>

        {/* Center: Main Playback Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            id="btn-jump-start"
            onClick={handleJumpStart}
            className="p-1.5 text-gray-500 dark:text-[#888] hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#222] transition-colors"
            title="Jump to Start (Tick 0)"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            id="btn-step-prev"
            onClick={handleStepBack}
            disabled={currentTick <= minTick}
            className="p-1.5 text-gray-400 dark:text-[#AAA] hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#222] disabled:opacity-30 transition-colors"
            title="Step Back 1 Tick"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            id="btn-toggle-play"
            onClick={handleTogglePlay}
            className="flex items-center justify-center w-9 h-9 bg-black dark:bg-white hover:bg-[#FF003C] hover:text-white dark:hover:bg-[#FF003C] active:scale-95 text-white dark:text-black font-black shadow-[0_0_12px_rgba(0,0,0,0.3)] dark:shadow-[0_0_12px_rgba(255,255,255,0.3)] transition-all"
            title={isPlaying ? 'Pause Simulation' : 'Play Cascade Simulation'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            id="btn-step-next"
            onClick={handleStepForward}
            disabled={currentTick >= maxTick}
            className="p-1.5 text-gray-400 dark:text-[#AAA] hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#222] disabled:opacity-30 transition-colors"
            title="Step Forward 1 Tick"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            id="btn-jump-end"
            onClick={handleJumpEnd}
            className="p-1.5 text-gray-500 dark:text-[#888] hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#222] transition-colors"
            title="Jump to End"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Quick Context Label */}
        <div className="text-[11px] text-gray-500 dark:text-[#666] font-mono uppercase font-bold hidden md:block">
          {isPlaying ? (
            <span className="text-[#FF003C] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF003C] shadow-[0_0_6px_#FF003C] animate-ping" />
              PROPAGATING_TIMESTEP
            </span>
          ) : (
            'SYSTEM_PAUSED'
          )}
        </div>
      </div>
    </div>
  );
};

