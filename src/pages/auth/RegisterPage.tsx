// ==============================================================================
// SmartResolve Authentication: Registration Page
// Live resident self-registration with profile initialization and language preference
// ==============================================================================

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Btn } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';

export const RegisterPage: React.FC = () => {
  const { signUp, isConfigured, error: authError, clearError } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState<'en' | 'hi' | 'mr'>('en');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!fullName.trim() || !email.trim() || !password) {
      setLocalError('Please complete all required fields.');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters in length.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp(email, password, fullName, language);
      if (!result.success) {
        setLocalError(result.error || 'Registration failed. Please review your details.');
        setIsLoading(false);
        return;
      }

      setRegistrationComplete(true);
      // Wait a moment then route to onboarding join society
      setTimeout(() => {
        navigate('/onboarding/join-society', { replace: true });
      }, 1500);
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
          <h2 className="mt-4 text-xl font-bold text-navy">Create Resident Account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Register to submit, track, and verify community resolutions
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
              Real account creation requires <code className="bg-white/80 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_URL</code> and <code className="bg-white/80 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_ANON_KEY</code> in <code className="bg-white/80 px-1 py-0.5 rounded font-mono">.env</code>.
            </p>
          </div>
        )}

        <Card className="p-6 shadow-lg">
          {registrationComplete ? (
            <div className="text-center py-6 space-y-3">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-teal/20 text-teal">
                <Icon n="check" s={24} />
              </div>
              <h3 className="text-lg font-bold text-navy">Account Registered</h3>
              <p className="text-xs text-muted-foreground">
                Profile initialized. Redirecting to society selection...
              </p>
            </div>
          ) : (
            <>
              {(localError || authError) && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2">
                  <Icon n="alert" s={16} c="text-red-500 shrink-0 mt-0.5" />
                  <span>{localError || authError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="aarav@community.org"
                    className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                    Preferred Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'en' | 'hi' | 'mr')}
                    className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy focus:border-teal focus:outline-none"
                  >
                    <option value="en">English</option>
                    <option value="hi">हिन्दी (Hindi)</option>
                    <option value="mr">मराठी (Marathi)</option>
                  </select>
                </div>

                {/* Role Policy Explanation */}
                <div className="rounded-lg bg-soft p-3 text-[11px] text-muted-foreground space-y-1">
                  <div className="font-semibold text-navy flex items-center gap-1.5">
                    <Icon n="shield" s={12} c="text-teal" />
                    <span>Role Authorization Policy</span>
                  </div>
                  <p className="leading-relaxed">
                    Public registration provides resident membership capabilities. In-house maintenance staff, supervisors, and committee administrators are authorized by the Society Management Committee.
                  </p>
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
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Create Resident Account</span>
                  )}
                </Btn>
              </form>
            </>
          )}
        </Card>

        {/* Footer Link */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already registered?{' '}
          <Link to="/auth/login" className="font-semibold text-teal hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};
