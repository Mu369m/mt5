/**
 * @file frontend/src/pages/destinations.tsx
 * @description LP Destinations account configuration dashboard and the interactive Sandbox Order Panel.
 * Includes connection roundtrip diagnostic metrics and setting tooltips.
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Settings2, 
  Globe, 
  Cpu, 
  Play, 
  Activity, 
  Info,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import Tooltip from '../components/ui/tooltip';

interface LpDestination {
  id: string;
  brokerName: string;
  accountLabel: string;
  serverIp: string;
  port: number;
  loginId: string;
  accountMode: 'HEDGING' | 'NETTING';
  enableForwarding: boolean;
  deviationPt: number;
  magicId: number;
  lotsDivisor: number;
  destDealerWaitMs: number;
  pingMs?: number;
}

export const Destinations: React.FC = () => {
  const [destinations, setDestinations] = useState<LpDestination[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [brokerName, setBrokerName] = useState('');
  const [accountLabel, setAccountLabel] = useState('');
  const [serverIp, setServerIp] = useState('');
  const [port, setPort] = useState('443');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [accountMode, setAccountMode] = useState<'HEDGING' | 'NETTING'>('HEDGING');
  const [lotsDivisor, setLotsDivisor] = useState('1.0000');
  const [destDealerWaitMs, setDestDealerWaitMs] = useState('0');

  // Sandbox states
  const [sandboxDestId, setSandboxDestId] = useState('');
  const [sandboxSymbol, setSandboxSymbol] = useState('EURUSD');
  const [sandboxOrderType, setSandboxOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [sandboxLots, setSandboxLots] = useState('0.01');
  const [sandboxPrice, setSandboxPrice] = useState('');
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<any | null>(null);

  const fetchDestinations = async () => {
    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch('/api/destinations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDestinations(data);
        if (data.length > 0 && !sandboxDestId) {
          setSandboxDestId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed loading destinations', err);
    }
  };

  useEffect(() => {
    fetchDestinations();
  }, []);

  const handleAddDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch('/api/destinations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          brokerName,
          accountLabel,
          serverIp,
          port: parseInt(port),
          loginId,
          password,
          accountMode,
          lotsDivisor: parseFloat(lotsDivisor),
          destDealerWaitMs: parseInt(destDealerWaitMs),
          deviationPt: 10,
          magicId: 999999,
          enableForwarding: true
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed saving LP Destination');
      }

      setShowAddModal(false);
      // Reset form
      setBrokerName('');
      setAccountLabel('');
      setServerIp('');
      setLoginId('');
      setPassword('');
      setLotsDivisor('1.0000');
      setDestDealerWaitMs('0');
      
      fetchDestinations();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDestination = async (id: string) => {
    if (!confirm('Are you sure you want to remove this connection profile? This cascades all associated rules.')) return;
    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch(`/api/destinations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchDestinations();
      }
    } catch (err) {
      console.error('Delete target error', err);
    }
  };

  const handlePingTest = async (id: string) => {
    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch(`/api/destinations/${id}/ping`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDestinations(prev => prev.map(d => d.id === id ? { ...d, pingMs: data.latencyMs } : d));
      }
    } catch (err) {
      console.error('Ping test failed', err);
    }
  };

  const handleSandboxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxDestId) return;

    setSandboxLoading(true);
    setSandboxResult(null);

    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch('/api/sandbox/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          destinationId: sandboxDestId,
          symbol: sandboxSymbol,
          orderType: sandboxOrderType,
          lots: parseFloat(sandboxLots),
          price: sandboxPrice ? parseFloat(sandboxPrice) : undefined
        })
      });

      const data = await res.json();
      setSandboxResult(data);
    } catch (err: any) {
      setSandboxResult({ success: false, errorMessage: err.message });
    } finally {
      setSandboxLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Title & Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-widest font-mono text-slate-100 uppercase">LP CONNECTION GATEWAY</h2>
          <p className="text-xs text-slate-400">Configure external destinations, pings, and perform sandbox order dispatches</p>
        </div>

        <button
          id="add-lp-btn"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 py-2 px-4 text-xs font-bold font-mono tracking-widest text-[#0B0E14] bg-accent-cyan hover:bg-accent-cyan/85 rounded-custom transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>ADD DESTINATION</span>
        </button>
      </div>

      {/* Main Grid: Destinations Cards + Order Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Destinations Accounts Grid (Cols 1 & 2) */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xs font-bold tracking-widest font-mono text-slate-400 uppercase">CONNECTED DESTINATION BROKERS</h3>
          
          {destinations.length === 0 ? (
            <div className="glass-panel p-10 bg-[#121721] rounded-custom border-white/5 text-center text-slate-500 font-mono">
              <Globe className="w-12 h-12 mx-auto mb-4 opacity-25 animate-pulse text-accent-cyan" />
              <span>No destinations registered yet. Click &quot;ADD DESTINATION&quot; to connect your first LP.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {destinations.map((dest) => (
                <div key={dest.id} className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5 relative flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[10px] font-mono text-accent-cyan tracking-wider uppercase font-semibold">{dest.brokerName}</span>
                        <h4 className="text-sm font-bold text-slate-100">{dest.accountLabel}</h4>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePingTest(dest.id)}
                          className="p-1.5 rounded bg-black/40 hover:bg-black/60 text-slate-300 transition-colors text-xs font-mono"
                          title="Run Connection Ping"
                        >
                          Ping
                        </button>
                        <button
                          onClick={() => handleDeleteDestination(dest.id)}
                          className="p-1.5 rounded bg-accent-red/10 hover:bg-accent-red/20 text-accent-red transition-colors"
                          title="Remove Destination"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stats details */}
                    <div className="space-y-2 border-t border-white/5 pt-4 text-xs font-mono text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Server Host:</span>
                        <span>{dest.serverIp}:{dest.port}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Login ID:</span>
                        <span>{dest.loginId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Account Mode:</span>
                        <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-accent-gold">{dest.accountMode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Lots Divisor:</span>
                        <span>1 / {parseFloat(String(dest.lotsDivisor))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Dealer Overhead:</span>
                        <span>{dest.destDealerWaitMs} ms</span>
                      </div>
                    </div>
                  </div>

                  {/* Ping output badge */}
                  <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
                    <span className="text-[9px] font-mono text-slate-400">NODE LATENCY:</span>
                    {dest.pingMs !== undefined ? (
                      <span className={`text-xs font-mono font-bold ${
                        dest.pingMs > 100 ? 'text-accent-red' : dest.pingMs > 40 ? 'text-accent-gold' : 'text-accent-green'
                      }`}>
                        {dest.pingMs} ms
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-500">Not Tested</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Interactive Order Sandbox Panel (Col 3) */}
        <div className="space-y-6">
          <h3 className="text-xs font-bold tracking-widest font-mono text-slate-400 uppercase">INTERACTIVE ORDER SANDBOX</h3>

          <div className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5">
            <form onSubmit={handleSandboxSubmit} className="space-y-4">
              {/* Select target destination */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">
                  Target Destination <Tooltip content="Select which configured broker target client the order should route to." />
                </label>
                <select
                  id="sandbox-dest-select"
                  value={sandboxDestId}
                  onChange={(e) => setSandboxDestId(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs glass-input"
                >
                  {destinations.length === 0 ? (
                    <option value="">No Destinations Configured</option>
                  ) : (
                    destinations.map(d => (
                      <option key={d.id} value={d.id}>{d.accountLabel} ({d.brokerName})</option>
                    ))
                  )}
                </select>
              </div>

              {/* Symbol input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">
                  Symbol <Tooltip content="The asset ticker symbol to buy or sell, e.g. EURUSD or XAUUSD." />
                </label>
                <input
                  id="sandbox-symbol-input"
                  type="text"
                  required
                  value={sandboxSymbol}
                  onChange={(e) => setSandboxSymbol(e.target.value)}
                  className="w-full py-2 px-3 text-xs glass-input font-mono"
                  placeholder="EURUSD"
                />
              </div>

              {/* Order direction and lot sizes side-by-side */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">
                    Lots Size <Tooltip content="Simulated client contract sizing. Divisor normalizes this to institutional volume." />
                  </label>
                  <input
                    id="sandbox-lots-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={sandboxLots}
                    onChange={(e) => setSandboxLots(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">
                    Order Type <Tooltip content="BUY represents bid execution, SELL represents ask execution." />
                  </label>
                  <select
                    id="sandbox-type-select"
                    value={sandboxOrderType}
                    onChange={(e) => setSandboxOrderType(e.target.value as 'BUY' | 'SELL')}
                    className="w-full py-2 px-3 text-xs glass-input"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
              </div>

              {/* Custom price feed simulation (optional) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">
                  Simulated Market Price (Optional) <Tooltip content="Leave blank to let the simulator generate mock live spreads feeds based on the asset digits." />
                </label>
                <input
                  id="sandbox-price-input"
                  type="number"
                  step="0.00001"
                  value={sandboxPrice}
                  onChange={(e) => setSandboxPrice(e.target.value)}
                  className="w-full py-2 px-3 text-xs glass-input font-mono"
                  placeholder="e.g. 1.08250"
                />
              </div>

              <button
                id="sandbox-exec-btn"
                type="submit"
                disabled={sandboxLoading || !sandboxDestId}
                className="w-full py-3 text-xs font-bold tracking-widest text-[#0B0E14] bg-accent-green hover:bg-accent-green/85 rounded-custom transition-all shadow-[0_0_15px_rgba(0,230,118,0.2)] disabled:opacity-50 cursor-pointer uppercase font-mono"
              >
                {sandboxLoading ? 'ROUTING TRANSACTION...' : 'DISPATCH TEST PACKET'}
              </button>
            </form>

            {/* Sandbox Execution Diagnostics Result */}
            {sandboxResult && (
              <div className="mt-6 border-t border-white/5 pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold font-mono tracking-wider text-slate-300 uppercase">EXECUTION REPORT</h4>
                  {sandboxResult.success ? (
                    <span className="text-[10px] font-mono font-bold text-accent-green bg-accent-green/10 border border-accent-green/20 px-2 py-0.5 rounded uppercase">
                      Filled
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold text-accent-red bg-accent-red/10 border border-accent-red/20 px-2 py-0.5 rounded uppercase">
                      Rejected
                    </span>
                  )}
                </div>

                {sandboxResult.success ? (
                  <div className="space-y-2.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Order ID:</span>
                      <span className="text-slate-200">{sandboxResult.orderId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Target Asset Symbol:</span>
                      <span className="text-slate-200">{sandboxResult.finalSymbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Volume Scaling:</span>
                      <span className="text-slate-200">{sandboxResult.requestedLots.toFixed(2)} → {sandboxResult.scaledLots.toFixed(4)} Lots</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Marked Price / Filled Price:</span>
                      <span className="text-slate-200">{sandboxResult.requestedPrice} → {sandboxResult.fillPrice}</span>
                    </div>
                    
                    {/* Performance badging */}
                    <div className="flex justify-between items-center border-t border-white/5 pt-3 mt-3">
                      <span className="text-slate-400">Slippage Points:</span>
                      <span className={`text-xs font-bold font-mono ${
                        sandboxResult.slippagePoints > 10 ? 'text-accent-red' : sandboxResult.slippagePoints > 5 ? 'text-accent-gold' : 'text-accent-green'
                      }`}>
                        {sandboxResult.slippagePoints} points
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Latency Counter:</span>
                      <span className="text-xs font-bold text-accent-cyan bg-accent-cyan/10 px-2 py-0.5 rounded">
                        {sandboxResult.executionLatencyMs} ms
                      </span>
                    </div>

                    {/* Proprietary state descriptors */}
                    <div className="border-t border-white/5 pt-3 mt-3 space-y-1">
                      {sandboxResult.isNettedInternally && (
                        <div className="flex items-center gap-1.5 text-[10px] text-accent-cyan uppercase">
                          <CheckCircle className="w-3.5 h-3.5" /> Netted (100% Commission Saved)
                        </div>
                      )}
                      {sandboxResult.isNewsShieldActive && (
                        <div className="flex items-center gap-1.5 text-[10px] text-accent-gold uppercase">
                          <AlertTriangle className="w-3.5 h-3.5" /> Volatility Shield (+25 pt markup)
                        </div>
                      )}
                      {sandboxResult.isToxicBotDetected && (
                        <div className="flex items-center gap-1.5 text-[10px] text-accent-red uppercase">
                          <Flame className="w-3.5 h-3.5 animate-pulse" /> HFT Toxic flow check (+{sandboxResult.toxicDelayAddedMs}ms delay)
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 text-xs bg-accent-red/10 border border-accent-red/20 text-accent-red rounded-custom font-mono">
                    ERROR: {sandboxResult.errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Add Destination Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 glass-panel bg-[#121721] rounded-custom border-white/10">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-white/5">
              <h3 className="text-sm font-bold tracking-widest font-mono text-slate-100 uppercase">ADD LP TARGET CONNECTION</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 font-mono text-xs cursor-pointer"
              >
                [ESC] CLOSE
              </button>
            </div>

            <form onSubmit={handleAddDestination} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Broker Name</label>
                  <input
                    id="add-broker-name"
                    type="text"
                    required
                    value={brokerName}
                    onChange={(e) => setBrokerName(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input"
                    placeholder="IC Markets"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Account Custom Label</label>
                  <input
                    id="add-account-label"
                    type="text"
                    required
                    value={accountLabel}
                    onChange={(e) => setAccountLabel(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input"
                    placeholder="Bridge LP 01"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Server host IP</label>
                  <input
                    id="add-server-ip"
                    type="text"
                    required
                    value={serverIp}
                    onChange={(e) => setServerIp(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input"
                    placeholder="192.168.1.100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Bridge Port</label>
                  <input
                    id="add-port"
                    type="number"
                    required
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Login ID</label>
                  <input
                    id="add-login-id"
                    type="text"
                    required
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono"
                    placeholder="e.g. 500123"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Encrypted Password</label>
                  <input
                    id="add-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Lots Divisor</label>
                  <input
                    id="add-lots-divisor"
                    type="number"
                    step="0.0001"
                    required
                    value={lotsDivisor}
                    onChange={(e) => setLotsDivisor(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Bridge Delay (ms)</label>
                  <input
                    id="add-dealer-wait"
                    type="number"
                    required
                    value={destDealerWaitMs}
                    onChange={(e) => setDestDealerWaitMs(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Account Mode</label>
                  <select
                    id="add-account-mode"
                    value={accountMode}
                    onChange={(e) => setAccountMode(e.target.value as 'HEDGING' | 'NETTING')}
                    className="w-full py-2 px-3 text-xs glass-input"
                  >
                    <option value="HEDGING">HEDGING</option>
                    <option value="NETTING">NETTING</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-2 px-4 text-xs font-semibold text-slate-400 border border-white/5 hover:bg-white/5 rounded-custom transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="add-lp-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="py-2 px-5 text-xs font-bold tracking-widest text-[#0B0E14] bg-accent-cyan hover:bg-accent-cyan/85 rounded-custom transition-all shadow-[0_0_12px_rgba(0,240,255,0.2)] cursor-pointer"
                >
                  {loading ? 'DEPLOYING...' : 'REGISTER CONNECTION'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Destinations;
