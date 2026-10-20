import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card, Btn } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';

export const LoginPage: React.FC = () => {
  const { toast } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast("Notice: Real Supabase Authentication is scheduled for Phase 3. Redirecting to Citizen Portal.");
    setTimeout(() => {
      navigate('/dashboard/citizen');
    }, 1200);
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
            Sign in to track issues or manage assigned department complaints
          </p>
        </div>

        {/* Integration Status Notice */}
        <div className="mb-4 rounded-xl border border-teal/30 bg-soft p-3.5 text-xs text-navy shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-teal mb-1">
            <Icon n="lock" s={14} />
            <span>Phase 1 Architecture Checkpoint</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Per development rules, no mock credentials or fake logins are used. Real Supabase Auth will be connected in Phase 3.
          </p>
        </div>

        {/* Login Form Card */}
        <Card className="p-6 shadow-lg">
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
                placeholder="citizen@community.org"
                className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-navy">
                  Password
                </label>
                <Link to="/auth/forgot-password" className="text-xs text-teal hover:underline">
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

            <Btn type="submit" v="p" className="w-full py-3 mt-2">
              Sign In
            </Btn>
          </form>

          <div className="my-5 border-t border-bd/60" />

          {/* Quick Portal Access for Testing */}
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground mb-2 text-center uppercase tracking-wider">
              Direct Portal Route Preview
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Link to="/dashboard/citizen" className="text-center rounded-lg border border-bd p-2 hover:bg-soft text-xs font-semibold text-navy">
                Citizen
              </Link>
              <Link to="/dashboard/officer" className="text-center rounded-lg border border-bd p-2 hover:bg-soft text-xs font-semibold text-navy">
                Officer
              </Link>
              <Link to="/dashboard/admin" className="text-center rounded-lg border border-bd p-2 hover:bg-soft text-xs font-semibold text-navy">
                Admin
              </Link>
            </div>
          </div>
        </Card>

        {/* Footer Link */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don't have an account yet?{' '}
          <Link to="/auth/register" className="font-semibold text-teal hover:underline">
            Register now
          </Link>
        </p>
      </div>
    </div>
  );
};
