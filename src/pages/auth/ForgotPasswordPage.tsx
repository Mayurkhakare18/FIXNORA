// ==============================================================================
// SmartResolve Authentication: Forgot Password Page
// Initiates secure Supabase Auth password recovery workflow
// ==============================================================================

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Btn } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';

export const ForgotPasswordPage: React.FC = () => {
  const { resetPassword, isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please provide your registered email address.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await resetPassword(email);
      if (!result.success) {
        setError(result.error || 'Failed to send reset link.');
        setIsLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold text-navy">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#263B52] text-white shadow-md">
              <Icon n="check" s={20} />
            </span>
            <span>Fixnora</span>
          </Link>
          <h2 className="mt-4 text-xl font-bold text-navy">Reset Password</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your registered email to receive secure recovery instructions
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
              Password recovery requires <code className="bg-white/80 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_URL</code> and <code className="bg-white/80 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_ANON_KEY</code> in <code className="bg-white/80 px-1 py-0.5 rounded font-mono">.env</code>.
            </p>
          </div>
        )}

        <Card className="p-6 shadow-lg">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-teal/20 text-teal">
                <Icon n="mail" s={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-navy">Recovery Email Dispatched</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                  If an account exists for <strong>{email}</strong>, a recovery link has been sent to your inbox.
                </p>
              </div>
              <div className="pt-2">
                <Link to="/auth/login">
                  <Btn v="p" className="w-full">
                    Return to Sign In
                  </Btn>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2">
                  <Icon n="alert" s={16} c="text-red-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
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

                <Btn
                  type="submit"
                  v="p"
                  disabled={isLoading}
                  className="w-full py-3 mt-2 shadow-md flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Icon n="refresh-cw" s={16} className="animate-spin" />
                      <span>Sending Instructions...</span>
                    </>
                  ) : (
                    <span>Send Reset Instructions</span>
                  )}
                </Btn>
              </form>

              <div className="mt-6 text-center">
                <Link to="/auth/login" className="text-sm font-semibold text-teal hover:underline inline-flex items-center gap-1">
                  <span>← Return to Login</span>
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};
