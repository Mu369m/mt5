/**
 * @file frontend/src/pages/clients.tsx
 * @description Public client visit page for visitors who need a direct overview
 * before entering the authenticated tenant portal.
 */

import React from 'react';
import { Activity, ArrowRight, BarChart3, Network, ShieldCheck, Zap } from 'lucide-react';
import { Link } from 'wouter';

const features = [
  { icon: Network, label: 'Multi-LP routing', detail: 'Route order flow across configured liquidity destinations.' },
  { icon: Zap, label: 'Low-latency telemetry', detail: 'Track execution speed, slippage, and connection health.' },
  { icon: ShieldCheck, label: 'Dealer controls', detail: 'Apply risk policies, symbol rules, and protective controls.' },
  { icon: BarChart3, label: 'Clear reporting', detail: 'Review activity, volume, and routing performance in one place.' },
];

export const Clients: React.FC = () => {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0B0E14] text-slate-100">
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 lg:px-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-cyan/10 blur-3xl" />
        <header className="relative flex items-center justify-between border-b border-white/10 pb-5">
          <Link href="/clients" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded bg-gradient-to-tr from-accent-cyan to-accent-green text-lg font-black text-[#0B0E14]">O</span>
            <span>
              <span className="block font-mono text-sm font-bold tracking-[0.3em]">BRP</span>
              <span className="block font-mono text-[9px] tracking-[0.2em] text-slate-500">CLIENT ACCESS</span>
            </span>
          </Link>
          <nav className="flex items-center gap-3 font-mono text-xs">
            <Link href="/login" className="rounded border border-white/10 px-4 py-2 text-slate-300 transition-colors hover:border-accent-cyan hover:text-accent-cyan">Login</Link>
            <Link href="/register" className="rounded bg-accent-cyan px-4 py-2 font-bold text-[#0B0E14] transition-colors hover:bg-accent-green">Register</Link>
          </nav>
        </header>

        <section className="relative grid flex-1 items-center gap-14 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded border border-accent-green/30 bg-accent-green/5 px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] text-accent-green">
              <Activity className="h-3.5 w-3.5" /> CLIENT PORTAL ONLINE
            </div>
            <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">Your institutional trade routing control room.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-400">Connect destinations, shape dealer rules, inject symbol markups, and monitor execution telemetry from one focused client workspace.</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/register" className="inline-flex items-center gap-2 rounded bg-accent-cyan px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[#0B0E14] transition-colors hover:bg-accent-green">
                Start client setup <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="font-mono text-xs uppercase tracking-wider text-slate-400 transition-colors hover:text-accent-cyan">Open existing portal</Link>
            </div>
          </div>

          <div className="relative grid gap-3 sm:grid-cols-2">
            {features.map(({ icon: Icon, label, detail }) => (
              <div key={label} className="glass-panel rounded-custom p-5">
                <Icon className="mb-8 h-5 w-5 text-accent-cyan" />
                <h2 className="font-mono text-sm font-bold text-slate-100">{label}</h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="relative flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 font-mono text-[10px] uppercase tracking-wider text-slate-600">
          <span>BRP Trade Router SaaS</span>
          <span>Secure tenant infrastructure</span>
        </footer>
      </div>
    </main>
  );
};

export default Clients;
