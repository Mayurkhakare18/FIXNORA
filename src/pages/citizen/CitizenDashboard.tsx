// ==============================================================================
// SmartResolve Citizen: Resident Dashboard
// Live PostgreSQL complaints register, real-time counters, search filter, and genuine empty states
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card, Btn, Pill } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  fetchResidentDashboardData,
  type ResidentDashboardData,
} from '../../lib/complaintService';

const CITIZEN_NAV = [
  { label: "My Complaints", href: "/dashboard/citizen", icon: "file" as const },
  { label: "Report Issue", href: "/complaints/new", icon: "upload" as const },
  { label: "Track by ID", href: "/track", icon: "search" as const },
  { label: "Settings", href: "/settings/profile", icon: "user" as const },
];

export const CitizenDashboard: React.FC = () => {
  const { user, currentSociety } = useAuth();

  const [dashboardData, setDashboardData] = useState<ResidentDashboardData>({
    total: 0,
    underReview: 0,
    inProgress: 0,
    resolved: 0,
    recentComplaints: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');

  const loadData = async () => {
    if (!user || !currentSociety) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchResidentDashboardData(user.id, currentSociety.id);
      setDashboardData(data);
    } catch (err: any) {
      console.error('Failed to load resident dashboard complaints:', err);
      setError(err.message || 'Could not load your complaints register.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id, currentSociety?.id]);

  const filteredComplaints = dashboardData.recentComplaints.filter((c) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.tracking_id.toLowerCase().includes(q) ||
      (c.category?.name && c.category.name.toLowerCase().includes(q))
    );
  });

  const getStatusPillTone = (status: string): 'n' | 'h' | 't' | 'w' => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return 't';
      case 'in_progress':
      case 'assigned':
        return 'n';
      case 'rejected':
        return 'h';
      default:
        return 'w';
    }
  };

  return (
    <DashboardLayout
      roleTitle="Resident Portal"
      roleBadge="Resident"
      navItems={CITIZEN_NAV}
    >
      <div className="space-y-6">
        {/* Welcome & Primary Action */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">Resident Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Active Society: <strong className="text-navy">{currentSociety?.name || 'Loading...'}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              title="Refresh dashboard"
              className="rounded-lg border border-bd bg-card p-2 text-muted-foreground hover:text-navy hover:border-teal transition disabled:opacity-50"
            >
              <Icon n="refresh-cw" s={16} c={isLoading ? "animate-spin text-teal" : ""} />
            </button>
            <Link to="/complaints/new">
              <Btn v="p" className="shadow-md">
                <Icon n="upload" s={16} />
                <span>Report New Issue</span>
              </Btn>
            </Link>
          </div>
        </div>

        {/* Configuration Notice if Supabase is unconfigured */}
        {!isSupabaseConfigured && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900">
            <strong>Configuration Notice:</strong> Supabase credentials are not configured in <code className="font-mono">.env</code>. Live complaint statistics and database persistence will activate once keys are provided.
          </div>
        )}

        {/* Live Counters derived directly from authorized database records */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Complaints
            </div>
            <div className="mt-2 text-2xl font-bold text-navy">
              {isLoading ? '...' : dashboardData.total}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Submitted by you
            </div>
          </Card>

          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Under Review
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600">
              {isLoading ? '...' : dashboardData.underReview}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Pending triage
            </div>
          </Card>

          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              In Progress
            </div>
            <div className="mt-2 text-2xl font-bold text-brand">
              {isLoading ? '...' : dashboardData.inProgress}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Assigned to technicians
            </div>
          </Card>

          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Resolved
            </div>
            <div className="mt-2 text-2xl font-bold text-teal">
              {isLoading ? '...' : dashboardData.resolved}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Fixed & closed
            </div>
          </Card>
        </div>

        {/* Complaints Register Section */}
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-bd/60 mb-6">
            <div>
              <h2 className="text-base font-bold text-navy">My Submitted Complaints</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time society database records with tracking milestones
              </p>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Filter by title or ID..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-56 rounded-lg border border-bd bg-card px-3 py-1.5 text-xs text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
              />
            </div>
          </div>

          {/* Error View */}
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-xs text-red-700 border border-red-200 mb-4 flex items-center justify-between">
              <span>{error}</span>
              <Btn type="button" onClick={loadData} className="text-xs py-1 px-3">
                Retry
              </Btn>
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="space-y-3 py-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-soft/70 animate-pulse" />
              ))}
            </div>
          )}

          {/* Populated Complaints List */}
          {!isLoading && filteredComplaints.length > 0 && (
            <div className="space-y-3">
              {filteredComplaints.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-bd bg-soft/30 hover:bg-soft/60 p-4 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-teal">
                        {c.tracking_id}
                      </span>
                      <Pill tone={getStatusPillTone(c.status)}>
                        {c.status.replace(/_/g, ' ').toUpperCase()}
                      </Pill>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Priority: {c.priority}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-navy">{c.title}</h3>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{c.category?.name || 'General Issue'}</span>
                      {c.building?.name && (
                        <>
                          <span>•</span>
                          <span>
                            {c.building.name}
                            {c.flat?.flat_number ? ` / Flat ${c.flat.flat_number}` : ''}
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span>
                        {new Date(c.submitted_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link to={`/track?id=${c.tracking_id}`}>
                      <Btn v="secondary" className="text-xs py-1.5 px-3">
                        <Icon n="search" s={14} />
                        <span>Track</span>
                      </Btn>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filter returned 0 results */}
          {!isLoading && dashboardData.recentComplaints.length > 0 && filteredComplaints.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No complaints match your filter criteria "{filterQuery}".
            </div>
          )}

          {/* Genuine Empty State */}
          {!isLoading && dashboardData.recentComplaints.length === 0 && (
            <div className="py-12 text-center max-w-md mx-auto">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-soft text-brand mb-4 shadow-sm">
                <Icon n="file" s={28} />
              </div>
              <h3 className="text-base font-bold text-navy">No complaints submitted yet</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                You haven't submitted any complaints under this account. When you submit an issue, its genuine tracking ID, status milestones, and assigned department will appear here.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link to="/complaints/new">
                  <Btn v="p" className="text-xs px-5">
                    Submit Your First Issue
                  </Btn>
                </Link>
                <Link to="/track">
                  <Btn className="text-xs px-5">
                    Track by ID
                  </Btn>
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};
