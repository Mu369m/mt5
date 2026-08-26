/**
 * @file frontend/src/pages/copier.tsx
 * @description Tenant control surface for Master-to-Slave terminal connections,
 * copier profiles, heartbeat status, and lifecycle event diagnostics.
 */

import React, { useEffect, useState } from 'react';
import { Activity, Link2, Plus, RefreshCw, Radio, ShieldCheck } from 'lucide-react';

interface Connection {
  id: string;
  name: string;
  platform: 'MT4' | 'MT5';
  role: 'MASTER' | 'SLAVE';
  status: string;
  lastHeartbeatAt?: string | null;
  runtime?: { status: string; lastHeartbeatAt: string | null } | null;
}

interface CopierProfile {
  id: string;
  name: string;
  enabled: boolean;
  masterConnectionId: string;
  volumeMultiplier: number;
  maxSlippagePoints: number;
  executionMode: 'SIMULATED' | 'LIVE';
  routingMode: 'B_BOOK_INTERNAL' | 'A_BOOK_FIX' | 'HYBRID_AUTO';
  reverseTrading: boolean;
}

export const Copier: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [profiles, setProfiles] = useState<CopierProfile[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<'MT4' | 'MT5'>('MT5');
  const [role, setRole] = useState<'MASTER' | 'SLAVE'>('MASTER');
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [masterConnectionId, setMasterConnectionId] = useState('');
  const [executionMode, setExecutionMode] = useState<'SIMULATED' | 'LIVE'>('SIMULATED');
  const [routingMode, setRoutingMode] = useState<'B_BOOK_INTERNAL' | 'A_BOOK_FIX' | 'HYBRID_AUTO'>('HYBRID_AUTO');

  const request = async (path: string, options?: RequestInit) => {
    const token = localStorage.getItem('brp_token');
    return fetch(path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options?.headers || {}) } });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [connectionsRes, profilesRes, eventsRes] = await Promise.all([
        request('/api/copier/connections'),
        request('/api/copier/profiles'),
        request('/api/copier/events?limit=20'),
      ]);
      if (connectionsRes.ok) setConnections(await connectionsRes.json());
      if (profilesRes.ok) setProfiles(await profilesRes.json());
      if (eventsRes.ok) setEvents(await eventsRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const addConnection = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await request('/api/copier/connections', { method: 'POST', body: JSON.stringify({ name, platform, role }) });
    if (response.ok) {
      setName('');
      setShowConnectionForm(false);
      await loadData();
    }
  };

  const addProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await request('/api/copier/profiles', { method: 'POST', body: JSON.stringify({ name: profileName, masterConnectionId, executionMode, routingMode }) });
    if (response.ok) {
      setProfileName('');
      setMasterConnectionId('');
      setShowProfileForm(false);
      await loadData();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-widest font-mono text-slate-100 uppercase">MASTER / SLAVE COPIER</h2>
          <p className="text-xs text-slate-400">Monitor terminal links and synchronize trade lifecycle events.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="flex items-center gap-2 rounded-custom border border-white/10 px-3 py-2 text-xs font-mono text-slate-300 hover:border-accent-cyan hover:text-accent-cyan"><RefreshCw className="h-3.5 w-3.5" /> REFRESH</button>
          <button onClick={() => setShowConnectionForm(true)} className="flex items-center gap-2 rounded-custom bg-accent-cyan px-3 py-2 text-xs font-bold font-mono text-[#0B0E14]"><Plus className="h-3.5 w-3.5" /> ADD TERMINAL</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="glass-panel rounded-custom bg-[#121721] p-6 lg:col-span-2">
          <div className="mb-5 flex items-center gap-2 border-b border-white/5 pb-3"><Link2 className="h-4 w-4 text-accent-cyan" /><h3 className="font-mono text-xs font-bold tracking-widest text-slate-200">TERMINAL CONNECTIONS</h3></div>
          {loading ? <p className="font-mono text-xs text-slate-500">Loading terminal registry...</p> : connections.length === 0 ? <p className="font-mono text-xs text-slate-500">No Master or Slave terminals registered.</p> : <div className="space-y-3">{connections.map((connection) => { const status = connection.runtime?.status || connection.status; return <div key={connection.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 py-3"><div><p className="font-mono text-sm font-bold text-slate-100">{connection.name}</p><p className="font-mono text-[10px] text-slate-500">{connection.platform} / {connection.role}</p></div><span className={`flex items-center gap-1.5 font-mono text-[10px] ${status === 'ONLINE' ? 'text-accent-green' : 'text-slate-500'}`}><Radio className="h-3.5 w-3.5" /> {status}</span></div>; })}</div>}
        </section>

        <section className="glass-panel rounded-custom bg-[#121721] p-6">
          <div className="mb-5 flex items-center justify-between gap-2 border-b border-white/5 pb-3"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent-green" /><h3 className="font-mono text-xs font-bold tracking-widest text-slate-200">COPY PROFILES</h3></div><button onClick={() => setShowProfileForm(true)} className="text-accent-cyan"><Plus className="h-4 w-4" /></button></div>
          {profiles.length === 0 ? <p className="font-mono text-xs text-slate-500">Create a profile after registering a Master.</p> : profiles.map((profile) => <div key={profile.id} className="mb-3 border-b border-white/5 pb-3"><div className="flex justify-between"><span className="font-mono text-xs text-slate-200">{profile.name}</span><span className={profile.enabled ? 'text-accent-green' : 'text-slate-500'}>{profile.enabled ? 'ON' : 'OFF'}</span></div><p className="mt-1 font-mono text-[10px] text-slate-500">x{Number(profile.volumeMultiplier).toFixed(2)} volume / {profile.maxSlippagePoints} pt max</p></div>)}
        </section>
      </div>

      <section className="glass-panel rounded-custom bg-[#121721] p-6">
        <div className="mb-5 flex items-center gap-2 border-b border-white/5 pb-3"><Activity className="h-4 w-4 text-accent-gold" /><h3 className="font-mono text-xs font-bold tracking-widest text-slate-200">LIFECYCLE EVENT LOG</h3></div>
        {events.length === 0 ? <p className="font-mono text-xs text-slate-500">No copier events received.</p> : <div className="overflow-x-auto"><table className="w-full text-left font-mono text-xs"><thead className="text-[10px] text-slate-500"><tr><th className="py-2">EVENT</th><th>TYPE</th><th>SYMBOL</th><th>STATUS</th><th>LATENCY</th></tr></thead><tbody>{events.map((event) => <tr key={event.id} className="border-t border-white/5 text-slate-300"><td className="py-3">{event.eventId}</td><td>{event.eventType}</td><td>{event.symbol}</td><td className={event.status === 'APPLIED' ? 'text-accent-green' : 'text-accent-gold'}>{event.status}</td><td>{event.latencyMs ?? '-'} ms</td></tr>)}</tbody></table></div>}
      </section>

      {showConnectionForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"><form onSubmit={addConnection} className="glass-panel w-full max-w-md space-y-4 rounded-custom bg-[#121721] p-6"><h3 className="font-mono text-sm font-bold tracking-widest text-slate-100">REGISTER TERMINAL</h3><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Terminal name" className="glass-input w-full px-3 py-2 text-sm" /><div className="grid grid-cols-2 gap-3"><select value={platform} onChange={(event) => setPlatform(event.target.value as 'MT4' | 'MT5')} className="glass-input px-3 py-2 text-sm"><option>MT5</option><option>MT4</option></select><select value={role} onChange={(event) => setRole(event.target.value as 'MASTER' | 'SLAVE')} className="glass-input px-3 py-2 text-sm"><option>MASTER</option><option>SLAVE</option></select></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowConnectionForm(false)} className="px-3 py-2 font-mono text-xs text-slate-400">CANCEL</button><button className="rounded-custom bg-accent-cyan px-3 py-2 font-mono text-xs font-bold text-[#0B0E14]">REGISTER</button></div></form></div>}
      {showProfileForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"><form onSubmit={addProfile} className="glass-panel w-full max-w-md space-y-4 rounded-custom bg-[#121721] p-6"><h3 className="font-mono text-sm font-bold tracking-widest text-slate-100">CREATE COPY PROFILE</h3><input required value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Profile name" className="glass-input w-full px-3 py-2 text-sm" /><select required value={masterConnectionId} onChange={(event) => setMasterConnectionId(event.target.value)} className="glass-input w-full px-3 py-2 text-sm"><option value="">Select Master terminal</option>{connections.filter((connection) => connection.role === 'MASTER').map((connection) => <option key={connection.id} value={connection.id}>{connection.name} ({connection.platform})</option>)}</select><div className="grid grid-cols-2 gap-3"><select value={executionMode} onChange={(event) => setExecutionMode(event.target.value as 'SIMULATED' | 'LIVE')} className="glass-input px-3 py-2 text-sm"><option value="SIMULATED">SIMULATED</option><option value="LIVE">LIVE</option></select><select value={routingMode} onChange={(event) => setRoutingMode(event.target.value as 'B_BOOK_INTERNAL' | 'A_BOOK_FIX' | 'HYBRID_AUTO')} className="glass-input px-3 py-2 text-sm"><option value="HYBRID_AUTO">HYBRID AUTO</option><option value="B_BOOK_INTERNAL">B-BOOK INTERNAL</option><option value="A_BOOK_FIX">A-BOOK FIX</option></select></div><p className="text-[10px] leading-4 text-slate-500">LIVE mode requires a registered broker adapter. It will fail closed until a real slave terminal is connected.</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowProfileForm(false)} className="px-3 py-2 font-mono text-xs text-slate-400">CANCEL</button><button className="rounded-custom bg-accent-cyan px-3 py-2 font-mono text-xs font-bold text-[#0B0E14]">CREATE PROFILE</button></div></form></div>}
    </div>
  );
};

export default Copier;
