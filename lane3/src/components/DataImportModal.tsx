import React, { useState, useRef } from 'react';
import { ScenarioRun } from '../types';
import { validateScenarioRun } from '../data/dataStore';
import {
  X,
  Upload,
  FileCode,
  AlertCircle,
  CheckCircle2,
  Download,
  RotateCcw,
  Code2,
} from 'lucide-react';

interface DataImportModalProps {
  currentScenario: ScenarioRun;
  isOpen: boolean;
  onClose: () => void;
  onLoadScenario: (scenario: ScenarioRun) => void;
  onResetSamples: () => void;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  currentScenario,
  isOpen,
  onClose,
  onLoadScenario,
  onResetSamples,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'contract'>('upload');
  const [jsonText, setJsonText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        const result = validateScenarioRun(parsed);
        if (result.valid && result.data) {
          onLoadScenario(result.data);
          setSuccessMsg(`Successfully loaded scenario: "${result.data.scenario.name}"`);
          setTimeout(() => {
            onClose();
          }, 900);
        } else {
          setErrorMsg(result.error || 'JSON did not match required ScenarioRun contract.');
        }
      } catch (err) {
        setErrorMsg('Invalid JSON file syntax: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
  };

  const handlePasteSubmit = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const parsed = JSON.parse(jsonText);
      const result = validateScenarioRun(parsed);
      if (result.valid && result.data) {
        onLoadScenario(result.data);
        setSuccessMsg(`Successfully loaded scenario: "${result.data.scenario.name}"`);
        setTimeout(() => {
          onClose();
        }, 900);
      } else {
        setErrorMsg(result.error || 'JSON did not match required ScenarioRun contract.');
      }
    } catch (err) {
      setErrorMsg('Invalid JSON syntax: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentScenario, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${currentScenario.scenario.id}-simulation-run.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#0A0A0A] border border-[#222] rounded-none shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#E0E0E0]">
        {/* Header */}
        <div className="p-5 border-b border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white text-black font-black">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-[#666] font-bold uppercase tracking-widest font-mono">
                DATA EXCHANGE PROTOCOL
              </p>
              <h2 className="text-xl font-black italic uppercase text-white font-display">
                Simulation Data Contract Manager
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

        {/* Tab Selection */}
        <div className="flex border-b border-[#222] px-5 bg-[#080808]">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-3 px-4 text-xs font-mono uppercase font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'upload'
                ? 'border-white text-white bg-[#111]'
                : 'border-transparent text-[#888] hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload JSON</span>
          </button>

          <button
            onClick={() => setActiveTab('paste')}
            className={`py-3 px-4 text-xs font-mono uppercase font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'paste'
                ? 'border-white text-white bg-[#111]'
                : 'border-transparent text-[#888] hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Paste Raw JSON</span>
          </button>

          <button
            onClick={() => setActiveTab('contract')}
            className={`py-3 px-4 text-xs font-mono uppercase font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'contract'
                ? 'border-white text-white bg-[#111]'
                : 'border-transparent text-[#888] hover:text-white'
            }`}
          >
            <span>Contract Spec</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3.5 bg-[#150005] border border-[#FF003C] text-xs font-mono text-white flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#FF003C] shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-[#051508] border border-[#10B981] text-xs font-mono text-white flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
              <div>{successMsg}</div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-[#444] hover:border-white bg-[#0D0D0D] hover:bg-[#141414] p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all gap-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="p-3 bg-[#222] text-white">
                <Upload className="w-7 h-7" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-black uppercase text-white font-mono">
                  DROP SIMULATION JSON FILE HERE
                </span>
                <span className="text-xs text-[#888] font-mono uppercase">
                  COMPLIANT WITH LANE 3 SCENARIORUN INTERFACE
                </span>
              </div>
            </div>
          )}

          {activeTab === 'paste' && (
            <div className="flex flex-col gap-3">
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='{\n  "scenario": { "id": "custom-run", ... },\n  "result": { ... },\n  "metrics": { ... }\n}'
                rows={10}
                className="w-full p-3.5 bg-[#050505] border border-[#333] font-mono text-xs text-white focus:outline-none focus:border-white"
              />
              <button
                onClick={handlePasteSubmit}
                disabled={!jsonText.trim()}
                className="w-full py-2.5 bg-white hover:bg-[#FF003C] hover:text-white disabled:opacity-30 text-black font-black uppercase text-xs transition-colors"
              >
                Validate & Load Dataset
              </button>
            </div>
          )}

          {activeTab === 'contract' && (
            <div className="bg-[#050505] p-4 border border-[#222] overflow-x-auto text-[11px] font-mono text-[#AAA]">
              <pre>{`{
  "scenario": {
    "id": "cross-service-cascade",
    "name": "Cross-service cascade",
    "description": "Power failure propagates through water...",
    "graph_id": "central-city-services-v1",
    "nodes": [{ "id": "power-west", "name": "West Power Substation", "service_type": "power", "failure_threshold": 0.7 }],
    "edges": [{ "upstream_id": "power-west", "dependent_id": "water-plant", "weight": 0.8 }],
    "initial_disruptions": ["power-west"]
  },
  "result": {
    "scenario_id": "cross-service-cascade",
    "seed": 2002,
    "start_time": 0,
    "end_time": 6,
    "snapshots": [{ "time": 0, "node_states": { "power-west": "failed" } }],
    "events": [{ "time": 1, "node_id": "water-plant", "previous_state": "operational", "next_state": "degraded", "cause": "threshold_exceeded", "source_node_id": "power-west" }]
  },
  "metrics": { ... }
}`}</pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#0A0A0A] border-t border-[#222] flex items-center justify-between gap-3 font-mono">
          <button
            onClick={() => {
              onResetSamples();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase text-[#888] hover:text-white hover:bg-[#222] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset 6 Default Scenarios</span>
          </button>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase text-black bg-white hover:bg-[#00F0FF] transition-colors shadow-[0_0_8px_rgba(255,255,255,0.2)]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Active [{currentScenario.scenario.id}]</span>
          </button>
        </div>
      </div>
    </div>
  );
};

