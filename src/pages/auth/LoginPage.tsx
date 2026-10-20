// ==============================================================================
// SmartResolve Authentication: Login Page
// Live Supabase authentication with session restoration and role-based redirect
// ==============================================================================

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Btn } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';

export const LoginPage: React.FC = () => {
  const { signIn, isConfigured, currentMembership, memberships, error: authError, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email.trim() || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn(email, password);
      if (!result.success) {
        setLocalError(result.error || 'Authentication failed. Please verify credentials.');
        setIsLoading(false);
        return;
      }

      // Check where to redirect based on location state or membership status
      const fromPath = (location.state as any)?.from?.pathname;
      if (fromPath && fromPath !== '/auth/login' && fromPath !== '/auth/register') {
        navigate(fromPath, { replace: true });
        return;
      }

      // Redirect by membership state
      if (memberships.length === 0) {
        navigate('/onboarding/join-society', { replace: true });
      } else if (currentMembership?.status === 'pending') {
        navigate('/onboarding/pending-status', { replace: true });
      } else if (currentMembership?.role === 'society_admin') {
        navigate('/dashboard/admin', { replace: true });
      } else if (currentMembership?.role === 'maintenance_staff') {
        navigate('/dashboard/officer', { replace: true });
      } else if (currentMembership?.role === 'supervisor') {
        navigate('/dashboard/department', { replace: true });
      } else {
        navigate('/dashboard/citizen', { replace: true });
      }
    } catch (err: any) {
      setLocalError(err.message || 'An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold text-navy">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#263B52] text-white shadow-md">
              <Icon n="check" s={20} />
            </span>
            <span>SmartResolve</span>
          </Link>
          <h2 className="mt-4 text-xl font-bold text-navy">Welcome Back</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to track issues or manage housing society operations
          </p>
        </div>

        {/* Configuration Notice if Supabase is unconfigured */}
        {!isConfigured && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm space-y-1">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <Icon n="alert" s={14} />
              <span>Live Supabase Credentials Unset</span>
            </div>
            <p className="leading-relaxed">
              To authenticate against a live database, configure <code className="bg-white/80 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_URL</code> and <code className="bg-white/80 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_ANON_KEY</code> in <code className="bg-white/80 px-1 py-0.5 rounded font-mono">.env</code>.
            </p>
          </div>
        )}

        {/* Login Form Card */}
        <Card className="p-6 shadow-lg">
          {(localError || authError) && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2">
              <Icon n="alert" s={16} c="text-red-500 shrink-0 mt-0.5" />
              <span>{localError || authError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="resident@society.org"
                className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-navy">
                  Password
                </label>
                <Link to="/auth/forgot-password" className="text-xs text-teal hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
              />
            </div>

            <Btn
              type="submit"
              v="p"
              disabled={isLoading}
              className="w-full py-3 mt-2 shadow-md flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Icon n="refresh-cw" s={16} className="animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </Btn>
          </form>

          <div className="my-5 border-t border-bd/60" />

          {/* Secure Role Access Information */}
          <div className="rounded-lg bg-soft p-3 text-center space-y-1">
            <span className="text-[11px] font-bold text-navy uppercase tracking-wider block">
              Multi-Role Housing Society Access
            </span>
            <p className="text-[11px] text-muted-foreground leading-normal">
              Your authorized dashboard is automatically resolved based on your approved membership in the selected society.
            </p>
          </div>
        </Card>

        {/* Footer Link */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don't have an account yet?{' '}
          <Link to="/auth/register" className="font-semibold text-teal hover:underline">
            Register as Resident
          </Link>
        </p>
      </div>
    </div>
  );
};
