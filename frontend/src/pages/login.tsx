/**
 * @file frontend/src/pages/login.tsx
 * @description Authentication login card template styled in deep void glassmorphism.
 */

import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { ShieldCheck, Mail, Lock } from 'lucide-react';
import { useTheme } from '../theme';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { loadBrandingAndTheme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failure');
      }

      // Save tokens
      localStorage.setItem('brp_token', data.token);
      localStorage.setItem('brp_user', JSON.stringify(data.user));

      // Reload customized CMS theme parameters
      await loadBrandingAndTheme();

      // Route based on role
      if (data.user.role === 'SUPER_ADMIN') {
        setLocation('/super-admin');
      } else {
        setLocation('/');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0B0E14] px-4">
      <div className="w-full max-w-md p-8 glass-panel bg-[#121721] rounded-custom border-white/5 relative overflow-hidden">
        {/* Glow grid background */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-accent-cyan/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-12 h-12 rounded bg-gradient-to-tr from-accent-cyan to-accent-green flex items-center justify-center text-[#0B0E14] font-black text-xl shadow-[0_0_20px_rgba(0,240,255,0.4)] mb-4">
            Ω
          </div>
          <h2 className="text-xl font-bold tracking-widest text-slate-100 font-mono uppercase">BRP ROUTER INTRALINK</h2>
          <p className="text-xs text-slate-400 mt-1">Institutional Multi-Tenant Liquidity Routing Platform</p>
        </div>

        {error && (
          <div className="mb-6 p-3 text-xs bg-accent-red/10 border border-accent-red/20 text-accent-red rounded-custom flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">Operator Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                id="login-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm glass-input"
                placeholder="operator@firm.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">Secure Key Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                id="login-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm glass-input"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            id="login-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3 text-xs font-bold tracking-widest text-[#0B0E14] bg-accent-cyan hover:bg-accent-cyan/85 rounded-custom transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)] disabled:opacity-55 cursor-pointer uppercase font-mono"
          >
            {loading ? 'Decrypting Session...' : 'Authenticate Token'}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-400 border-t border-white/5 pt-4">
          Need to deploy a new tenant?{' '}
          <Link href="/register">
            <a className="text-accent-cyan hover:underline font-mono">[Register Client]</a>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
