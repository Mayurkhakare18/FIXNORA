// ==============================================================================
// SmartResolve Onboarding: Pending Membership Status
// Informs resident that their application is awaiting administrative approval
// ==============================================================================

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Btn, Pill } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';

export const PendingStatusPage: React.FC = () => {
  const { currentSociety, currentMembership, refreshData, signOut } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setCheckMessage(null);
    try {
      await refreshData();
      if (currentMembership?.status === 'active') {
        navigate('/dashboard/citizen');
      } else {
        setCheckMessage('Status verified: Still pending administrative approval.');
      }
    } catch (err: any) {
      setCheckMessage('Could not refresh status. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-2xl font-bold text-navy">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#263B52] text-white shadow-md">
              <Icon n="check" s={20} />
            </span>
            <span>SmartResolve</span>
          </div>
          <h1 className="text-xl font-bold text-navy">Application Under Review</h1>
          <p className="text-sm text-muted-foreground">
            Your residency membership request is awaiting approval
          </p>
        </div>

        <Card className="p-6 shadow-xl space-y-5 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 shadow-sm animate-pulse">
            <Icon n="clock" s={32} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-base font-bold text-navy">
                {currentSociety?.name || 'Housing Society'}
              </span>
              <Pill tone="w">Pending Approval</Pill>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
              Your application has been received. Once a designated Society Administrator verifies your residency,
              you will receive full access to file complaints, view maintenance updates, and participate in community polls.
            </p>
          </div>

          {checkMessage && (
            <div className="rounded-lg bg-soft p-3 text-xs text-navy border border-bd">
              {checkMessage}
            </div>
          )}

          <div className="space-y-2.5 pt-2">
            <Btn
              v="p"
              onClick={handleCheckStatus}
              disabled={isChecking}
              className="w-full py-2.5 shadow-md flex items-center justify-center gap-2"
            >
              <Icon n="refresh-cw" s={14} className={isChecking ? "animate-spin" : ""} />
              <span>{isChecking ? "Checking Status..." : "Refresh Approval Status"}</span>
            </Btn>

            <Link to="/onboarding/join-society" className="block">
              <Btn className="w-full py-2.5 text-xs text-muted-foreground hover:text-navy">
                Apply to Another Society
              </Btn>
            </Link>
          </div>

          <div className="my-4 border-t border-bd/60" />

          <button
            type="button"
            onClick={() => signOut()}
            className="text-xs text-teal font-semibold hover:underline inline-flex items-center gap-1.5"
          >
            <Icon n="log-out" s={14} />
            <span>Sign Out</span>
          </button>
        </Card>
      </div>
    </div>
  );
};
