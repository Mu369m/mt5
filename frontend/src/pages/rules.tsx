/**
 * @file frontend/src/pages/rules.tsx
 * @description Routing Rules Matrix manager page.
 * Renders source group to destination LP connection mapping tables, priority failovers,
 * and rule toggles. Includes beginner-friendly tooltips.
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Map, 
  ToggleLeft, 
  ToggleRight,
  TrendingRight,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import Tooltip from '../components/ui/tooltip';

interface RoutingRule {
  id: string;
  ruleName: string;
  sourceMt5Group: string;
  executionMode: 'COPIER' | 'DEALER_ONLY';
  priority: number;
  isEnabled: boolean;
  minLot: number;
  maxLot: number;
  forceMt5Flags: number;
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

export const Rules: React.FC = () => {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [destinations, setDestinations] = useState<LpDestination[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [ruleName, setRuleName] = useState('');
  const [sourceMt5Group, setSourceMt5Group] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [executionMode, setExecutionMode] = useState<'COPIER' | 'DEALER_ONLY'>('COPIER');
  const [priority, setPriority] = useState('50');
  const [minLot, setMinLot] = useState('0.01');
  const [maxLot, setMaxLot] = useState('100.00');

  const loadData = async () => {
    try {
      const token = localStorage.getItem('brp_token');
      const [rulesRes, destsRes] = await Promise.all([
        fetch('/api/rules', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/destinations', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (rulesRes.ok && destsRes.ok) {
        setRules(await rulesRes.json());
        setDestinations(await destsRes.json());
      }
    } catch (err) {
      console.error('Failed loading rules matrix data', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleRule = async (id: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch(`/api/rules/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isEnabled: !currentStatus })
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error('Toggle rule status error', err);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to remove this routing rule definition?')) return;
    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch(`/api/rules/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error('Delete rule error', err);
    }
  };

  const handleAddRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('brp_token');
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ruleName,
          sourceMt5Group,
          destinationId,
          executionMode,
          priority: parseInt(priority),
          minLot: parseFloat(minLot),
          maxLot: parseFloat(maxLot),
          forceMt5Flags: 0
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed saving routing rule');
      }

      setShowAddModal(false);
      // Reset form
      setRuleName('');
      setSourceMt5Group('');
      setPriority('50');
      setMinLot('0.01');
      setMaxLot('100.00');

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
          <h2 className="text-xl font-bold tracking-widest font-mono text-slate-100 uppercase">DEALER ROUTING MATRIX</h2>
          <p className="text-xs text-slate-400">Map MT5 client account groups directly to destination liquidity routes</p>
        </div>

        <button
          id="add-rule-btn"
          onClick={() => {
            if (destinations.length === 0) {
              alert('Please configure at least one LP Destination before establishing routing rules.');
              return;
            }
            setShowAddModal(true);
            setDestinationId(destinations[0].id);
          }}
          className="flex items-center gap-2 py-2 px-4 text-xs font-bold font-mono tracking-widest text-[#0B0E14] bg-accent-cyan hover:bg-accent-cyan/85 rounded-custom transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>MAP GROUP ROUTE</span>
        </button>
      </div>

      {/* Rules Matrix Layout */}
      <div className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5">
        {rules.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-mono">
            <Map className="w-12 h-12 mx-auto mb-4 opacity-25 text-accent-cyan" />
            <span>No routing rules established. Create one to link source MT5 accounts to LP destinations.</span>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="hidden md:grid grid-cols-12 gap-4 text-[10px] font-mono text-slate-400 uppercase tracking-wider px-4 pb-2 border-b border-white/5">
              <div className="col-span-2">Rule Name</div>
              <div className="col-span-3">Source Group Pattern</div>
              <div className="col-span-3 flex items-center">Destination LP</div>
              <div className="col-span-1 text-center">Priority</div>
              <div className="col-span-1 text-center">Lot bounds</div>
              <div className="col-span-1 text-center">Active</div>
              <div className="col-span-1 text-right">Action</div>
            </div>

            <div className="divide-y divide-white/5">
              {rules.map((rule) => (
                <div key={rule.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center py-4 px-4 hover:bg-white/2 transition-colors text-xs font-mono text-slate-200">
                  
                  {/* Name */}
                  <div className="col-span-2 font-bold text-slate-100">{rule.ruleName}</div>
                  
                  {/* Source Group */}
                  <div className="col-span-3">
                    <span className="bg-black/40 px-2.5 py-1 rounded text-accent-cyan border border-accent-cyan/10 select-all">
                      {rule.sourceMt5Group}
                    </span>
                  </div>

                  {/* Destination */}
                  <div className="col-span-3 flex items-center gap-1.5">
                    <TrendingRight className="w-4 h-4 text-accent-green shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-100">
                        {rule.destination?.accountLabel || 'Target Connection'}
                      </span>
                      <span className="text-[9px] text-slate-400 block uppercase">
                        {rule.destination?.brokerName || 'LP Broker'}
                      </span>
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="col-span-1 text-center font-bold text-accent-green bg-accent-green/5 py-1 rounded">
                    {rule.priority}
                  </div>

                  {/* Lots filter */}
                  <div className="col-span-1 text-center text-slate-400">
                    {rule.minLot.toFixed(2)} - {rule.maxLot.toFixed(0)} Lots
                  </div>

                  {/* Active Toggle */}
                  <div className="col-span-1 text-center">
                    <button
                      onClick={() => handleToggleRule(rule.id, rule.isEnabled)}
                      className="transition-colors hover:text-accent-cyan"
                    >
                      {rule.isEnabled ? (
                        <ToggleRight className="w-8 h-8 text-accent-cyan cursor-pointer mx-auto" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-slate-500 cursor-pointer mx-auto" />
                      )}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 text-right">
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1.5 rounded bg-accent-red/10 hover:bg-accent-red/20 text-accent-red transition-all cursor-pointer"
                      title="Delete rule mapping"
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

      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 glass-panel bg-[#121721] rounded-custom border-white/10">
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-white/5">
              <h3 className="text-sm font-bold tracking-widest font-mono text-slate-100 uppercase">MAP ROUTING GROUP</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 font-mono text-xs cursor-pointer"
              >
                [ESC] CLOSE
              </button>
            </div>

            <form onSubmit={handleAddRuleSubmit} className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">
                  Rule Name <Tooltip content="Descriptive identifier for the rule matrix entry." />
                </label>
                <input
                  id="add-rule-name"
                  type="text"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full py-2 px-3 text-xs glass-input"
                  placeholder="e.g. Cent Group Standard Copier"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">
                  Source MT5 Group Ticker <Tooltip content="Filters incoming requests by MT5 group pattern (wildcards supported). E.g. 'Cent\\*'" />
                </label>
                <input
                  id="add-rule-group"
                  type="text"
                  required
                  value={sourceMt5Group}
                  onChange={(e) => setSourceMt5Group(e.target.value)}
                  className="w-full py-2 px-3 text-xs glass-input font-mono"
                  placeholder="e.g. JK1\1A\G-fwd"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">
                  LP Destination Endpoint <Tooltip content="Liquidity Provider broker account to target." />
                </label>
                <select
                  id="add-rule-dest"
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs glass-input"
                >
                  {destinations.map(d => (
                    <option key={d.id} value={d.id}>{d.accountLabel} ({d.brokerName})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">
                    Priority <Tooltip content="Failover route weight (1-100). Higher weights route first." />
                  </label>
                  <input
                    id="add-rule-priority"
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Min Lots</label>
                  <input
                    id="add-rule-minlot"
                    type="number"
                    step="0.01"
                    required
                    value={minLot}
                    onChange={(e) => setMinLot(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Max Lots</label>
                  <input
                    id="add-rule-maxlot"
                    type="number"
                    step="0.01"
                    required
                    value={maxLot}
                    onChange={(e) => setMaxLot(e.target.value)}
                    className="w-full py-2 px-3 text-xs glass-input font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Execution Mode</label>
                <select
                  id="add-rule-execmode"
                  value={executionMode}
                  onChange={(e) => setExecutionMode(e.target.value as 'COPIER' | 'DEALER_ONLY')}
                  className="w-full py-2.5 px-3 text-xs glass-input"
                >
                  <option value="COPIER">COPIER (A-Book Forwarding)</option>
                  <option value="DEALER_ONLY">DEALER ONLY (B-Book Execution)</option>
                </select>
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
                  id="add-rule-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="py-2 px-5 text-xs font-bold tracking-widest text-[#0B0E14] bg-accent-cyan hover:bg-accent-cyan/85 rounded-custom transition-all shadow-[0_0_12px_rgba(0,240,255,0.2)] cursor-pointer"
                >
                  {loading ? 'DEPLOYING...' : 'REGISTER RULE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rules;
