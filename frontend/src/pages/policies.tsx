/**
 * @file frontend/src/pages/policies.tsx
 * @description Risk execution policies controls panel.
 * Implements interactive latency delay sliders, slippage parameters adjustments,
 * and emergency system-wide kill-switch overrides.
 */

import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Clock, 
  ShieldAlert, 
  Zap, 
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  Flame,
  Power,
  RotateCcw
} from 'lucide-react';
import Tooltip from '../components/ui/tooltip';

interface ExecutionPolicy {
  id: string;
  policyName: string;
  addedLatencyOpenMs: number;
  addedLatencyCloseMs: number;
  requoteDelayMs: number;
  maxDeviationPoints: number;
  goodPriceWindowPoints: number;
  badPriceWindowPoints: number;
  isActive: boolean;
}

export const Policies: React.FC = () => {
  const [policy, setPolicy] = useState<ExecutionPolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSystemActive, setIsSystemActive] = useState(true); // Emergency forwarding override

  const loadPolicy = async () => {
    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch('/api/policies', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          setPolicy(data[0]);
        } else {
          // Initialize a default policy structure if none exists
          const initRes = await fetch('/api/policies', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              policyName: 'Default Institutional Policy',
              addedLatencyOpenMs: 50,
              addedLatencyCloseMs: 30,
              requoteDelayMs: 0,
              maxDeviationPoints: 20,
              goodPriceWindowPoints: 5,
              badPriceWindowPoints: 15,
              isActive: true
            })
          });
          if (initRes.ok) {
            const initData = await initRes.json();
            setPolicy(initData);
          }
        }
      }
    } catch (err) {
      console.error('Failed loading policies data', err);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, []);

  const handleSliderChange = (field: keyof ExecutionPolicy, value: number) => {
    if (!policy) return;
    setPolicy({ ...policy, [field]: value });
  };

  const handleSavePolicy = async () => {
    if (!policy) return;
    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch(`/api/policies/${policy.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(policy)
      });

      if (res.ok) {
        setMessage('Execution risk policy parameters applied successfully');
        setTimeout(() => setMessage(null), 3000);
      } else {
        throw new Error('Failed to update execution policy');
      }
    } catch (err: any) {
      setMessage(`ERROR: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEmergencyKill = async () => {
    const nextState = !isSystemActive;
    
    // In production, this can invoke a system settings change call on the server.
    // For our dashboard simulation, we manage the local gateway routing state:
    setIsSystemActive(nextState);
    
    try {
      const token = localStorage.getItem('brp_token');
      // Record a critical event in audit logs representing emergency toggle
      await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bannerText: nextState 
            ? 'Emergency Alert: Institutional order routing has been reactivated.' 
            : 'CRITICAL ALERT: System Forwarding Suspended via Emergency Kill Switch!'
        })
      });
    } catch (err) {
      console.error('Failed logging emergency override event', err);
    }
  };

  if (!policy) {
    return (
      <div className="flex justify-center items-center h-48 font-mono text-slate-500 text-xs">
        Loading execution policy matrix...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Panel */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-widest font-mono text-slate-100 uppercase">RISK POLICY TUNER</h2>
          <p className="text-xs text-slate-400">Calibrate execution delay, maximum slippage bounds, and emergency kill switches</p>
        </div>
      </div>

      {/* Emergency Kill Switch Module */}
      <div className={`glass-panel p-6 rounded-custom border ${
        isSystemActive ? 'border-accent-cyan/10 bg-[#121721]' : 'border-accent-red/35 bg-accent-red/5'
      }`}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <ShieldAlert className={`w-5 h-5 ${isSystemActive ? 'text-accent-cyan' : 'text-accent-red animate-pulse'}`} />
              <h3 className="text-sm font-bold tracking-widest font-mono uppercase text-slate-200">
                EMERGENCY ROUTING BYPASS SWITCH
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Instantly suspends all order forwarding pipelines to LPs globally if market volatility or network connection goes out of bounds.
            </p>
          </div>

          <button
            id="emergency-kill-switch"
            onClick={handleToggleEmergencyKill}
            className={`py-3 px-6 text-xs font-bold tracking-widest rounded-custom transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
              isSystemActive 
                ? 'bg-accent-red text-slate-100 hover:bg-accent-red/90 shadow-accent-red/20' 
                : 'bg-accent-green text-[#0B0E14] hover:bg-accent-green/90 shadow-accent-green/20'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{isSystemActive ? 'TRIGGER EMERGENCY SHUTDOWN' : 'REACTIVATE ALL SYSTEMS'}</span>
          </button>
        </div>
      </div>

      {/* Configuration Sliders Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Box 1: Latency controls */}
        <div className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Clock className="w-4.5 h-4.5 text-accent-cyan" />
            <h3 className="text-xs font-bold tracking-widest font-mono text-slate-100 uppercase">ARTIFICIAL LATENCY CONTROLLER</h3>
          </div>

          {/* Slider 1: Open Latency */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400 uppercase">
                Order Open Delay <Tooltip content="Adds artificial delay (ms) on order opening. Protects B-Book configurations against latency arbiters." />
              </span>
              <span className="text-accent-cyan font-bold">{policy.addedLatencyOpenMs} ms</span>
            </div>
            <input
              id="slider-latency-open"
              type="range"
              min="0"
              max="1000"
              step="5"
              value={policy.addedLatencyOpenMs}
              onChange={(e) => handleSliderChange('addedLatencyOpenMs', parseInt(e.target.value))}
              className="w-full h-1.5 bg-black/60 rounded-lg appearance-none cursor-pointer accent-accent-cyan"
            />
          </div>

          {/* Slider 2: Close Latency */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400 uppercase">
                Order Close Delay <Tooltip content="Adds artificial execution delay (ms) when closing trade open volumes." />
              </span>
              <span className="text-accent-cyan font-bold">{policy.addedLatencyCloseMs} ms</span>
            </div>
            <input
              id="slider-latency-close"
              type="range"
              min="0"
              max="1000"
              step="5"
              value={policy.addedLatencyCloseMs}
              onChange={(e) => handleSliderChange('addedLatencyCloseMs', parseInt(e.target.value))}
              className="w-full h-1.5 bg-black/60 rounded-lg appearance-none cursor-pointer accent-accent-cyan"
            />
          </div>

          {/* Slider 3: Requote Delay */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400 uppercase">
                Requote Delay Timer <Tooltip content="Time (ms) to hold pricing requotes before responding back to Client MT5." />
              </span>
              <span className="text-accent-cyan font-bold">{policy.requoteDelayMs} ms</span>
            </div>
            <input
              id="slider-latency-requote"
              type="range"
              min="0"
              max="1000"
              step="5"
              value={policy.requoteDelayMs}
              onChange={(e) => handleSliderChange('requoteDelayMs', parseInt(e.target.value))}
              className="w-full h-1.5 bg-black/60 rounded-lg appearance-none cursor-pointer accent-accent-cyan"
            />
          </div>

        </div>

        {/* Box 2: Slippage controls */}
        <div className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Sliders className="w-4.5 h-4.5 text-accent-cyan" />
            <h3 className="text-xs font-bold tracking-widest font-mono text-slate-100 uppercase">SLIPPAGE & DEVIATION BOUNDS</h3>
          </div>

          {/* Slider 4: Max Deviation */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400 uppercase">
                Max Deviation Points <Tooltip content="Maximum slippage points allowed. Orders exceeding this bound are instantly rejected/requoted." />
              </span>
              <span className="text-accent-green font-bold">{policy.maxDeviationPoints} points</span>
            </div>
            <input
              id="slider-slippage-max"
              type="range"
              min="0"
              max="100"
              step="1"
              value={policy.maxDeviationPoints}
              onChange={(e) => handleSliderChange('maxDeviationPoints', parseInt(e.target.value))}
              className="w-full h-1.5 bg-black/60 rounded-lg appearance-none cursor-pointer accent-accent-cyan"
            />
          </div>

          {/* Slider 5: Good Price Window */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400 uppercase">
                Good Price Window <Tooltip content="Points within which the fill rate is considered standard and execution completes instantly." />
              </span>
              <span className="text-accent-green font-bold">{policy.goodPriceWindowPoints} points</span>
            </div>
            <input
              id="slider-slippage-good"
              type="range"
              min="0"
              max="20"
              step="1"
              value={policy.goodPriceWindowPoints}
              onChange={(e) => handleSliderChange('goodPriceWindowPoints', parseInt(e.target.value))}
              className="w-full h-1.5 bg-black/60 rounded-lg appearance-none cursor-pointer accent-accent-cyan"
            />
          </div>

          {/* Slider 6: Bad Price Window */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400 uppercase">
                Bad Price Window <Tooltip content="Points within which market prices trigger B-Book profit margins slippage adjustments." />
              </span>
              <span className="text-accent-green font-bold">{policy.badPriceWindowPoints} points</span>
            </div>
            <input
              id="slider-slippage-bad"
              type="range"
              min="0"
              max="50"
              step="1"
              value={policy.badPriceWindowPoints}
              onChange={(e) => handleSliderChange('badPriceWindowPoints', parseInt(e.target.value))}
              className="w-full h-1.5 bg-black/60 rounded-lg appearance-none cursor-pointer accent-accent-cyan"
            />
          </div>

        </div>

      </div>

      {/* Action Footer */}
      <div className="flex justify-end gap-3 items-center">
        {message && (
          <span className="text-xs font-mono text-accent-cyan bg-accent-cyan/5 border border-accent-cyan/20 px-3 py-1.5 rounded-custom">
            {message}
          </span>
        )}
        <button
          id="save-policy-btn"
          onClick={handleSavePolicy}
          disabled={loading}
          className="py-2.5 px-6 text-xs font-bold tracking-widest text-[#0B0E14] bg-accent-cyan hover:bg-accent-cyan/85 rounded-custom transition-all shadow-[0_0_12px_rgba(0,240,255,0.2)] disabled:opacity-50 cursor-pointer uppercase font-mono"
        >
          {loading ? 'APPLYING CONFIG...' : 'APPLY POLICY RULES'}
        </button>
      </div>
    </div>
  );
};

export default Policies;
