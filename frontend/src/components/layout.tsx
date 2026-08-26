/**
 * @file frontend/src/components/layout.tsx
 * @description Master institutional layout shell.
 * Renders sidebar navigation, global telemetry widgets, billing meters,
 * global announcements banner, and active session attributes.
 * 
 * Connected Modules:
 * - frontend/src/main.tsx (router wrap)
 */

import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { 
  LayoutDashboard, 
  Network, 
  Settings, 
  ShieldAlert, 
  Code2, 
  TrendingUp, 
  UserCheck, 
  LogOut,
  Compass,
  AlertCircle
} from 'lucide-react';
import { useTheme } from '../theme';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [location, setLocation] = useLocation();
  const { branding } = useTheme();

  // User session state
  const [user, setUser] = useState<{ email: string; role: string; companyName?: string; licenseKey?: string } | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ current: number; limit: number; percent: number } | null>(null);

  // Quick 3-Step Onboarding State
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  useEffect(() => {
    const rawUser = localStorage.getItem('brp_user');
    if (rawUser) {
      setUser(JSON.parse(rawUser));
    } else {
      setLocation('/login');
    }
  }, [location, setLocation]);

  // Load telemetry metrics for header quota bar and announcements
  const fetchTelemetry = async () => {
    try {
      const token = localStorage.getItem('brp_token');
      if (!token) return;

      // Tenant-scoped telemetry (skip for Super Admin unless impersonating)
      const rawUser = localStorage.getItem('brp_user');
      const parsedUser = rawUser ? JSON.parse(rawUser) : null;
      if (parsedUser?.role === 'SUPER_ADMIN' && !parsedUser?.tenantId) {
        return;
      }

      // Fetch broadcast banner and live volume quota
      const [broadcastRes, meteringRes] = await Promise.all([
        fetch('/api/tenant/broadcast', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/tenant/metering', { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);

      if (broadcastRes.ok) {
        const broadcastData = await broadcastRes.json();
        if (broadcastData.text) {
          setAnnouncement(broadcastData.text);
        }
      }

      if (meteringRes.ok) {
        const metering = await meteringRes.json();
        setQuota({
          current: metering.current,
          limit: metering.limit,
          percent: metering.percent,
        });
      }
    } catch (err) {
      console.warn('Layout telemetry load error', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTelemetry();
      const interval = setInterval(fetchTelemetry, 30000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('brp_token');
    localStorage.removeItem('brp_user');
    setLocation('/login');
  };

  if (!user && location !== '/login' && location !== '/register') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B0E14] text-accent-cyan">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full border-4 border-accent-cyan border-t-transparent animate-spin"></div>
          <span className="font-mono text-sm tracking-widest uppercase">Syncing Node...</span>
        </div>
      </div>
    );
  }

  // Define sidebar links based on user roles
  const sidebarLinks = [
    { href: '/', label: 'Telemetry Overview', icon: LayoutDashboard },
    { href: '/destinations', label: 'LP Connections', icon: Network },
    { href: '/rules', label: 'Dealer Matrix', icon: Compass },
    { href: '/symbols', label: 'Spread Injector', icon: TrendingUp },
    { href: '/policies', label: 'Execution & Slippage', icon: Settings },
    { href: '/copier', label: 'Master / Slave Copier', icon: Network },
  ];

  if (user?.role === 'SUPER_ADMIN') {
    sidebarLinks.push({ href: '/super-admin', label: 'Super-Admin CMS', icon: UserCheck });
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0E14]">
      {/* Global Broadcast Announcement Banner */}
      {announcement && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-mono font-semibold tracking-wider text-[#0B0E14] bg-[#FFD600] border-b border-[#FFD600]/30 animate-pulse">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>BROADCAST: {announcement}</span>
          <button onClick={() => setAnnouncement(null)} className="ml-4 font-bold hover:underline cursor-pointer">DISMISS</button>
        </div>
      )}

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Nav */}
        <aside className="w-64 border-r border-white/5 bg-[#121721] flex flex-col shrink-0">
          {/* Logo Header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
            <div className="w-8 h-8 rounded bg-gradient-to-tr from-accent-cyan to-accent-green flex items-center justify-center text-[#0B0E14] font-black text-lg shadow-[0_0_15px_rgba(0,240,255,0.4)]">
              Ω
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-slate-100 uppercase">{branding.siteTitle.split(' ')[0]}</h1>
              <span className="text-[10px] font-mono tracking-widest text-accent-cyan/80 uppercase">GATEWAY V1.0</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {sidebarLinks.map((link) => {
              const isActive = location === link.href;
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href} className={`flex items-center gap-3 px-4 py-3 rounded-custom text-sm font-medium transition-all ${
                    isActive 
                      ? 'bg-accent-cyan/10 text-accent-cyan border-l-2 border-accent-cyan shadow-[inset_4px_0_12px_rgba(0,240,255,0.05)]' 
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                  }`}>
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Onboarding Wizard trigger */}
          {user?.role === 'TENANT_ADMIN' && (
            <div className="px-4 py-4 border-t border-white/5">
              <button 
                id="wizard-trigger-btn"
                onClick={() => { setShowWizard(true); setWizardStep(1); }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-[#0B0E14] bg-accent-cyan hover:bg-accent-cyan/80 rounded-custom transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)] cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Onboarding Wizard</span>
              </button>
            </div>
          )}

          {/* Footer User Info */}
          <div className="p-4 border-t border-white/5 bg-black/20 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="truncate max-w-[150px]">
                <p className="text-xs font-semibold text-slate-200 truncate">{user?.email}</p>
                <span className="text-[10px] font-mono text-accent-green uppercase">{user?.role}</span>
              </div>
              <button 
                id="logout-btn"
                onClick={handleLogout} 
                className="p-1.5 rounded-custom hover:bg-white/10 text-accent-red transition-colors"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header Panel */}
          <header className="h-16 border-b border-white/5 bg-[#121721] flex items-center justify-between px-8 shrink-0">
            <div>
              {user?.role !== 'SUPER_ADMIN' && user?.companyName && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Account:</span>
                  <span className="text-xs font-mono font-semibold bg-white/5 px-2 py-0.5 rounded text-accent-cyan">
                    {user.companyName}
                  </span>
                </div>
              )}
            </div>

            {/* Live telemetry strip */}
            <div className="flex items-center gap-4 text-[10px] font-mono">
              <span className="flex items-center gap-1.5 text-accent-green">
                <span className="w-2 h-2 rounded-full bg-accent-green pulse-glow"></span>
                SERVER ONLINE
              </span>
              {quota && (
                <span className="text-slate-400">
                  LP QUOTA: {quota.percent.toFixed(0)}% utilized
                </span>
              )}
            </div>

            {/* Quota Usage bar */}
            {quota && (
              <div className="flex items-center gap-3 bg-black/20 px-4 py-1.5 rounded-custom border border-white/5">
                <span className="text-[10px] font-mono text-slate-400">VOLUME QUOTA:</span>
                <div className="w-32 bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      quota.percent > 90 ? 'bg-accent-red' : quota.percent > 75 ? 'bg-accent-gold' : 'bg-accent-cyan'
                    }`}
                    style={{ width: `${quota.percent}%` }}
                  ></div>
                </div>
                <span className="text-[10px] font-mono text-slate-200">
                  {quota.current.toFixed(1)} / {quota.limit.toFixed(0)} Lots ({quota.percent.toFixed(0)}%)
                </span>
              </div>
            )}
          </header>

          {/* Child Page Container */}
          <main className="flex-1 overflow-y-auto p-8">
            {children}
          </main>
        </div>
      </div>

      {/* Onboarding Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 glass-panel bg-[#121721] rounded-custom border-accent-cyan/20">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/5">
              <h2 className="text-sm font-bold tracking-widest font-mono text-accent-cyan uppercase">BRP QUICK ONBOARDING WIZARD</h2>
              <button 
                onClick={() => setShowWizard(false)}
                className="text-slate-400 hover:text-slate-200 font-mono text-xs"
              >
                [ESC] CLOSE
              </button>
            </div>

            {/* Wizard Steps indicator */}
            <div className="flex justify-between items-center mb-6">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono ${
                    wizardStep === step 
                      ? 'bg-accent-cyan text-[#0B0E14] font-bold shadow-[0_0_8px_rgba(0,240,255,0.4)]' 
                      : wizardStep > step 
                        ? 'bg-accent-green text-[#0B0E14] font-bold' 
                        : 'bg-white/5 text-slate-400'
                  }`}>
                    {step}
                  </div>
                  <span className={`text-[10px] font-mono uppercase tracking-wider ${
                    wizardStep === step ? 'text-accent-cyan font-bold' : 'text-slate-400'
                  }`}>
                    {step === 1 ? 'LP Destination' : step === 2 ? 'Routing Rule' : 'Symbol Markup'}
                  </span>
                </div>
              ))}
            </div>

            {/* Wizard Step Content */}
            <div className="mb-8 min-h-[140px] text-slate-300 text-sm leading-relaxed">
              {wizardStep === 1 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-200">Step 1: Configure Liquidity Destination</h3>
                  <p className="text-xs">
                    Configure your execution account endpoint details. Add broker information (IP, login, password), and configure a <code className="text-accent-cyan font-mono bg-black/40 px-1 py-0.5 rounded">lots_divisor</code> (e.g. 100 to translate micro/cent lot sizes).
                  </p>
                  <p className="text-xs italic text-slate-400">
                    Go to the <strong>LP Connections</strong> page to configure candidates.
                  </p>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-200">Step 2: Map MT5 Group Routing</h3>
                  <p className="text-xs">
                    Define client source group mapping rules (e.g., matching <code className="text-accent-cyan font-mono bg-black/40 px-1 py-0.5 rounded">JK1\1A\G-fwd</code> groups). Route them either in A-Book copier mode or lock into internal B-Book execution pipelines.
                  </p>
                  <p className="text-xs italic text-slate-400">
                    Go to the <strong>Dealer Matrix</strong> page to link group patterns.
                  </p>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-200">Step 3: Define Spread Markup & Activate</h3>
                  <p className="text-xs">
                    Adjust symbols translations (e.g., routing source EURUSD to EURUSD_lp) and add a custom points markup offset (e.g. <code className="text-accent-cyan font-mono bg-black/40 px-1 py-0.5 rounded">+25.00 points</code>). This instantly marks up Bid/Ask rates.
                  </p>
                  <p className="text-xs italic text-slate-400">
                    Go to the <strong>Spread Injector</strong> page to fine tune assets markup.
                  </p>
                </div>
              )}
            </div>

            {/* Wizard Navigation Footer */}
            <div className="flex justify-between">
              <button
                disabled={wizardStep === 1}
                onClick={() => setWizardStep(wizardStep - 1)}
                className="px-4 py-1.5 rounded-custom border border-white/10 text-slate-400 hover:text-slate-200 text-xs font-semibold disabled:opacity-30 cursor-pointer"
              >
                Back
              </button>
              
              {wizardStep < 3 ? (
                <button
                  onClick={() => setWizardStep(wizardStep + 1)}
                  className="px-4 py-1.5 rounded-custom bg-accent-cyan text-[#0B0E14] text-xs font-bold shadow-[0_0_10px_rgba(0,240,255,0.2)] cursor-pointer"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={() => setShowWizard(false)}
                  className="px-4 py-1.5 rounded-custom bg-accent-green text-[#0B0E14] text-xs font-bold shadow-[0_0_10px_rgba(0,230,118,0.2)] cursor-pointer"
                >
                  Complete Setup
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
