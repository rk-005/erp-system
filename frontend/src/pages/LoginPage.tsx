import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Zap, Lock, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../lib/api';
import toast from 'react-hot-toast';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter your email and password');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      // Always go to /dashboard — it's accessible by all roles and personalised per role.
      // Never blindly redirect to `from` because it might be a role-restricted page
      // (e.g. /warehouse for a SALES user) causing an immediate Access Denied screen.
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (role: string) => {
    const credentials: Record<string, { email: string; password: string }> = {
      admin: { email: 'admin@erp.local', password: 'Admin@123' },
      sales: { email: 'sales@erp.local', password: 'Sales@123' },
      warehouse: { email: 'warehouse@erp.local', password: 'Warehouse@123' },
      accounts: { email: 'accounts@erp.local', password: 'Accounts@123' },
    };
    const cred = credentials[role];
    setEmail(cred.email);
    setPassword(cred.password);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-center items-center p-12 relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/10" />
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 30% 20%, hsl(217 91% 60% / 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 80%, hsl(252 76% 64% / 0.1) 0%, transparent 50%)'
        }} />

        <div className="relative z-10 max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6 shadow-2xl shadow-primary/30">
            E
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4 leading-tight">
            ERP Operations<br />
            <span className="gradient-text">Portal</span>
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Complete CRM & inventory management for wholesale distribution businesses.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 text-left">
            {[
              { icon: '👥', title: 'Customer CRM', desc: 'Track leads, follow-ups & notes' },
              { icon: '📦', title: 'Inventory', desc: 'Real-time stock management' },
              { icon: '📋', title: 'Sales Challans', desc: 'Atomic stock transactions' },
              { icon: '📊', title: 'Analytics', desc: 'Business insights at a glance' },
            ].map((item) => (
              <div key={item.title} className="glass-card p-4">
                <div className="text-2xl mb-2">{item.icon}</div>
                <h3 className="font-semibold text-foreground text-sm">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 lg:max-w-md flex flex-col justify-center p-8">
        <div className="w-full max-w-sm mx-auto animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
              E
            </div>
            <span className="font-bold text-foreground">ERP Portal</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-1">Sign in</h2>
            <p className="text-muted-foreground text-sm">Enter your credentials to access the portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground block">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@erp.local"
                  className="input-field pl-9"
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-9 pr-10"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full justify-center py-2.5"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Quick login shortcuts */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" /> Quick login (demo)
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <p className="text-xs text-red-500/90 text-center mb-3">
              Click on any role below to autofill credentials for testing
            </p>
            <div className="grid grid-cols-2 gap-2">
              {['admin', 'sales', 'warehouse', 'accounts'].map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => quickLogin(role)}
                  className="btn-secondary text-xs py-1.5 capitalize"
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
