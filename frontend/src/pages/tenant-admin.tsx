import React, { useState } from 'react';
import { Network, Gem, Landmark, Shield, SlidersHorizontal, Radio, CreditCard, Layers3, Check } from 'lucide-react';
import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_FEE_CONFIG,
  DEFAULT_TENANT_DEFAULTS,
  DEFAULT_MODULE_VISIBILITY,
  DEFAULT_CMS_CONTENT,
  type FeatureFlags,
  type FeeConfig,
  type TenantDefaults,
  type ModuleVisibility,
  type CmsContent,
} from '@workspace/shared';

const TenantAdmin: React.FC = () => {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS as FeatureFlags);
  const [feeConfig, setFeeConfig] = useState<FeeConfig>(DEFAULT_FEE_CONFIG as FeeConfig);
  const [tenantDefaults, setTenantDefaults] = useState<TenantDefaults>(DEFAULT_TENANT_DEFAULTS as TenantDefaults);
  const [moduleVisibility, setModuleVisibility] = useState<ModuleVisibility>(DEFAULT_MODULE_VISIBILITY as ModuleVisibility);
  const [cmsContent, setCmsContent] = useState<CmsContent>(DEFAULT_CMS_CONTENT as CmsContent);

  const [lpRows, setLpRows] = useState([
    { brokerName: 'FXPrime MT5', accountLabel: 'LP-001', serverIp: '10.0.8.12', port: 443, loginId: '772100', mode: 'FIX', enabled: true, markup: 1.4, fee: 0.1 },
    { brokerName: 'Astra Bridge', accountLabel: 'LP-002', serverIp: '10.0.8.20', port: 443, loginId: '940881', mode: 'MT5', enabled: true, markup: 2.1, fee: 0.2 },
  ]);

  const [rebates, setRebates] = useState([
    { tier: 'New Dealer', rebate: 0.15, ibShare: 0.05, volume: 1000 },
    { tier: 'Prime IB', rebate: 0.45, ibShare: 0.30, volume: 5000 },
  ]);

  const [nettingPolicy, setNettingPolicy] = useState({
    mode: 'NETTING',
    allowMarkup: true,
    allowNewsShield: true,
    maxDeviationPoints: 35,
    priceWindowPoints: 8,
    maxLotExposure: 100,
  });

  const updateFeatureFlag = (key: keyof typeof DEFAULT_FEATURE_FLAGS, val: boolean) => {
    setFeatureFlags({ ...featureFlags, [key]: val });
  };

  const updateModule = (key: keyof typeof DEFAULT_MODULE_VISIBILITY, val: boolean) => {
    setModuleVisibility({ ...moduleVisibility, [key]: val });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-widest font-mono text-slate-100 uppercase">BROKER / TENANT ADMIN CONSOLE</h2>
          <p className="text-xs text-slate-400">Dynamic controls for LP routing, rebates, treasury, news shield and tenant policy defaults.</p>
        </div>
        <button className="py-2 px-5 text-xs font-bold font-mono tracking-wider text-[#0B0E14] bg-accent-cyan rounded-custom">
          SAVE CONFIG
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Network className="w-4 h-4 text-accent-cyan" />
            <h3 className="text-xs font-bold tracking-widest font-mono text-slate-100 uppercase">LP / FIX / MT4 / MT5 MANAGER</h3>
          </div>
          <div className="space-y-3 mt-4">
            {lpRows.map((row, idx) => (
              <div key={idx} className="border border-white/5 rounded p-3 bg-black/20">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="text-[10px] font-mono text-slate-400">
                    Broker
                    <input value={row.brokerName} onChange={(e) => {
                      const next = [...lpRows]; next[idx].brokerName = e.target.value; setLpRows(next);
                    }} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
                  </label>
                  <label className="text-[10px] font-mono text-slate-400">
                    Account
                    <input value={row.accountLabel} onChange={(e) => {
                      const next = [...lpRows]; next[idx].accountLabel = e.target.value; setLpRows(next);
                    }} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
                  </label>
                  <label className="text-[10px] font-mono text-slate-400">
                    Server
                    <input value={row.serverIp} onChange={(e) => {
                      const next = [...lpRows]; next[idx].serverIp = e.target.value; setLpRows(next);
                    }} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
                  </label>
                  <label className="text-[10px] font-mono text-slate-400">
                    Port
                    <input type="number" value={row.port} onChange={(e) => {
                      const next = [...lpRows]; next[idx].port = Number(e.target.value); setLpRows(next);
                    }} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
                  </label>
                  <label className="text-[10px] font-mono text-slate-400">
                    Login
                    <input value={row.loginId} onChange={(e) => {
                      const next = [...lpRows]; next[idx].loginId = e.target.value; setLpRows(next);
                    }} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
                  </label>
                  <label className="text-[10px] font-mono text-slate-400">
                    Mode
                    <select value={row.mode} onChange={(e) => {
                      const next = [...lpRows]; next[idx].mode = e.target.value; setLpRows(next);
                    }} className="w-full mt-1 py-2 px-2 text-xs glass-input">
                      <option>FIX</option>
                      <option>MT4</option>
                      <option>MT5</option>
                    </select>
                  </label>
                  <label className="text-[10px] font-mono text-slate-400">
                    Markup
                    <input type="number" value={row.markup} onChange={(e) => {
                      const next = [...lpRows]; next[idx].markup = Number(e.target.value); setLpRows(next);
                    }} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
                  </label>
                  <label className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    Enabled
                    <input type="checkbox" checked={row.enabled} onChange={(e) => {
                      const next = [...lpRows]; next[idx].enabled = e.target.checked; setLpRows(next);
                    }} className="accent-accent-cyan" />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Gem className="w-4 h-4 text-accent-green" />
            <h3 className="text-xs font-bold tracking-widest font-mono text-slate-100 uppercase">REBAT / IB TIER EDITOR</h3>
          </div>
          <div className="space-y-3 mt-4">
            {rebates.map((row, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-3 border border-white/5 rounded p-3">
                <label className="text-[10px] font-mono text-slate-400">
                  Tier
                  <input value={row.tier} onChange={(e) => {
                    const next = [...rebates]; next[idx].tier = e.target.value; setRebates(next);
                  }} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
                </label>
                <label className="text-[10px] font-mono text-slate-400">
                  Rebate %
                  <input type="number" value={row.rebate} onChange={(e) => {
                    const next = [...rebates]; next[idx].rebate = Number(e.target.value); setRebates(next);
                  }} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
                </label>
                <label className="text-[10px] font-mono text-slate-400">
                  IB Share %
                  <input type="number" value={row.ibShare} onChange={(e) => {
                    const next = [...rebates]; next[idx].ibShare = Number(e.target.value); setRebates(next);
                  }} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
                </label>
                <label className="text-[10px] font-mono text-slate-400">
                  Volume
                  <input type="number" value={row.volume} onChange={(e) => {
                    const next = [...rebates]; next[idx].volume = Number(e.target.value); setRebates(next);
                  }} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
                </label>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Shield className="w-4 h-4 text-accent-gold" />
            <h3 className="text-xs font-bold tracking-widest font-mono text-slate-100 uppercase">DEALER RULES</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <label className="text-[10px] font-mono text-slate-400">
              Netting Mode
              <select value={nettingPolicy.mode} onChange={(e) => setNettingPolicy({ ...nettingPolicy, mode: e.target.value })} className="w-full mt-1 py-2 px-2 text-xs glass-input">
                <option>NETTING</option>
                <option>HEDGING</option>
              </select>
            </label>
            <label className="text-[10px] font-mono text-slate-400">
              Max Deviation
              <input type="number" value={nettingPolicy.maxDeviationPoints} onChange={(e) => setNettingPolicy({ ...nettingPolicy, maxDeviationPoints: Number(e.target.value) })} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
            </label>
            <label className="text-[10px] font-mono text-slate-400">
              Price Window
              <input type="number" value={nettingPolicy.priceWindowPoints} onChange={(e) => setNettingPolicy({ ...nettingPolicy, priceWindowPoints: Number(e.target.value) })} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
            </label>
            <label className="text-[10px] font-mono text-slate-400">
              Max Lot Exposure
              <input type="number" value={nettingPolicy.maxLotExposure} onChange={(e) => setNettingPolicy({ ...nettingPolicy, maxLotExposure: Number(e.target.value) })} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
            </label>
          </div>
          <div className="mt-4 space-y-2">
            <label className="flex items-center justify-between text-[10px] font-mono text-slate-300">
              <span>Allow Markup</span>
              <input type="checkbox" checked={nettingPolicy.allowMarkup} onChange={(e) => setNettingPolicy({ ...nettingPolicy, allowMarkup: e.target.checked })} className="accent-accent-cyan" />
            </label>
            <label className="flex items-center justify-between text-[10px] font-mono text-slate-300">
              <span>Enable News Shield</span>
              <input type="checkbox" checked={nettingPolicy.allowNewsShield} onChange={(e) => setNettingPolicy({ ...nettingPolicy, allowNewsShield: e.target.checked })} className="accent-accent-cyan" />
            </label>
          </div>
        </section>

        <section className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Landmark className="w-4 h-4 text-accent-cyan" />
            <h3 className="text-xs font-bold tracking-widest font-mono text-slate-100 uppercase">FEES / TREASURY / FLAGS</h3>
          </div>
          <div className="space-y-3 mt-4">
            <label className="block text-[10px] font-mono text-slate-400">
              Broker fee / lot
              <input type="number" value={feeConfig.brokerFeePerLot} onChange={(e) => setFeeConfig({ ...feeConfig, brokerFeePerLot: Number(e.target.value) })} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
            </label>
            <label className="block text-[10px] font-mono text-slate-400">
              Rebate %
              <input type="number" value={feeConfig.rebatePercent} onChange={(e) => setFeeConfig({ ...feeConfig, rebatePercent: Number(e.target.value) })} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
            </label>
            <label className="block text-[10px] font-mono text-slate-400">
              Wallet limit
              <input type="number" value={feeConfig.maxMonthlyWalletLimit} onChange={(e) => setFeeConfig({ ...feeConfig, maxMonthlyWalletLimit: Number(e.target.value) })} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
            </label>
            <label className="block text-[10px] font-mono text-slate-400">
              Treasury currency
              <input type="text" value={feeConfig.treasuryCurrency} onChange={(e) => setFeeConfig({ ...feeConfig, treasuryCurrency: e.target.value })} className="w-full mt-1 py-2 px-2 text-xs glass-input uppercase" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(featureFlags).map(([key, value]) => (
                <label key={key} className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-300">
                  <span className="capitalize">{key}</span>
                  <input type="checkbox" checked={Boolean(value)} onChange={(e) => updateFeatureFlag(key as keyof typeof DEFAULT_FEATURE_FLAGS, e.target.checked)} className="accent-accent-cyan" />
                </label>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Layers3 className="w-4 h-4 text-accent-cyan" />
            <h3 className="text-xs font-bold tracking-widest font-mono text-slate-100 uppercase">MODULE VISIBILITY</h3>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {Object.entries(moduleVisibility).map(([key, value]) => (
              <label key={key} className="flex items-center justify-between text-[10px] font-mono text-slate-300">
                <span className="capitalize">{key}</span>
                <input type="checkbox" checked={Boolean(value)} onChange={(e) => updateModule(key as keyof typeof DEFAULT_MODULE_VISIBILITY, e.target.checked)} className="accent-accent-cyan" />
              </label>
            ))}
          </div>
        </section>

        <section className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Radio className="w-4 h-4 text-accent-green" />
            <h3 className="text-xs font-bold tracking-widest font-mono text-slate-100 uppercase">CMS / TENANT COPY</h3>
          </div>
          <div className="mt-4 space-y-3">
            <label className="block text-[10px] font-mono text-slate-400">
              Landing page copy
              <input value={cmsContent.landingPageCopy} onChange={(e) => setCmsContent({ ...cmsContent, landingPageCopy: e.target.value })} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
            </label>
            <label className="block text-[10px] font-mono text-slate-400">
              Meta description
              <input value={cmsContent.metaDescription} onChange={(e) => setCmsContent({ ...cmsContent, metaDescription: e.target.value })} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
            </label>
            <label className="block text-[10px] font-mono text-slate-400">
              Admin watermark
              <input value={cmsContent.adminWatermark} onChange={(e) => setCmsContent({ ...cmsContent, adminWatermark: e.target.value })} className="w-full mt-1 py-2 px-2 text-xs glass-input" />
            </label>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="glass-panel p-4 bg-[#121721] rounded-custom border-white/5">
          <div className="flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-accent-cyan" /><span className="text-[10px] font-mono font-bold uppercase text-slate-300">Tenant defaults</span></div>
          <div className="mt-3 text-[10px] font-mono text-slate-400 space-y-2">
            <div className="flex justify-between"><span>Destinations</span><span className="text-accent-cyan">{tenantDefaults.maxDestinations}</span></div>
            <div className="flex justify-between"><span>Monthly limit</span><span className="text-accent-cyan">{tenantDefaults.monthlyVolumeLimitLots}</span></div>
            <div className="flex justify-between"><span>License months</span><span className="text-accent-cyan">{tenantDefaults.licenseMonths}</span></div>
          </div>
        </section>
        <section className="glass-panel p-4 bg-[#121721] rounded-custom border-white/5">
          <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-accent-green" /><span className="text-[10px] font-mono font-bold uppercase text-slate-300">Treasury</span></div>
          <div className="mt-3 text-[10px] font-mono text-slate-400 space-y-2">
            <div className="flex justify-between"><span>Currency</span><span className="text-accent-green">{feeConfig.treasuryCurrency}</span></div>
            <div className="flex justify-between"><span>Max wallet</span><span className="text-accent-green">{feeConfig.maxMonthlyWalletLimit}</span></div>
          </div>
        </section>
        <section className="glass-panel p-4 bg-[#121721] rounded-custom border-white/5">
          <div className="flex items-center gap-2"><Check className="w-4 h-4 text-accent-gold" /><span className="text-[10px] font-mono font-bold uppercase text-slate-300">Policy Status</span></div>
          <div className="mt-3 text-[10px] font-mono text-slate-400 space-y-2">
            <div className="flex justify-between"><span>Netting</span><span className="text-accent-gold">{nettingPolicy.mode}</span></div>
            <div className="flex justify-between"><span>News shield</span><span className="text-accent-gold">{nettingPolicy.allowNewsShield ? 'ON' : 'OFF'}</span></div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TenantAdmin;
