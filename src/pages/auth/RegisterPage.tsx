import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card, Btn } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';

export const RegisterPage: React.FC = () => {
  const { toast } = useApp();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('citizen');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast("Notice: Real Supabase Auth account creation will be connected in Phase 3.");
    setTimeout(() => {
      navigate('/dashboard/citizen');
    }, 1200);
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
          <h2 className="mt-4 text-xl font-bold text-navy">Create an Account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Register to submit, track, and resolve community complaints
          </p>
        </div>

        <Card className="p-6 shadow-lg">
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
                placeholder="Aarav Sharma"
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
                Account Type
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy focus:border-teal focus:outline-none"
              >
                <option value="citizen">Resident / Citizen</option>
                <option value="officer">Department Officer</option>
                <option value="department_manager">Department Manager</option>
              </select>
              <small className="block mt-1 text-[11px] text-muted-foreground">
                In Phase 3, elevated roles require explicit administrative authorization.
              </small>
            </div>

            <Btn type="submit" v="p" className="w-full py-3 mt-2">
              Create Account
            </Btn>
          </form>
        </Card>

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
