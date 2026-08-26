/**
 * @file frontend/src/pages/register.tsx
 * @description Authentication registration card template. Handles tenant provisioning and Super Admin bootstrap.
 */

import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { ShieldAlert, Building2, Mail, Lock, Code2 } from 'lucide-react';

export const Register: React.FC = () => {
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [superAdminCode, setSuperAdminCode] = useState('');
  const [isSuperAdminReg, setIsSuperAdminReg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload: any = {
      email,
      password,
    };

    if (isSuperAdminReg) {
      payload.superAdminCode = superAdminCode;
    } else {
      payload.companyName = companyName;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failure');
      }

      setSuccess(
        isSuperAdminReg 
          ? 'Super Admin provisioned successfully! Directing to Login...' 
          : `Tenant Workspace registered! License issued. Redirecting to Login...`
      );

      setTimeout(() => {
        setLocation('/login');
      }, 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0B0E14] px-4">
      <div className="w-full max-w-md p-8 glass-panel bg-[#121721] rounded-custom border-white/5 relative overflow-hidden">
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-accent-green/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-12 h-12 rounded bg-gradient-to-tr from-accent-cyan to-accent-green flex items-center justify-center text-[#0B0E14] font-black text-xl shadow-[0_0_20px_rgba(0,240,255,0.4)] mb-4">
            Ω
          </div>
          <h2 className="text-xl font-bold tracking-widest text-slate-100 font-mono uppercase">PROVISION WORKSPACE</h2>
          <p className="text-xs text-slate-400 mt-1">Deploy institutional SaaS routing instance</p>
        </div>

        {error && (
          <div className="mb-6 p-3 text-xs bg-accent-red/10 border border-accent-red/20 text-accent-red rounded-custom flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-3 text-xs bg-accent-green/10 border border-accent-green/20 text-accent-green rounded-custom flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setIsSuperAdminReg(false)}
            className={`flex-1 py-1.5 text-[10px] font-mono tracking-wider rounded border transition-all cursor-pointer ${
              !isSuperAdminReg 
                ? 'bg-accent-cyan/10 border-accent-cyan text-accent-cyan' 
                : 'border-white/5 text-slate-400'
            }`}
          >
            CLIENT PORTAL
          </button>
          <button
            onClick={() => setIsSuperAdminReg(true)}
            className={`flex-1 py-1.5 text-[10px] font-mono tracking-wider rounded border transition-all cursor-pointer ${
              isSuperAdminReg 
                ? 'bg-accent-cyan/10 border-accent-cyan text-accent-cyan' 
                : 'border-white/5 text-slate-400'
            }`}
          >
            SUPER ADMIN BOOTSTRAP
          </button>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {!isSuperAdminReg ? (
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">Brokerage Company Name</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  id="reg-company-input"
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm glass-input"
                  placeholder="ACME Capital Ltd"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">SUPER_ADMIN_KEY Setup Code</label>
              <div className="relative">
                <Code2 className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  id="reg-secret-code"
                  type="password"
                  required
                  value={superAdminCode}
                  onChange={(e) => setSuperAdminCode(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm glass-input"
                  placeholder="Enter secret initialization key"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">Admin Operator Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                id="reg-email-input"
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
            <label className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">Operator Master Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                id="reg-password-input"
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
            id="register-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3 text-xs font-bold tracking-widest text-[#0B0E14] bg-accent-green hover:bg-accent-green/85 rounded-custom transition-all shadow-[0_0_15px_rgba(0,230,118,0.2)] disabled:opacity-55 cursor-pointer uppercase font-mono"
          >
            {loading ? 'Executing Deploy...' : 'Deploy System instance'}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-400 border-t border-white/5 pt-4">
          Already registered?{' '}
          <Link href="/login" className="text-accent-cyan hover:underline font-mono">
            [Log In]
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
