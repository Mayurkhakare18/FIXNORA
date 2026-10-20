import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card, Btn } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';

export const ForgotPasswordPage: React.FC = () => {
  const { toast } = useApp();
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast("Password reset email delivery will be connected to Supabase Auth & Email provider in Phase 8.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold text-navy">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#263B52] text-white shadow-md">
              <Icon n="check" s={20} />
            </span>
            <span>SmartResolve</span>
          </Link>
          <h2 className="mt-4 text-xl font-bold text-navy">Reset Password</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email to receive recovery instructions
          </p>
        </div>

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

            <Btn type="submit" v="p" className="w-full py-3 mt-2">
              Send Reset Instructions
            </Btn>
          </form>

          <div className="mt-6 text-center">
            <Link to="/auth/login" className="text-sm font-semibold text-teal hover:underline">
              ← Return to Login
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
