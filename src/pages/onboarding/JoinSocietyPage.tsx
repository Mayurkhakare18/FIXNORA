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
  const { user, requestSocietyMembership, signOut, refreshData } = useAuth();
  const [availableSocieties, setAvailableSocieties] = useState<Society[]>([]);
  const [selectedSocietyId, setSelectedSocietyId] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSocieties, setIsFetchingSocieties] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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
        setAvailableSocieties((data || []) as Society[]);
        if (data && data.length > 0) {
          setSelectedSocietyId(data[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load societies:', err);
        setError('Could not load registered societies. Please check network connection.');
      } finally {
        setIsFetchingSocieties(false);
      }
    };

    loadSocieties();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSocietyId) {
      setError('Please select a housing society to continue.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await requestSocietyMembership(selectedSocietyId);
      if (!result.success) {
        setError(result.error || 'Failed to submit application');
        setIsLoading(false);
        return;
      }

      await refreshData();
      navigate('/onboarding/pending-status');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
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
            <span>SmartResolve</span>
          </div>
          <h1 className="text-xl font-bold text-navy">Join Your Housing Society</h1>
          <p className="text-sm text-muted-foreground">
            Connect your user profile ({user?.email}) to an authorized housing society
          </p>
        </div>

        {/* Policy Notice Box */}
        <div className="rounded-xl border border-teal/30 bg-soft p-4 text-xs text-navy space-y-1.5 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-teal">
            <Icon n="shield" s={14} />
            <span>Security Governance Policy</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Per SmartResolve security architecture, new member registration defaults strictly to{' '}
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
                  onChange={(e) => setSelectedSocietyId(e.target.value)}
                  className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy focus:border-teal focus:outline-none"
                >
                  {availableSocieties.map((soc) => (
                    <option key={soc.id} value={soc.id}>
                      {soc.name} ({soc.city}, {soc.state})
                    </option>
                  ))}
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
                className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
              />
              <small className="block mt-1 text-[11px] text-muted-foreground">
                Helps your Society Administrator quickly verify and approve your residency.
              </small>
            </div>

            <Btn
              type="submit"
              v="p"
              disabled={isLoading || availableSocieties.length === 0}
              className="w-full py-3 mt-3 shadow-md"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Icon n="refresh-cw" s={16} className="animate-spin" />
                  <span>Submitting Application...</span>
                </span>
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
