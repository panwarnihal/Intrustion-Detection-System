import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  Video, 
  Activity, 
  Terminal, 
  Trash2, 
  Download, 
  RefreshCw, 
  Camera, 
  CheckCircle, 
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';
const WS_BASE = 'ws://localhost:8000/ws/alerts';

function App() {
  const [logs, setLogs] = useState([]);
  const [activeMode, setActiveMode] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    camera: 'disconnected',
    camera_fps: 0,
    process_scanner: 'idle',
    process_count: 0,
    active_mode: false
  });
  
  const [consoleMsgs, setConsoleMsgs] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Play a retro double-beep cybersecurity warning sound using Web Audio API
  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Tone 1
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, audioCtx.currentTime); // B5 note
      gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.12);
      
      // Tone 2 (Double tap)
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(783.99, audioCtx.currentTime); // G5 note
        gain2.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
        osc2.start(audioCtx.currentTime);
        osc2.stop(audioCtx.currentTime + 0.18);
      }, 100);
    } catch (e) {
      console.warn("Audio alert failed (user interaction might be required first):", e);
    }
  };

  const addConsoleMessage = (msg) => {
    const time = new Date().toLocaleTimeString();
    setConsoleMsgs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  // Fetch initial logs and system mode
  const fetchData = async () => {
    try {
      const logsRes = await fetch(`${API_BASE}/logs`);
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData);
      }
      
      const modeRes = await fetch(`${API_BASE}/mode`);
      if (modeRes.ok) {
        const modeData = await modeRes.json();
        setActiveMode(modeData.active_mode);
      }
    } catch (error) {
      addConsoleMessage(`Error fetching system history: ${error.message}`);
    }
  };

  // Establish WebSocket connection
  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    addConsoleMessage("Connecting to core telemetry stream...");
    setIsReconnecting(true);
    
    const ws = new WebSocket(WS_BASE);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      addConsoleMessage("Telemetry channel connected. Scanning operational.");
      fetchData(); // Sync database changes
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'status') {
          setSystemStatus(msg.data);
          setActiveMode(msg.data.active_mode);
        } else if (msg.type === 'threat') {
          // Prepend new incident
          setLogs(prev => [msg.data, ...prev]);
          addConsoleMessage(`⚠️ ALERT: Threat detected - ${msg.data.threat_category} | Details: ${msg.data.target_detail}`);
          
          // Sound alarm if a threat action took place (not when cleared)
          if (!msg.data.target_detail.includes("cleared")) {
            playAlertSound();
          }
        }
      } catch (err) {
        console.error("Error decoding websocket frame:", err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      addConsoleMessage("Telemetry link closed. Reconnecting shortly...");
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error("Websocket error:", error);
      ws.close();
    };
  };

  useEffect(() => {
    connectWebSocket();
    fetchData();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Toggle Mode REST request
  const handleToggleMode = async () => {
    const nextMode = !activeMode;
    try {
      addConsoleMessage(`Switching system to ${nextMode ? 'ACTIVE FORCE-KILL' : 'PASSIVE MONITOR-ONLY'} mode...`);
      const res = await fetch(`${API_BASE}/toggle-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextMode })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveMode(data.active_mode);
        addConsoleMessage(`Enforcement Mode updated: ${data.active_mode ? 'ACTIVE' : 'PASSIVE'}`);
      } else {
        addConsoleMessage("Failed to update system mode (API error)");
      }
    } catch (err) {
      addConsoleMessage(`Network error toggling mode: ${err.message}`);
    }
  };

  // Clear Logs REST request
  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to clear all incident history?")) return;
    
    try {
      const res = await fetch(`${API_BASE}/clear-logs`, { method: 'POST' });
      if (res.ok) {
        setLogs([]);
        addConsoleMessage("Security audit logs database cleared.");
      }
    } catch (err) {
      addConsoleMessage(`Failed to clear logs: ${err.message}`);
    }
  };

  // Export JSON file utility
  const handleExportJSON = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `security_incident_report_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      addConsoleMessage("Audit report downloaded successfully.");
    } catch (e) {
      addConsoleMessage(`Export failed: ${e.message}`);
    }
  };

  // Format ISO timestamps
  const formatTime = (isoString) => {
    try {
      if (!isoString || isNaN(Date.parse(isoString))) {
        // If integer timestamp, parse as epoch
        if (typeof isoString === 'number') {
          return new Date(isoString * 1000).toLocaleTimeString();
        }
        return "N/A";
      }
      const d = new Date(isoString);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    } catch (e) {
      return "N/A";
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col antialiased">
      {/* Header bar */}
      <header className="glass-panel border-b border-slate-800 sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-950/50 rounded-lg border border-blue-500/30">
            {activeMode ? (
              <ShieldAlert className="h-7 w-7 text-red-500 status-active-red" />
            ) : (
              <Shield className="h-7 w-7 text-green-500 status-active-green" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-slate-100 uppercase">
              OmniGuard Endpoint
            </h1>
            <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
              <span>Security Agent v1.0.0</span>
              <span className="text-slate-600">•</span>
              <span className={`inline-block h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span>{isConnected ? 'ONLINE' : isReconnecting ? 'RECONNECTING...' : 'OFFLINE'}</span>
            </p>
          </div>
        </div>

        {/* Global Enforcement Toggle */}
        <div className="flex items-center gap-4 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800">
          <span className={`text-xs font-bold font-mono px-3 py-1.5 rounded-lg transition-colors ${!activeMode ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'text-slate-500'}`}>
            PASSIVE MONITOR
          </span>
          
          <button
            onClick={handleToggleMode}
            className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${activeMode ? 'bg-red-600' : 'bg-slate-700'}`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${activeMode ? 'translate-x-7' : 'translate-x-0'}`}
            />
          </button>

          <span className={`text-xs font-bold font-mono px-3 py-1.5 rounded-lg transition-colors ${activeMode ? 'bg-red-500/10 text-red-400 border border-red-500/30 animate-threat' : 'text-slate-500'}`}>
            ACTIVE FORCE-KILL
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        
        {/* Status Grid Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Camera monitor status */}
          <div className="glass-card p-5 rounded-2xl flex flex-col justify-between min-h-[140px] hover:border-slate-700 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest font-mono">Webcam Scanner (AI)</span>
                <h3 className="text-lg font-bold text-slate-200 mt-1 flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-blue-400" />
                  YOLOv8 Nano (CPU)
                </h3>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                systemStatus.camera === 'connected' ? 'bg-green-950/30 text-green-400 border-green-500/30' :
                systemStatus.camera === 'error' ? 'bg-red-950/30 text-red-400 border-red-500/30' :
                'bg-slate-950/30 text-slate-400 border-slate-500/30'
              }`}>
                {systemStatus.camera.toUpperCase()}
              </span>
            </div>
            
            <div className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-3">
              <div className="text-xs font-mono text-slate-400">
                Performance: <span className="text-blue-400 font-bold">{systemStatus.camera_fps} FPS</span>
              </div>
              <div className="text-xs font-mono text-slate-400">
                Target: <span className="text-amber-500">cell phone</span>
              </div>
            </div>
          </div>

          {/* Card 2: Process Monitor Status */}
          <div className="glass-card p-5 rounded-2xl flex flex-col justify-between min-h-[140px] hover:border-slate-700 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest font-mono">Process Scanner</span>
                <h3 className="text-lg font-bold text-slate-200 mt-1 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-purple-400" />
                  Background Watcher
                </h3>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                systemStatus.process_scanner === 'running' ? 'bg-green-950/30 text-green-400 border-green-500/30' :
                systemStatus.process_scanner === 'error' ? 'bg-red-950/30 text-red-400 border-red-500/30' :
                'bg-slate-950/30 text-slate-400 border-slate-500/30'
              }`}>
                {systemStatus.process_scanner.toUpperCase()}
              </span>
            </div>
            
            <div className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-3">
              <div className="text-xs font-mono text-slate-400">
                Scanned: <span className="text-purple-400 font-bold">{systemStatus.process_count} OS Procs</span>
              </div>
              <div className="text-xs font-mono text-slate-400">
                Interval: <span className="text-slate-300">2.0s</span>
              </div>
            </div>
          </div>

          {/* Card 3: Global Enforcement Policy */}
          <div className={`glass-card p-5 rounded-2xl flex flex-col justify-between min-h-[140px] transition-all duration-300 ${activeMode ? 'border-red-500/30 bg-red-950/5' : 'hover:border-slate-700'}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest font-mono">Enforcement Policy</span>
                <h3 className="text-lg font-bold text-slate-200 mt-1 flex items-center gap-1.5">
                  {activeMode ? (
                    <ShieldAlert className="h-4 w-4 text-red-400" />
                  ) : (
                    <Shield className="h-4 w-4 text-green-400" />
                  )}
                  {activeMode ? 'Active Protection' : 'Monitor-Only'}
                </h3>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${activeMode ? 'bg-red-950/30 text-red-400 border-red-500/30 animate-threat' : 'bg-green-950/30 text-green-400 border-green-500/30'}`}>
                {activeMode ? 'ARMED' : 'SAFE'}
              </span>
            </div>
            
            <div className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-3">
              <div className="text-xs font-mono text-slate-400">
                Threat Action: <span className={activeMode ? 'text-red-400 font-bold' : 'text-green-400'}>{activeMode ? 'Force Kill & Block' : 'Alert Dashboard'}</span>
              </div>
            </div>
          </div>

        </section>

        {/* Console and Controls Split Panel */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Logs & Table Feed - Takes 2 cols on desktop */}
          <div className="glass-panel lg:col-span-2 rounded-2xl border border-slate-800 p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-blue-500" />
                <h2 className="text-base font-bold text-slate-200 uppercase tracking-wider">Incident Registry</h2>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportJSON}
                  disabled={logs.length === 0}
                  className="flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300 font-mono px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  title="Export database log history as JSON"
                >
                  <Download className="h-3.5 w-3.5" />
                  EXPORT
                </button>
                
                <button
                  onClick={handleClearLogs}
                  disabled={logs.length === 0}
                  className="flex items-center gap-1.5 text-xs bg-red-950/20 border border-red-900/30 hover:bg-red-950/40 text-red-400 font-mono px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  title="Wipe database logs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  CLEAR
                </button>
              </div>
            </div>

            {/* Logs Table */}
            <div className="overflow-x-auto border border-slate-800/80 rounded-xl max-h-[380px]">
              <table className="min-w-full divide-y divide-slate-800/80 text-left text-xs font-mono">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Target / Detail</th>
                    <th className="px-4 py-3 text-right">Action Policy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 bg-slate-950/20">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-slate-500">
                        No security incidents logged. Endpoint is secure.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, index) => {
                      const isClear = log.target_detail.includes("cleared");
                      const isPhysical = log.threat_category === 'Physical Device';
                      return (
                        <tr key={index} className={`hover:bg-slate-900/30 transition-colors ${
                          isClear ? 'text-green-400 bg-green-950/5' : 
                          isPhysical ? 'text-amber-400 bg-amber-950/5' : 'text-purple-400 bg-purple-950/5'
                        }`}>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                            {formatTime(log.timestamp)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-bold flex items-center gap-1.5">
                            {isClear ? (
                              <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                            ) : isPhysical ? (
                              <Camera className="h-3.5 w-3.5 text-amber-400" />
                            ) : (
                              <Video className="h-3.5 w-3.5 text-purple-400" />
                            )}
                            {log.threat_category}
                          </td>
                          <td className="px-4 py-3 max-w-[200px] truncate" title={log.target_detail}>
                            {log.target_detail}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                              log.action_taken.includes("Killed") ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-threat' :
                              log.action_taken.includes("Blocked") ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              log.action_taken.includes("Restored") ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                              'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {log.action_taken}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Console Debug feed - Takes 1 col */}
          <div className="glass-panel rounded-2xl border border-slate-800 p-5 flex flex-col h-[470px]">
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="h-5 w-5 text-green-500" />
              <h2 className="text-base font-bold text-slate-200 uppercase tracking-wider">Live Agent Feed</h2>
            </div>
            
            <div className="flex-1 bg-slate-950/70 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-green-400 overflow-y-auto leading-relaxed flex flex-col-reverse">
              {consoleMsgs.length === 0 ? (
                <div className="text-slate-600 text-center py-4">Waiting for agent diagnostic logs...</div>
              ) : (
                consoleMsgs.map((msg, idx) => (
                  <div key={idx} className="mb-1 text-left break-all border-b border-slate-900 pb-1">
                    {msg}
                  </div>
                ))
              )}
            </div>
          </div>

        </section>

        {/* Settings and Target Info */}
        <section className="glass-panel rounded-2xl p-5 border border-slate-800">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 font-mono mb-3">Target Reference Database</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 font-mono text-xs">
            {["obs64.exe", "snippingtool", "sharex.exe", "screenflow", "quicktime", "cell phone"].map((target, idx) => (
              <div key={idx} className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80 text-center text-slate-400 flex flex-col justify-center items-center">
                <span className="font-bold text-slate-300">{target}</span>
                <span className="text-[10px] text-slate-500 mt-1 uppercase">Monitor Active</span>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Footer copyright */}
      <footer className="py-4 border-t border-slate-900 mt-auto text-center font-mono text-xs text-slate-600">
        OmniGuard Endpoint Agent Console • Built for Unauthorized Capture Prevention
      </footer>
    </div>
  );
}

export default App;
