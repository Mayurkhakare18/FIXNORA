// ==============================================================================
// SmartResolve Onboarding: Join a Society
// Allows registered users to apply for resident membership in an existing society
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Card, Btn, Pill } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';
import type { Society } from '../../types/database';

export const JoinSocietyPage: React.FC = () => {
  const { user, memberships, requestSocietyMembership, signOut, refreshData } = useAuth();
  const [availableSocieties, setAvailableSocieties] = useState<Society[]>([]);
  const [selectedSocietyId, setSelectedSocietyId] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSocieties, setIsFetchingSocieties] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Helper to get authorized route based on role
  const getDashboardRoute = (role?: string): string => {
    switch (role) {
      case 'society_admin':
        return '/dashboard/admin';
      case 'maintenance_staff':
        return '/dashboard/officer';
      case 'supervisor':
        return '/dashboard/department';
      case 'resident':
      default:
        return '/dashboard/citizen';
    }
  };

  const selectedSociety = availableSocieties.find((s) => s.id === selectedSocietyId);
  const existingForSelected = memberships.find((m) => m.society_id === selectedSocietyId);

  useEffect(() => {
    const loadSocieties = async () => {
      if (!isSupabaseConfigured) {
        setIsFetchingSocieties(false);
        return;
      }

      try {
        const { data, error: fetchErr } = await supabase
          .from('societies')
          .select('*')
          .order('name');

        if (fetchErr) throw fetchErr;
        const loaded = (data || []) as Society[];
        setAvailableSocieties(loaded);

        if (loaded.length > 0) {
          // If user has an active membership, pre-select or prefer societies where they aren't members
          const unjoined = loaded.find((s) => !memberships.some((m) => m.society_id === s.id));
          setSelectedSocietyId(unjoined ? unjoined.id : loaded[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load societies:', err);
        setError('Could not load registered societies. Please check network connection.');
      } finally {
        setIsFetchingSocieties(false);
      }
    };

    loadSocieties();
  }, [memberships]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSocietyId) {
      setError('Please select a housing society to continue.');
      return;
    }

    // Guard: already active member
    if (existingForSelected?.status === 'active') {
      navigate(getDashboardRoute(existingForSelected.role), { replace: true });
      return;
    }

    // Guard: already pending application
    if (existingForSelected?.status === 'pending') {
      navigate('/onboarding/pending-status', { replace: true });
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await requestSocietyMembership(selectedSocietyId, flatNumber);
      if (!result.success) {
        if (result.code === 'ALREADY_ACTIVE' && result.existingMembership) {
          setError(result.error || 'You are already an approved member of this society.');
        } else if (result.code === 'ALREADY_PENDING') {
          setError(result.error || 'Your application is already awaiting administrator approval.');
        } else if (result.code === 'DUPLICATE_MEMBERSHIP') {
          setError('You have already submitted an application for this society.');
        } else {
          setError(result.error || 'We could not submit your application. Please verify your details and try again.');
        }
        setIsLoading(false);
        return;
      }

      await refreshData();
      navigate('/onboarding/pending-status', { replace: true });
    } catch (err: any) {
      setError('An unexpected error occurred while submitting your application. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-2xl font-bold text-navy">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#263B52] text-white shadow-md">
              <Icon n="check" s={20} />
            </span>
            <span>Fixnora</span>
          </div>
          <h1 className="text-xl font-bold text-navy">Join Your Housing Society</h1>
          <p className="text-sm text-muted-foreground">
            Connect your user profile ({user?.email}) to an authorized housing society
          </p>
        </div>

        {/* Existing Memberships Notification (if user already belongs to any society) */}
        {memberships.length > 0 && (
          <div className="rounded-xl border border-teal/40 bg-teal/5 p-4 text-xs text-navy space-y-2 shadow-sm">
            <div className="flex items-center gap-2 font-semibold text-teal">
              <Icon n="shield" s={15} />
              <span>Your Registered Societies ({memberships.length})</span>
            </div>
            <div className="space-y-1.5">
              {memberships.map((m) => {
                const sName = availableSocieties.find((s) => s.id === m.society_id)?.name || 'Housing Society';
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between bg-card/80 px-3 py-1.5 rounded-lg border border-bd/60"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-navy">{sName}</span>
                      <Pill tone={m.role === 'society_admin' ? 't' : 'n'}>
                        {m.role === 'society_admin' ? 'Administrator' : m.role}
                      </Pill>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill tone={m.status === 'active' ? 't' : 'w'}>{m.status}</Pill>
                      {m.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => navigate(getDashboardRoute(m.role))}
                          className="text-[11px] font-semibold text-teal hover:underline ml-1"
                        >
                          Open Dashboard →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Policy Notice Box */}
        <div className="rounded-xl border border-bd bg-soft p-4 text-xs text-navy space-y-1.5 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-teal">
            <Icon n="shield" s={14} />
            <span>Residency Registration Policy</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Per Fixnora security architecture, new member applications default strictly to{' '}
            <strong className="text-navy">Resident</strong> role in <Pill tone="w">pending</Pill> status.
            In-house maintenance staff and supervisors are enrolled directly by authorized administrators.
          </p>
        </div>

        {/* Join Form Card */}
        <Card className="p-6 shadow-xl">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2">
              <Icon n="alert" s={16} c="text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Conflict Banner: Selected Society is already Active */}
          {existingForSelected?.status === 'active' && (
            <div className="mb-5 rounded-xl border border-emerald-300 bg-emerald-50/80 p-4 text-xs space-y-3 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <Icon n="check" s={16} c="text-emerald-600" />
                <span>Already an Approved Member</span>
              </div>
              <p className="text-emerald-900 leading-relaxed">
                You already hold an active{' '}
                <strong className="font-semibold text-navy">
                  {existingForSelected.role === 'society_admin'
                    ? 'Society Administrator'
                    : existingForSelected.role === 'maintenance_staff'
                    ? 'Maintenance Staff'
                    : existingForSelected.role === 'supervisor'
                    ? 'Supervisor'
                    : 'Resident'}
                </strong>{' '}
                membership in <strong>{selectedSociety?.name || 'this society'}</strong>. You do not need to apply again.
              </p>
              <Btn
                type="button"
                v="p"
                className="w-full py-2.5 text-xs shadow-sm bg-emerald-700 hover:bg-emerald-800 text-white"
                onClick={() => navigate(getDashboardRoute(existingForSelected.role))}
              >
                Go to My {existingForSelected.role === 'society_admin' ? 'Admin' : 'Resident'} Dashboard →
              </Btn>
            </div>
          )}

          {/* Conflict Banner: Selected Society is already Pending */}
          {existingForSelected?.status === 'pending' && (
            <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-xs space-y-3 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <Icon n="clock" s={16} c="text-amber-600" />
                <span>Application Awaiting Approval</span>
              </div>
              <p className="text-amber-900 leading-relaxed">
                Your residency application for <strong>{selectedSociety?.name || 'this society'}</strong> is already
                submitted and pending verification by the Society Management Committee.
              </p>
              <Btn
                type="button"
                v="secondary"
                className="w-full py-2.5 text-xs shadow-sm"
                onClick={() => navigate('/onboarding/pending-status')}
              >
                View Application Status →
              </Btn>
            </div>
          )}

          {/* Conflict Banner: Membership Rejected or Suspended */}
          {(existingForSelected?.status === 'rejected' || existingForSelected?.status === 'suspended') && (
            <div className="mb-5 rounded-xl border border-red-300 bg-red-50/80 p-4 text-xs space-y-2 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-red-800">
                <Icon n="x" s={16} c="text-red-600" />
                <span>Membership {existingForSelected.status}</span>
              </div>
              <p className="text-red-900 leading-relaxed">
                Your access to <strong>{selectedSociety?.name || 'this society'}</strong> has been{' '}
                {existingForSelected.status}. Please contact the Society Management Committee for resolution.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                Select Housing Society
              </label>
              {isFetchingSocieties ? (
                <div className="h-10 w-full animate-pulse rounded-lg bg-soft" />
              ) : availableSocieties.length > 0 ? (
                <select
                  value={selectedSocietyId}
                  onChange={(e) => {
                    setSelectedSocietyId(e.target.value);
                    setError(null);
                  }}
                  className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy focus:border-teal focus:outline-none"
                >
                  {availableSocieties.map((soc) => {
                    const existing = memberships.find((m) => m.society_id === soc.id);
                    const tag = existing ? ` — Already ${existing.status} (${existing.role})` : '';
                    return (
                      <option key={soc.id} value={soc.id}>
                        {soc.name} ({soc.city}, {soc.state}){tag}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div className="rounded-lg border border-bd bg-soft p-3 text-xs text-muted-foreground">
                  No registered societies found in database. An administrator must register a society first.
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                Flat / Apartment Number <span className="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
                placeholder="e.g. Tower B - 402"
                disabled={!!existingForSelected}
                className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none disabled:bg-soft disabled:text-muted-foreground"
              />
              <small className="block mt-1 text-[11px] text-muted-foreground">
                Helps your Society Administrator quickly verify and approve your residency.
              </small>
            </div>

            {/* Submit Button (Disabled if already a member or pending in this society) */}
            <Btn
              type="submit"
              v="p"
              disabled={isLoading || availableSocieties.length === 0 || !!existingForSelected}
              className="w-full py-3 mt-3 shadow-md"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Icon n="refresh-cw" s={16} className="animate-spin" />
                  <span>Submitting Application...</span>
                </span>
              ) : existingForSelected?.status === 'active' ? (
                <span>Already an Active Member</span>
              ) : existingForSelected?.status === 'pending' ? (
                <span>Application Already Pending</span>
              ) : (
                <span>Submit Residency Application</span>
              )}
            </Btn>
          </form>

          <div className="my-5 border-t border-bd/60" />

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Need to switch accounts?</span>
            <button
              type="button"
              onClick={() => signOut()}
              className="font-semibold text-teal hover:underline flex items-center gap-1"
            >
              <Icon n="log-out" s={12} />
              <span>Sign Out</span>
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};
