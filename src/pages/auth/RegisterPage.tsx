// ==============================================================================
// SmartResolve Authentication: Registration Page
// Supports Society/Hostel Administrator and Resident self-registration
// Fully resilient offline/demo fallback, language selection, and plan onboarding
// ==============================================================================

import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Btn, Pill } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';
import { changeSubscriptionPlan, SUBSCRIPTION_PLANS } from '../../lib/subscriptionService';
import type { SubscriptionPlanType } from '../../types/database';

export const RegisterPage: React.FC = () => {
  const { signUp, error: authError, clearError } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const planParam = searchParams.get('plan') as SubscriptionPlanType | null;
  const roleParam = searchParams.get('role');

  const initialRole = planParam || roleParam === 'admin' ? 'society_admin' : 'resident';

  const [accountRole, setAccountRole] = useState<'society_admin' | 'resident'>(initialRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState<'en' | 'hi' | 'mr'>('en');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const selectedPlanMeta = planParam ? SUBSCRIPTION_PLANS[planParam] : null;

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
      const result = await signUp(email, password, fullName, language, accountRole);
      if (!result.success) {
        setLocalError(result.error || 'Registration failed. Please review your details.');
        setIsLoading(false);
        return;
      }

      // If a plan was chosen from landing page, initialize subscription
      if (planParam && (planParam === 'hostel' || planParam === 'society')) {
        try {
          await changeSubscriptionPlan('11111111-1111-1111-1111-111111111111', planParam, 'monthly');
        } catch (subErr) {
          console.warn('Subscription initialization notice:', subErr);
        }
      }

      setRegistrationComplete(true);

      setTimeout(() => {
        if (accountRole === 'society_admin' || planParam) {
          navigate('/admin/billing', { replace: true });
        } else {
          navigate('/dashboard/citizen', { replace: true });
        }
      }, 1200);
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
            <span>Fixnora</span>
          </Link>
          <h2 className="mt-4 text-xl font-bold text-navy">
            {accountRole === 'society_admin' ? 'Create Administrator Account' : 'Create Resident Account'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {accountRole === 'society_admin'
              ? 'Manage hostel/society operations, staff assignments & billing'
              : 'Register to submit, track, and verify community resolutions'}
          </p>
        </div>

        {/* Selected Plan Highlight Banner */}
        {selectedPlanMeta && (
          <div className="mb-4 rounded-xl border border-teal/40 bg-teal/10 p-4 text-xs shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal text-white font-bold">
                <Icon n="check" s={16} />
              </span>
              <div>
                <span className="font-bold text-navy block">{selectedPlanMeta.name} Selected</span>
                <span className="text-[11px] text-teal font-medium">
                  ₹{selectedPlanMeta.monthlyPrice.toLocaleString('en-IN')}/month + 18% GST (SAC 998314)
                </span>
              </div>
            </div>
            <Pill tone="t">Ready</Pill>
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
                {accountRole === 'society_admin' || planParam
                  ? 'Administrator workspace ready. Redirecting to Billing Dashboard...'
                  : 'Profile initialized. Redirecting to Citizen Portal...'}
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

              {/* Role Selector Tabs */}
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountRole('society_admin')}
                    className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition ${
                      accountRole === 'society_admin'
                        ? 'border-teal bg-teal/10 text-teal shadow-xs'
                        : 'border-bd bg-soft text-muted-foreground hover:bg-white'
                    }`}
                  >
                    Society / Hostel Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountRole('resident')}
                    className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition ${
                      accountRole === 'resident'
                        ? 'border-teal bg-teal/10 text-teal shadow-xs'
                        : 'border-bd bg-soft text-muted-foreground hover:bg-white'
                    }`}
                  >
                    Resident
                  </button>
                </div>
              </div>

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
                    placeholder={accountRole === 'society_admin' ? 'e.g. Kavita Iyer' : 'e.g. Aarav Sharma'}
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
                    placeholder={accountRole === 'society_admin' ? 'admin@housing-society.org' : 'resident@society.org'}
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
                    <span>
                      {accountRole === 'society_admin' ? 'Create Administrator Account' : 'Create Resident Account'}
                    </span>
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
