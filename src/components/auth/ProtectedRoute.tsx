// ==============================================================================
// SmartResolve Protected Route Guard
// Enforces authentication, onboarding completion, and role-based permissions
// ==============================================================================

import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/database';
import { Card, Btn, Pill } from '../ui/Primitives';
import { Icon } from '../ui/Icon';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireActiveMembership?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requireActiveMembership = true,
}) => {
  const { user, currentMembership, currentSociety, isLoading, isConfigured, memberships } = useAuth();
  const location = useLocation();

  // 1. Loading State: sleek glassmorphism spinner to prevent content flash
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="glass rounded-2xl border border-white/60 p-8 shadow-xl max-w-sm w-full text-center space-y-4">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#263B52] text-teal animate-pulse">
            <Icon n="shield" s={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-navy">Verifying Session</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Restoring authenticated session and permissions...
            </p>
          </div>
          <div className="h-1.5 w-full bg-soft rounded-full overflow-hidden">
            <div className="h-full bg-teal w-2/3 animate-[shimmer_1.5s_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Unconfigured Supabase Warning Banner for local dev without .env
  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full p-6 text-center space-y-4 shadow-xl border-amber-300">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <Icon n="alert" s={24} />
          </div>
          <h2 className="text-lg font-bold text-navy">Supabase Credentials Required</h2>
          <p className="text-sm text-muted-foreground">
            This protected route requires a live Supabase connection. Please configure{' '}
            <code className="bg-soft px-1.5 py-0.5 rounded text-xs font-mono text-navy">VITE_SUPABASE_URL</code>{' '}
            and{' '}
            <code className="bg-soft px-1.5 py-0.5 rounded text-xs font-mono text-navy">VITE_SUPABASE_ANON_KEY</code>{' '}
            in your <code className="bg-soft px-1.5 py-0.5 rounded text-xs font-mono text-navy">.env</code> file.
          </p>
          <div className="pt-2">
            <Link to="/">
              <Btn v="p" className="w-full">
                Return to Landing Page
              </Btn>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // 3. Unauthenticated: Redirect to login
  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // 4. Onboarding: User has no society memberships
  if (requireActiveMembership && memberships.length === 0) {
    return <Navigate to="/onboarding/join-society" replace />;
  }

  // 5. Onboarding: Selected membership is still pending approval
  if (requireActiveMembership && currentMembership && currentMembership.status === 'pending') {
    return <Navigate to="/onboarding/pending-status" replace />;
  }

  // 6. Onboarding: Membership was rejected or suspended
  if (requireActiveMembership && currentMembership && currentMembership.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full p-6 text-center space-y-4 shadow-xl border-red-200">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-red-100 text-red-700">
            <Icon n="x" s={24} />
          </div>
          <h2 className="text-lg font-bold text-navy">Membership {currentMembership.status}</h2>
          <p className="text-sm text-muted-foreground">
            Your access to <strong>{currentSociety?.name || 'this society'}</strong> has been{' '}
            {currentMembership.status}. Please contact the Society Management Committee.
          </p>
          <div className="pt-2">
            <Link to="/onboarding/join-society">
              <Btn v="p" className="w-full">
                Apply to Another Society
              </Btn>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // 7. Role Guard: Check if user's role in current active society is permitted
  if (allowedRoles && currentMembership && !allowedRoles.includes(currentMembership.role)) {
    const roleRoutes: Record<UserRole, string> = {
      resident: '/dashboard/citizen',
      maintenance_staff: '/dashboard/officer',
      supervisor: '/dashboard/department',
      society_admin: '/dashboard/admin',
    };
    const defaultRoute = roleRoutes[currentMembership.role] || '/';

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full p-6 text-center space-y-4 shadow-xl border-red-200">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-red-100 text-red-600">
            <Icon n="shield" s={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-navy">Access Restricted</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Your active role (<Pill tone="t">{currentMembership.role}</Pill>) in{' '}
              <strong>{currentSociety?.name || 'this society'}</strong> is not authorized to access this section.
            </p>
          </div>
          <div className="pt-2">
            <Link to={defaultRoute}>
              <Btn v="p" className="w-full">
                Go to My Authorized Dashboard
              </Btn>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Authorized
  return <>{children}</>;
};
