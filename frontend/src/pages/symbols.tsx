/**
 * @file frontend/src/pages/symbols.tsx
 * @description Symbol Translation and Dynamic Spread Markup Injector manager page.
 * Renders per-symbol markup points badges (+25.0 pt), commission/swap overrides, and flags.
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Settings, 
  RefreshCcw, 
  TrendingUp,
  Sliders,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import Tooltip from '../components/ui/tooltip';

interface SymbolMapping {
  id: string;
  sourceSymbol: string;
  destinationSymbol: string;
  markupPoints: number;
  commissionOverride: number;
  swapBuyOverride: number;
  swapSellOverride: number;
  passSourceSpread: boolean;
  passFillPrice: boolean;
  destinationId: string;
  destination?: {
    accountLabel: string;
    brokerName: string;
  };
}

interface LpDestination {
  id: string;
  accountLabel: string;
  brokerName: string;
}

export const Symbols: React.FC = () => {
  const [mappings, setMappings] = useState<SymbolMapping[]>([]);
  const [destinations, setDestinations] = useState<LpDestination[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [sourceSymbol, setSourceSymbol] = useState('');
  const [destinationSymbol, setDestinationSymbol] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [markupPoints, setMarkupPoints] = useState('0.0');
  const [commissionOverride, setCommissionOverride] = useState('0.0');
  const [swapBuyOverride, setSwapBuyOverride] = useState('0.0');
  const [swapSellOverride, setSwapSellOverride] = useState('0.0');
  const [passSourceSpread, setPassSourceSpread] = useState(true);
  const [passFillPrice, setPassFillPrice] = useState(false);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('brp_token');
      const [mapsRes, destsRes] = await Promise.all([
        fetch('/api/symbols', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/destinations', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (mapsRes.ok && destsRes.ok) {
        setMappings(await mapsRes.json());
        setDestinations(await destsRes.json());
      }
    } catch (err) {
      console.error('Failed loading mappings data', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteMapping = async (id: string) => {
    if (!confirm('Are you sure you want to remove this symbol mapping translation?')) return;
    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch(`/api/symbols/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error('Delete mapping error', err);
    }
  };

  const handleAddMappingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch('/api/symbols', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sourceSymbol,
          destinationSymbol,
          destinationId,
          markupPoints: parseFloat(markupPoints),
          commissionOverride: parseFloat(commissionOverride),
          swapBuyOverride: parseFloat(swapBuyOverride),
          swapSellOverride: parseFloat(swapSellOverride),
          passSourceSpread,
          passFillPrice
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed saving symbol mapping');
      }

      setShowAddModal(false);
      // Reset form
      setSourceSymbol('');
      setDestinationSymbol('');
      setMarkupPoints('0.0');
      setCommissionOverride('0.0');
      setSwapBuyOverride('0.0');
      setSwapSellOverride('0.0');

      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Panel */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-widest font-mono text-slate-100 uppercase">SPREAD & MARKUP INJECTOR</h2>
          <p className="text-xs text-slate-400">Configure custom point spreads markups and translate asset tickers</p>
        </div>

        <button
          id="add-symbol-btn"
          onClick={() => {
            if (destinations.length === 0) {
              alert('Please configure at least one LP Destination before establishing symbol mappings.');
              return;
            }
            setShowAddModal(true);
            setDestinationId(destinations[0].id);
          }}
          className="flex items-center gap-2 py-2 px-4 text-xs font-bold font-mono tracking-widest text-[#0B0E14] bg-accent-cyan hover:bg-accent-cyan/85 rounded-custom transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>INJECT SYMBOL MAP</span>
        </button>
      </div>

      {/* Spreads Injector list */}
      <div className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5">
        {mappings.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-mono">
            <Sliders className="w-12 h-12 mx-auto mb-4 opacity-25 text-accent-cyan animate-pulse" />
            <span>No mappings configured. Inject a symbol map to translate assets and configure point markups.</span>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="hidden md:grid grid-cols-12 gap-4 text-[10px] font-mono text-slate-400 uppercase tracking-wider px-4 pb-2 border-b border-white/5">
              <div className="col-span-2">Source Symbol</div>
              <div className="col-span-2">Destination LP</div>
              <div className="col-span-2">LP Ticker</div>
              <div className="col-span-2 text-center">Spreads Markup</div>
              <div className="col-span-1 text-center">Commission</div>
              <div className="col-span-1 text-center">Swap B/S</div>
              <div className="col-span-1 text-center font-mono">Spread Passthru</div>
              <div className="col-span-1 text-right font-mono">Purge</div>
            </div>

            <div className="divide-y divide-white/5">
              {mappings.map((mapping) => (
                <div key={mapping.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center py-4 px-4 hover:bg-white/2 transition-colors text-xs font-mono text-slate-200">
                  
                  {/* Source */}
                  <div className="col-span-2 font-bold text-slate-100 uppercase">{mapping.sourceSymbol}</div>

                  {/* LP Label */}
                  <div className="col-span-2">
                    <span className="font-semibold text-slate-200">{mapping.destination?.accountLabel || 'LP Target'}</span>
                  </div>

                  {/* Destination */}
                  <div className="col-span-2 flex items-center gap-1">
                    <RefreshCcw className="w-3 h-3 text-accent-green" />
                    <span className="font-semibold text-slate-300 uppercase">{mapping.destinationSymbol}</span>
                  </div>

                  {/* Markup badge */}
                  <div className="col-span-2 text-center">
                    <span className="bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20 px-2.5 py-1 rounded-custom font-bold text-[10px] inline-flex items-center">
                      +{Number(mapping.markupPoints).toFixed(1)} pt
                    </span>
                  </div>

                  {/* Commission */}
                  <div className="col-span-1 text-center text-slate-400">
                    ${Number(mapping.commissionOverride).toFixed(2)}/lot
                  </div>

                  {/* Swaps */}
                  <div className="col-span-1 text-center text-slate-400">
                    {Number(mapping.swapBuyOverride).toFixed(1)} / {Number(mapping.swapSellOverride).toFixed(1)}
                  </div>

                  {/* Spread Passthrough */}
                  <div className="col-span-1 text-center">
                    {mapping.passSourceSpread ? (
                      <span className="text-[10px] text-accent-green bg-accent-green/5 border border-accent-green/20 px-2 py-0.5 rounded font-bold">YES</span>
                    ) : (
                      <span className="text-[10px] text-accent-red bg-accent-red/5 border border-accent-red/20 px-2 py-0.5 rounded font-bold">NO</span>
                    )}
                  </div>

                  {/* Delete */}
                  <div className="col-span-1 text-right">
                    <button
                      onClick={() => handleDeleteMapping(mapping.id)}
                      className="p-1.5 rounded bg-accent-red/10 hover:bg-accent-red/20 text-accent-red transition-all cursor-pointer"
                      title="Remove spread mapping rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Mapping Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 glass-panel bg-[#121721] rounded-custom border-white/10">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-white/5">
              <h3 className="text-sm font-bold tracking-widest font-mono text-slate-100 uppercase">INJECT SYMBOL TRANSLATION</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 font-mono text-xs cursor-pointer"
              >
                [ESC] CLOSE
              </button>
            </div>

            <form onSubmit={handleAddMappingSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">
                    MT5 Ticker Symbol <Tooltip content="Client-side source symbol matching, e.g. 'BTCUSD'." />
                  </label>
                  <input
                    id="add-symbol-source"
                    type="text"
                    required
                    value={sourceSymbol}
                    onChange={(e) => setSourceSymbol(e.target.value.toUpperCase())}
                    className="w-full py-2 px-3 text-xs glass-input font-mono"
                    placeholder="e.g. BTCUSD"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">
                    LP Ticker Symbol <Tooltip content="The translated symbol ticker to execute on LP side, e.g. 'BTCUSD_lp'." />
                  </label>
                  <input
                    id="add-symbol-dest"
                    type="text"
                    required
                    value={destinationSymbol}
                    onChange={(e) => setDestinationSymbol(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono"
                    placeholder="e.g. BTCUSD_lp"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">
                  LP Target Connection <Tooltip content="Target connection for this mapping translation." />
                </label>
                <select
                  id="add-symbol-destid"
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs glass-input"
                >
                  {destinations.map(d => (
                    <option key={d.id} value={d.id}>{d.accountLabel} ({d.brokerName})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">
                    Point Markups Injection <Tooltip content="Spreads offset added to Bid/Ask rate (e.g. +25.0 points adds 0.00025 on EURUSD)." />
                  </label>
                  <input
                    id="add-symbol-markup"
                    type="number"
                    step="0.1"
                    required
                    value={markupPoints}
                    onChange={(e) => setMarkupPoints(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">
                    Commission override ($) <Tooltip content="Broker fee charged per traded standard lot." />
                  </label>
                  <input
                    id="add-symbol-commission"
                    type="number"
                    step="0.01"
                    required
                    value={commissionOverride}
                    onChange={(e) => setCommissionOverride(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Swap Buy Points</label>
                  <input
                    id="add-symbol-swapbuy"
                    type="number"
                    step="0.1"
                    required
                    value={swapBuyOverride}
                    onChange={(e) => setSwapBuyOverride(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Swap Sell Points</label>
                  <input
                    id="add-symbol-swapsell"
                    type="number"
                    step="0.1"
                    required
                    value={swapSellOverride}
                    onChange={(e) => setSwapSellOverride(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    id="add-symbol-spreadpass"
                    type="checkbox"
                    checked={passSourceSpread}
                    onChange={(e) => setPassSourceSpread(e.target.checked)}
                    className="w-3.5 h-3.5 accent-accent-cyan"
                  />
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Pass Source Spread</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    id="add-symbol-pricepass"
                    type="checkbox"
                    checked={passFillPrice}
                    onChange={(e) => setPassFillPrice(e.target.checked)}
                    className="w-3.5 h-3.5 accent-accent-cyan"
                  />
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Pass Exact Fill Price</span>
                </label>
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
                  id="add-symbol-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="py-2 px-5 text-xs font-bold tracking-widest text-[#0B0E14] bg-accent-cyan hover:bg-accent-cyan/85 rounded-custom transition-all shadow-[0_0_12px_rgba(0,240,255,0.2)] cursor-pointer"
                >
                  {loading ? 'DEPLOYING...' : 'REGISTER TRANSLATION'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Symbols;
