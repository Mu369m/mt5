/**
 * @file frontend/src/pages/dashboard.tsx
 * @description Executive Overview & Live Telemetry Dashboard.
 * Connects to the WebSocket telemetry feed to render live trade activities,
 * lot utilization gauges, execution latency widgets, and netting commission savings counters.
 */

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Cpu, 
  TrendingDown, 
  Zap, 
  Clock, 
  Layers, 
  CheckCircle2, 
  XCircle,
  FileText
} from 'lucide-react';

interface TelemetryTradeLog {
  orderId: string;
  companyName: string;
  brokerName: string;
  sourceGroup: string;
  symbol: string;
  orderType: string;
  originalLots: number;
  scaledLots: number;
  executionLatencyMs: number;
  requestedPrice: number;
  fillPrice: number;
  slippagePoints: number;
  isNettedInternally: boolean;
  isNewsShieldActive: boolean;
  isToxicBotDetected: boolean;
  success: boolean;
  errorMessage?: string;
  timestamp: string;
}

export const Dashboard: React.FC = () => {
  const [trades, setTrades] = useState<TelemetryTradeLog[]>([]);
  const [stats, setStats] = useState({
    totalTrades: 0,
    averageLatencyMs: 0,
    nettedTradesCount: 0,
    commissionsSavedUsd: 0.0,
    activeLpCount: 0,
  });

  const [wsStatus, setWsStatus] = useState<'CONNECTING' | 'ONLINE' | 'OFFLINE'>('CONNECTING');

  // Load initial audit logs to pre-populate trades list
  const loadInitialData = async () => {
    try {
      const token = localStorage.getItem('brp_token');
      const [logsRes, destsRes] = await Promise.all([
        fetch('/api/admin/audit-logs?limit=15', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/destinations', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (logsRes.ok && destsRes.ok) {
        const logsData = await logsRes.json();
        const dests = await destsRes.json();
        
        // Filter sandbox & trade execution events from logs and map them to trade format
        const tradeEvents = logsData.logs
          .filter((l: any) => l.eventType === 'SANDBOX_ORDER' || l.eventType === 'TRADE_EXECUTION')
          .map((l: any) => {
            const meta = l.metadata || {};
            const isNetted = l.message.includes('SUCCESS') && (meta.fillPrice === meta.requestedPrice || l.message.includes('netted') || meta.isNettedInternally);
            return {
              orderId: meta.orderId || `ORD-${l.id}`,
              companyName: dests.find((d: any) => d.id === l.destinationId)?.accountLabel || 'LP Target',
              brokerName: dests.find((d: any) => d.id === l.destinationId)?.brokerName || 'LP Broker',
              sourceGroup: l.sourceGroup || 'SANDBOX\\TEST_GROUP',
              symbol: l.symbol || 'EURUSD',
              orderType: l.message.includes('BUY') ? 'BUY' : 'SELL',
              originalLots: l.volumeLots ? Number(l.volumeLots) : 0.01,
              scaledLots: l.volumeLots ? Number(l.volumeLots) : 0.01,
              executionLatencyMs: l.executionLatencyMs || 5,
              requestedPrice: meta.requestedPrice || 0,
              fillPrice: meta.fillPrice || 0,
              slippagePoints: meta.pipelineLatencyMs ? 0 : 3,
              isNettedInternally: isNetted,
              isNewsShieldActive: l.message.includes('Shield') || meta.isNewsShieldActive,
              isToxicBotDetected: meta.isToxicBotDetected || false,
              success: l.logLevel !== 'ERROR',
              errorMessage: l.logLevel === 'ERROR' ? l.message : undefined,
              timestamp: l.createdAt
            };
          });

        setTrades(tradeEvents);

        // Estimate cumulative stats from history
        const activeLps = dests.filter((d: any) => d.enableForwarding).length;
        const total = tradeEvents.length;
        const sumLatency = tradeEvents.reduce((acc: number, t: any) => acc + t.executionLatencyMs, 0);
        const netted = tradeEvents.filter((t: any) => t.isNettedInternally).length;
        const saved = netted * 6.0; // Estimate $6 saved per lot

        setStats({
          totalTrades: total,
          averageLatencyMs: total > 0 ? Math.round(sumLatency / total) : 0,
          nettedTradesCount: netted,
          commissionsSavedUsd: saved,
          activeLpCount: activeLps
        });
      }
    } catch (err) {
      console.error('Failed pre-populating dashboard analytics', err);
    }
  };

  useEffect(() => {
    loadInitialData();

    // Establish WebSocket Connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setWsStatus('ONLINE');
    };

    socket.onclose = () => {
      setWsStatus('OFFLINE');
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'TRADE_EXECUTION') {
          const newTrade = payload.data as TelemetryTradeLog;
          
          setTrades((prev) => [newTrade, ...prev.slice(0, 49)]); // Cap view list to 50
          
          // Recalculate stats with the new trade factored in
          setStats((prev) => {
            const nextTotal = prev.totalTrades + 1;
            const nextLatency = Math.round((prev.averageLatencyMs * prev.totalTrades + newTrade.executionLatencyMs) / nextTotal);
            const isNetted = newTrade.isNettedInternally;
            return {
              totalTrades: nextTotal,
              averageLatencyMs: nextLatency,
              nettedTradesCount: isNetted ? prev.nettedTradesCount + 1 : prev.nettedTradesCount,
              commissionsSavedUsd: isNetted ? prev.commissionsSavedUsd + (newTrade.originalLots * 6.0) : prev.commissionsSavedUsd,
              activeLpCount: prev.activeLpCount
            };
          });
        }
      } catch (err) {
        console.warn('Telemetry WS parser error', err);
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* Page Title & Status Banner */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-widest font-mono text-slate-100 uppercase">EXECUTIVE TRADE DESK</h2>
          <p className="text-xs text-slate-400">Real-Time institutional routing telemetry & node latency tracking</p>
        </div>

        {/* Live WS Telemetry Status */}
        <div className="flex items-center gap-2 bg-[#121721] px-4 py-1.5 rounded-custom border border-white/5">
          <div className={`w-2.5 h-2.5 rounded-full ${
            wsStatus === 'ONLINE' ? 'bg-accent-green pulse-glow' : wsStatus === 'CONNECTING' ? 'bg-accent-gold animate-bounce' : 'bg-accent-red'
          }`}></div>
          <span className="text-[10px] font-mono tracking-widest font-bold uppercase text-slate-200">
            TELEMETRY NODE: {wsStatus}
          </span>
        </div>
      </div>

      {/* Hero Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Card 1: Total Lots */}
        <div className="glass-panel p-6 bg-[#121721] rounded-custom">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-mono text-slate-400 tracking-wider uppercase">AGGREGATE EXECUTIONS</span>
            <Activity className="w-4 h-4 text-accent-cyan" />
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-slate-100">{stats.totalTrades}</p>
          <span className="text-[10px] text-slate-400 block mt-1">Total routed transactions</span>
        </div>

        {/* Card 2: Average Latency */}
        <div className="glass-panel p-6 bg-[#121721] rounded-custom">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-mono text-slate-400 tracking-wider uppercase">MEAN ROUTER OVERHEAD</span>
            <Zap className="w-4 h-4 text-accent-cyan" />
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-accent-cyan">{stats.averageLatencyMs} ms</p>
          <span className="text-[10px] text-slate-400 block mt-1">Network processing round-trip</span>
        </div>

        {/* Card 3: Netted volume ratio */}
        <div className="glass-panel p-6 bg-[#121721] rounded-custom">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-mono text-slate-400 tracking-wider uppercase">B-BOOK NETTED TRADES</span>
            <Layers className="w-4 h-4 text-accent-green" />
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-accent-green">{stats.nettedTradesCount}</p>
          <span className="text-[10px] text-slate-400 block mt-1">Offset matching transactions matched internally</span>
        </div>

        {/* Card 4: Saved Commissions */}
        <div className="glass-panel p-6 bg-[#121721] rounded-custom">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-mono text-slate-400 tracking-wider uppercase">COMMISSIONS SAVED</span>
            <TrendingDown className="w-4 h-4 text-accent-green" />
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-accent-green">${stats.commissionsSavedUsd.toFixed(2)}</p>
          <span className="text-[10px] text-slate-400 block mt-1">100% saved broker fee credits</span>
        </div>
      </div>

      {/* Live Telemetry trade records */}
      <div className="glass-panel p-6 bg-[#121721] rounded-custom border-white/5">
        <div className="flex justify-between items-center mb-6 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent-cyan" />
            <h3 className="text-sm font-bold tracking-widest font-mono text-slate-100 uppercase">LIVE EXECUTION FEED</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">Updates live inside browser memory</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-slate-400 font-mono tracking-wider text-[10px]">
                <th className="py-3 px-4 uppercase">Order ID</th>
                <th className="py-3 px-4 uppercase">LP Target</th>
                <th className="py-3 px-4 uppercase">Symbol</th>
                <th className="py-3 px-4 uppercase">Type</th>
                <th className="py-3 px-4 uppercase text-right">Volume</th>
                <th className="py-3 px-4 uppercase text-right">Filled Price</th>
                <th className="py-3 px-4 uppercase text-center">Latency</th>
                <th className="py-3 px-4 uppercase text-center">Tags</th>
                <th className="py-3 px-4 uppercase text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-mono">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No transactions captured. Open sandbox panel to dispatch test order packages.
                  </td>
                </tr>
              ) : (
                trades.map((trade) => (
                  <tr key={trade.orderId} className="hover:bg-white/2 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-300">{trade.orderId}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-200">{trade.companyName}</span>
                      <span className="text-[10px] font-mono text-slate-400 block">{trade.brokerName}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-100">{trade.symbol}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        trade.orderType.includes('BUY') ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'
                      }`}>
                        {trade.orderType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-200">
                      {trade.originalLots.toFixed(2)}
                      {trade.scaledLots !== trade.originalLots && (
                        <span className="text-[10px] text-slate-400 block">Scaled: {trade.scaledLots.toFixed(4)}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-100">
                      {trade.fillPrice ? trade.fillPrice.toFixed(trade.symbol.includes('JPY') || trade.symbol.includes('XAU') ? 2 : 5) : '—'}
                      <span className="text-[10px] text-slate-400 block">Req: {trade.requestedPrice}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span className={`text-[11px] font-bold ${
                        trade.executionLatencyMs > 100 ? 'text-accent-red' : trade.executionLatencyMs > 50 ? 'text-accent-gold' : 'text-accent-cyan'
                      }`}>
                        {trade.executionLatencyMs} ms
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {trade.isNettedInternally && (
                          <span className="bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/20 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider">
                            100% Netted
                          </span>
                        )}
                        {trade.isNewsShieldActive && (
                          <span className="bg-accent-gold/15 text-accent-gold border border-accent-gold/20 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider">
                            News Shield
                          </span>
                        )}
                        {trade.isToxicBotDetected && (
                          <span className="bg-accent-red/15 text-accent-red border border-accent-red/20 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider">
                            Toxic Flow
                          </span>
                        )}
                        {!trade.isNettedInternally && !trade.isNewsShieldActive && !trade.isToxicBotDetected && (
                          <span className="text-slate-500 font-mono text-[10px]">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {trade.success ? (
                        <span className="inline-flex items-center gap-1 text-accent-green text-[10px] font-semibold font-mono uppercase bg-accent-green/5 px-2 py-0.5 rounded border border-accent-green/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> FILLED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-accent-red text-[10px] font-semibold font-mono uppercase bg-accent-red/5 px-2 py-0.5 rounded border border-accent-red/20" title={trade.errorMessage}>
                          <XCircle className="w-3.5 h-3.5" /> REJECTED
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
