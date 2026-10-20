import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card, Btn, Pill, Row, TrackingTimeline } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';

const CITIZEN_NAV = [
  { label: "My Complaints", href: "/dashboard/citizen", icon: "file" as const },
  { label: "Report Issue", href: "/complaints/new", icon: "upload" as const },
  { label: "Track by ID", href: "/track", icon: "search" as const },
  { label: "Settings", href: "/settings/profile", icon: "user" as const },
];

export const ComplaintTrackingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const idFromUrl = searchParams.get('id') || '';
  const [searchInput, setSearchInput] = useState(idFromUrl);
  const [activeTrackingId, setActiveTrackingId] = useState(idFromUrl);

  useEffect(() => {
    if (idFromUrl) {
      setSearchInput(idFromUrl);
      setActiveTrackingId(idFromUrl);
    }
  }, [idFromUrl]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchParams({ id: searchInput.trim() });
      setActiveTrackingId(searchInput.trim());
    }
  };

  return (
    <DashboardLayout
      roleTitle="Track Complaint"
      roleBadge="Resident"
      navItems={CITIZEN_NAV}
    >
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-navy">Live Complaint Tracking</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Enter your unique Tracking ID to inspect real-time milestones and official responses
          </p>
        </div>

        {/* Tracking ID Search Box */}
        <Card className="p-4 shadow-sm">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Enter Tracking ID (e.g. SR-2026-1042)..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-bd bg-card px-4 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
              />
            </div>
            <Btn type="submit" v="p" className="px-6">
              <Icon n="search" s={16} />
              <span>Lookup</span>
            </Btn>
          </form>
        </Card>

        {/* Tracking Result View or Honest Empty State */}
        {activeTrackingId ? (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-bd/60 pb-4">
                <div>
                  <div className="text-xs font-semibold text-teal uppercase tracking-wider">
                    Tracking Lookup ID: {activeTrackingId}
                  </div>
                  <h2 className="text-xl font-bold text-navy mt-1">
                    Complaint Record View
                  </h2>
                </div>
                <Pill tone="w">Database Record Pending</Pill>
              </div>

              {/* Informative Honest Notice */}
              <div className="my-6 rounded-lg border border-bd bg-soft p-4 text-xs text-navy">
                <span className="font-bold block mb-1">
                  Database Lookup Integration Status (Phase 1)
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  You searched for Tracking ID <code className="font-mono text-navy font-bold">{activeTrackingId}</code>. In Phase 1, no mock complaint records are fabricated to simulate a database query. Real database persistence and live status lookup will connect to Supabase PostgreSQL in Phase 5.
                </p>
              </div>

              {/* Staged Timeline Structure */}
              <div className="opacity-75">
                <h3 className="text-sm font-bold text-navy mb-2">Lifecycle Milestones</h3>
                <TrackingTimeline index={0} />
              </div>

              <div className="mt-6 border-t border-bd/60 pt-4">
                <Row a="Tracking ID" b={activeTrackingId} />
                <Row a="Database Status" b="Awaiting Supabase PostgreSQL migration (Phase 2)" />
                <Row a="API Endpoint" b="GET /api/complaints/:id (Phase 4)" />
              </div>
            </Card>
          </div>
        ) : (
          <Card className="p-12 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-soft text-brand mb-4">
              <Icon n="search" s={28} />
            </div>
            <h3 className="text-base font-bold text-navy">No Tracking ID entered</h3>
            <p className="mt-2 text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Enter your complaint's tracking ID above to see its stage, assigned department, SLA deadline, and resolution history.
            </p>
            <div className="mt-6">
              <Link to="/complaints/new">
                <Btn v="p" className="text-xs">
                  Submit a New Complaint
                </Btn>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};
