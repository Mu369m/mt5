/**
 * @file frontend/src/pages/super-admin.tsx
 * @description Super Admin SaaS dashboard.
 * Implements tenant licensing directory, no-code visual site customizer (Hex color inputs,
 * radius sliders), hardware diagnostics, and global administrative broadcasts.
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Paintbrush, 
  HardDrive, 
  Terminal, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Radio, 
  Check, 
  AlertOctagon,
  Slider
} from 'lucide-react';
import { useTheme } from '../theme';

interface Tenant {
  id: string;
  companyName: string;
  email: string;
  licenseKey: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  maxDestinations: number;
  monthlyVolumeLimitLots: number;
  licenseExpiresAt: string;
}

export const SuperAdmin: React.FC = () => {
  const { theme, branding, updateTheme, updateBranding, loadBrandingAndTheme } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'tenants' | 'customizer' | 'telemetry'>('tenants');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [telemetry, setTelemetry] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Tenant form states
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [maxDestinations, setMaxDestinations] = useState('5');
  const [monthlyLimit, setMonthlyLimit] = useState('10000.00');

  // Broadcast state
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  // Customizer local edits state
  const [customPrimary, setCustomPrimary] = useState(theme.primaryAccent);
  const [customBg, setCustomBg] = useState(theme.bgVoid);
  const [customCard, setCustomCard] = useState(theme.cardSurface);
  const [customRadius, setCustomRadius] = useState(theme.borderRadius.replace('px', ''));
  const [customTitle, setCustomTitle] = useState(branding.siteTitle);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('brp_token');
      const [tenantsRes, telemRes, logsRes] = await Promise.all([
        fetch('/api/admin/tenants', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/telemetry', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/audit-logs?limit=15', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (tenantsRes.ok) setTenants(await tenantsRes.json());
      if (telemRes.ok) setTelemetry(await telemRes.json());
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setAuditLogs(logsData.logs || []);
      }
    } catch (err) {
      console.error('Failed loading Super Admin metadata', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          companyName,
          email,
          maxDestinations: parseInt(maxDestinations),
          monthlyVolumeLimitLots: parseFloat(monthlyLimit),
          durationMonths: 12
        })
      });

      if (res.ok) {
        setShowAddTenant(false);
        setCompanyName('');
        setEmail('');
        loadData();
      }
    } catch (err) {
      console.error('Tenant provisioning error', err);
    }
  };

  const handleToggleTenantStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch(`/api/admin/tenants/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error('Toggle status error', err);
    }
  };

  const handleRevokeTenant = async (id: string) => {
    if (!confirm('Hard revoke subscription? All tenant configurations will be deleted cascades.')) return;
    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch(`/api/admin/tenants/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error('Purging tenant error', err);
    }
  };

  const handleSaveBrandingCustomizer = async () => {
    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          themeConfig: {
            ...theme,
            primaryAccent: customPrimary,
            bgVoid: customBg,
            cardSurface: customCard,
            borderRadius: `${customRadius}px`
          },
          brandingConfig: {
            ...branding,
            siteTitle: customTitle
          }
        })
      });

      if (res.ok) {
        updateTheme({
          primaryAccent: customPrimary,
          bgVoid: customBg,
          cardSurface: customCard,
          borderRadius: `${customRadius}px`
        });
        updateBranding({
          siteTitle: customTitle
        });
        alert('Visual CMS customizer styles applied and compiled globally!');
        await loadBrandingAndTheme();
      }
    } catch (err) {
      console.error('Visual CMS save failure', err);
    }
  };

  const handleBroadcastAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText) return;

    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bannerText: broadcastText })
      });

      if (res.ok) {
        setBroadcastText('');
        setBroadcastSuccess(true);
        setTimeout(() => setBroadcastSuccess(false), 3000);
        loadData();
      }
    } catch (err) {
      console.error('Broadcast failure', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Panel */}
      <div>
        <h2 className="text-xl font-bold tracking-widest font-mono text-slate-100 uppercase">SAAS SUPERADMIN CONSOLE</h2>
        <p className="text-xs text-slate-400">Manage client licenses, adjust visual CMS themes, and view cluster server health</p>
      </div>

      {/* Tabs selectors */}
      <div className="flex gap-2 border-b border-white/5 pb-px">
        <button
          onClick={() => setActiveTab('tenants')}
          className={`pb-3 px-4 text-xs font-bold tracking-wider font-mono uppercase transition-all border-b-2 cursor-pointer ${
            activeTab === 'tenants' 
              ? 'border-accent-cyan text-accent-cyan' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Tenant Subscriptions
          </span>
        </button>
        <button
          onClick={() => setActiveTab('customizer')}
          className={`pb-3 px-4 text-xs font-bold tracking-wider font-mono uppercase transition-all border-b-2 cursor-pointer ${
            activeTab === 'customizer' 
              ? 'border-accent-cyan text-accent-cyan' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <Paintbrush className="w-4 h-4" /> Visual Site Customizer
          </span>
        </button>
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`pb-3 px-4 text-xs font-bold tracking-wider font-mono uppercase transition-all border-b-2 cursor-pointer ${
            activeTab === 'telemetry' 
              ? 'border-accent-cyan text-accent-cyan' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <HardDrive className="w-4 h-4" /> Telemetry & Logs
          </span>
        </button>
      </div>

      {/* Tab: Tenants Directory */}
      {activeTab === 'tenants' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold tracking-widest font-mono text-slate-400 uppercase">TENANT DIRECTORY</h3>
            <button
              onClick={() => setShowAddTenant(true)}
              className="flex items-center gap-1.5 py-1.5 px-3 text-xs font-bold font-mono tracking-wider text-[#0B0E14] bg-accent-green hover:bg-accent-green/85 rounded-custom transition-all shadow-[0_0_10px_rgba(0,230,118,0.2)] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ISSUE LICENSE</span>
            </button>
          </div>

          <div className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-slate-400 font-mono text-[10px] tracking-wider">
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4">Client Email</th>
                  <th className="py-3 px-4">License Key</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">LP limit</th>
                  <th className="py-3 px-4 text-right">Lots Limit</th>
                  <th className="py-3 px-4 text-center">Expires</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tenants.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-500 font-mono">No client profiles provisioned.</td>
                  </tr>
                ) : (
                  tenants.map((t) => (
                    <tr key={t.id} className="hover:bg-white/2 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-200">{t.companyName}</td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">{t.email}</td>
                      <td className="py-3.5 px-4 text-accent-cyan font-mono select-all uppercase tracking-wider">{t.licenseKey}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          t.status === 'ACTIVE' ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-200">{t.maxDestinations}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-200">
                        {Number(t.monthlyVolumeLimitLots).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                        {new Date(t.licenseExpiresAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleToggleTenantStatus(t.id, t.status)}
                            className="px-2 py-1 bg-black/40 hover:bg-black/60 rounded text-[10px] font-mono tracking-wide text-slate-300 cursor-pointer"
                          >
                            {t.status === 'ACTIVE' ? 'SUSPEND' : 'REACTIVATE'}
                          </button>
                          <button
                            onClick={() => handleRevokeTenant(t.id)}
                            className="p-1 rounded bg-accent-red/10 hover:bg-accent-red/20 text-accent-red transition-all cursor-pointer"
                            title="Revoke subscription"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Visual CMS Customizer */}
      {activeTab === 'customizer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls Editor (Cols 1 & 2) */}
          <div className="lg:col-span-2 glass-panel p-6 bg-[#121721] rounded-custom border-white/5 space-y-6">
            <h3 className="text-xs font-bold tracking-widest font-mono text-slate-400 uppercase">NO-CODE VISUAL CUSTOMIZER</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Site Name Title */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Site Title Header</label>
                <input
                  id="customizer-site-title"
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full py-2 px-3 text-xs glass-input font-bold"
                />
              </div>

              {/* Accent Color */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Primary Accent Color (Neon)</label>
                <div className="flex gap-2">
                  <input
                    id="customizer-accent-picker"
                    type="color"
                    value={customPrimary}
                    onChange={(e) => setCustomPrimary(e.target.value)}
                    className="w-8 h-8 rounded border border-white/10 bg-transparent cursor-pointer shrink-0"
                  />
                  <input
                    id="customizer-accent-hex"
                    type="text"
                    value={customPrimary}
                    onChange={(e) => setCustomPrimary(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono uppercase"
                  />
                </div>
              </div>

              {/* Void Color */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Void Background Color</label>
                <div className="flex gap-2">
                  <input
                    id="customizer-bg-picker"
                    type="color"
                    value={customBg}
                    onChange={(e) => setCustomBg(e.target.value)}
                    className="w-8 h-8 rounded border border-white/10 bg-transparent cursor-pointer shrink-0"
                  />
                  <input
                    id="customizer-bg-hex"
                    type="text"
                    value={customBg}
                    onChange={(e) => setCustomBg(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono uppercase"
                  />
                </div>
              </div>

              {/* Card Color */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Card Surface Color</label>
                <div className="flex gap-2">
                  <input
                    id="customizer-card-picker"
                    type="color"
                    value={customCard}
                    onChange={(e) => setCustomCard(e.target.value)}
                    className="w-8 h-8 rounded border border-white/10 bg-transparent cursor-pointer shrink-0"
                  />
                  <input
                    id="customizer-card-hex"
                    type="text"
                    value={customCard}
                    onChange={(e) => setCustomCard(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono uppercase"
                  />
                </div>
              </div>

              {/* Border Radius */}
              <div className="space-y-2 col-span-2">
                <div className="flex justify-between text-[10px] font-mono text-slate-400 uppercase">
                  <span>Border Corner Radius</span>
                  <span className="text-accent-cyan font-bold">{customRadius} px</span>
                </div>
                <input
                  id="customizer-radius-slider"
                  type="range"
                  min="0"
                  max="24"
                  step="1"
                  value={customRadius}
                  onChange={(e) => setCustomRadius(e.target.value)}
                  className="w-full h-1.5 bg-black/60 rounded-lg appearance-none cursor-pointer accent-accent-cyan"
                />
              </div>

            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-white/5">
              <button
                onClick={handleSaveBrandingCustomizer}
                className="py-2.5 px-6 text-xs font-bold tracking-widest text-[#0B0E14] bg-accent-cyan hover:bg-accent-cyan/85 rounded-custom transition-all shadow-[0_0_12px_rgba(0,240,255,0.2)] cursor-pointer font-mono uppercase"
              >
                Compile and Publish layout
              </button>
            </div>
          </div>

          {/* Interactive CSS preview (Col 3) */}
          <div className="space-y-6">
            <h3 className="text-xs font-bold tracking-widest font-mono text-slate-400 uppercase">REAL-TIME CSS INJECTOR</h3>
            
            <div className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5 space-y-4">
              <div className="flex items-center gap-1 text-slate-300 font-mono text-xs">
                <Terminal className="w-4 h-4 text-accent-green" />
                <span>Generated CSS Variables</span>
              </div>
              <pre className="text-[10px] font-mono bg-black/50 p-4 rounded text-accent-cyan overflow-x-auto leading-relaxed border border-white/5">
{`:root {
  --accent-cyan: ${customPrimary};
  --bg-void: ${customBg};
  --bg-card: ${customCard};
  --border-radius: ${customRadius}px;
  --font-family: 'Inter';
}`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Infrastructure Telemetry & Logs */}
      {activeTab === 'telemetry' && (
        <div className="space-y-8">
          
          {/* Broadcaster + Hardware meters */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Announcement Broadcaster (Cols 1 & 2) */}
            <div className="lg:col-span-2 glass-panel p-6 bg-[#121721] rounded-custom border-white/5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-white/5">
                <Radio className="w-4.5 h-4.5 text-accent-cyan" />
                <h3 className="text-xs font-bold tracking-widest font-mono text-slate-100 uppercase">ADMINISTRATIVE BROADCAST TRANSMITTER</h3>
              </div>
              <p className="text-xs text-slate-400">
                Pushes a scrolling emergency announcement banner on top of all logged-in client dashboard panels in real-time.
              </p>
              
              <form onSubmit={handleBroadcastAnnouncement} className="space-y-4">
                <input
                  id="broadcast-msg-input"
                  type="text"
                  required
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs glass-input"
                  placeholder="e.g. Server Migration Scheduled for 23:00 GMT. Latency spikes expected."
                />
                <div className="flex justify-end gap-3 items-center">
                  {broadcastSuccess && (
                    <span className="text-[10px] font-mono text-accent-green bg-accent-green/5 border border-accent-green/20 px-2 py-1 rounded">
                      Broadcast complete
                    </span>
                  )}
                  <button
                    id="broadcast-submit-btn"
                    type="submit"
                    className="py-2 px-4 text-xs font-bold font-mono tracking-wider text-[#0B0E14] bg-accent-cyan hover:bg-accent-cyan/85 rounded-custom transition-all shadow-[0_0_10px_rgba(0,240,255,0.2)] cursor-pointer"
                  >
                    TRANSMIT ANNOUNCEMENT
                  </button>
                </div>
              </form>
            </div>

            {/* Hardware Telemetry metrics (Col 3) */}
            <div className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5 space-y-5 text-xs font-mono">
              <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                <HardDrive className="w-4.5 h-4.5 text-accent-cyan" />
                <h3 className="text-xs font-bold tracking-widest font-mono text-slate-100 uppercase">SERVER METRICS</h3>
              </div>

              {telemetry ? (
                <div className="space-y-4">
                  {/* CPU utilization */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">CPU Usage:</span>
                      <span className="text-accent-cyan">{telemetry.cpu.utilizationPercent}%</span>
                    </div>
                    <div className="bg-black/60 h-2 rounded-full overflow-hidden">
                      <div className="bg-accent-cyan h-full" style={{ width: `${telemetry.cpu.utilizationPercent}%` }}></div>
                    </div>
                  </div>

                  {/* RAM utilization */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">RAM Allocation:</span>
                      <span className="text-accent-cyan">{telemetry.memory.usedGB} / {telemetry.memory.totalGB} GB</span>
                    </div>
                    <div className="bg-black/60 h-2 rounded-full overflow-hidden">
                      <div className="bg-accent-cyan h-full" style={{ width: `${telemetry.memory.utilizationPercent}%` }}></div>
                    </div>
                  </div>

                  <div className="flex justify-between border-t border-white/5 pt-3">
                    <span className="text-slate-400">Database Driver:</span>
                    <span className="text-slate-200">{telemetry.db.driver}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active Pool Conns:</span>
                    <span className="text-accent-green font-bold">{telemetry.db.activeConnections} sockets</span>
                  </div>
                </div>
              ) : (
                <span className="text-slate-500">Querying diagnostics...</span>
              )}
            </div>

          </div>

          {/* Paginated Global Audit Logs */}
          <div className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Terminal className="w-4.5 h-4.5 text-accent-cyan" />
                <h3 className="text-xs font-bold tracking-widest font-mono text-slate-100 uppercase">SYSTEM-WIDE AUDIT LOGGER</h3>
              </div>
              <span className="text-[10px] text-slate-400 uppercase font-mono">Cascading event outputs</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-slate-400 font-mono text-[9px] tracking-wider uppercase">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Message Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-slate-300">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-500">No logs returned.</td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/2 transition-colors">
                        <td className="py-2 px-3 text-slate-400 text-[10px]">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="py-2 px-3 text-accent-cyan font-bold text-[10px]">{log.eventType}</td>
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            log.logLevel === 'CRITICAL' || log.logLevel === 'ERROR'
                              ? 'bg-accent-red/10 text-accent-red' 
                              : log.logLevel === 'WARN' 
                                ? 'bg-accent-gold/10 text-accent-gold' 
                                : 'bg-accent-green/10 text-accent-green'
                          }`}>
                            {log.logLevel}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-200 text-xs">{log.message}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Provision License Modal */}
      {showAddTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 glass-panel bg-[#121721] rounded-custom border-white/10">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-white/5">
              <h3 className="text-sm font-bold tracking-widest font-mono text-slate-100 uppercase">PROVISION TENANT LICENSE</h3>
              <button 
                onClick={() => setShowAddTenant(false)}
                className="text-slate-400 hover:text-slate-200 font-mono text-xs cursor-pointer"
              >
                [ESC] CLOSE
              </button>
            </div>

            <form onSubmit={handleAddTenantSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Tenant Company Name</label>
                <input
                  id="add-tenant-name"
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full py-2 px-3 text-xs glass-input"
                  placeholder="Apex Asset Management"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Client Admin Operator Email</label>
                <input
                  id="add-tenant-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full py-2 px-3 text-xs glass-input"
                  placeholder="admin@apexassets.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Max LP Destinations</label>
                  <input
                    id="add-tenant-maxlps"
                    type="number"
                    required
                    value={maxDestinations}
                    onChange={(e) => setMaxDestinations(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Monthly Lots Quota Limit</label>
                  <input
                    id="add-tenant-lots"
                    type="number"
                    required
                    value={monthlyLimit}
                    onChange={(e) => setMonthlyLimit(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddTenant(false)}
                  className="py-2 px-4 text-xs font-semibold text-slate-400 border border-white/5 hover:bg-white/5 rounded-custom transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="add-tenant-submit-btn"
                  type="submit"
                  className="py-2 px-5 text-xs font-bold tracking-widest text-[#0B0E14] bg-accent-cyan hover:bg-accent-cyan/85 rounded-custom transition-all shadow-[0_0_12px_rgba(0,240,255,0.2)] cursor-pointer"
                >
                  GENERATE ACTIVE KEY
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdmin;
