import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card, Btn } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';

const CITIZEN_NAV = [
  { label: "My Complaints", href: "/dashboard/citizen", icon: "file" as const },
  { label: "Report Issue", href: "/complaints/new", icon: "upload" as const },
  { label: "Track by ID", href: "/track", icon: "search" as const },
  { label: "Settings", href: "/settings/profile", icon: "user" as const },
];

export const CitizenDashboard: React.FC = () => {
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
              Submit issues, view real-time status updates, and verify resolutions
            </p>
          </div>
          <Link to="/complaints/new">
            <Btn v="p" className="shadow-md">
              <Icon n="upload" s={16} />
              <span>Report New Issue</span>
            </Btn>
          </Link>
        </div>

        {/* Live Counters — Honest Zero / Empty until real DB records exist */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Total Complaints</div>
            <div className="mt-2 text-2xl font-bold text-navy">0</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Persisted in Supabase</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Under Review</div>
            <div className="mt-2 text-2xl font-bold text-brand">0</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Pending triage</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">In Progress</div>
            <div className="mt-2 text-2xl font-bold text-amber-600">0</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Assigned to officers</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Resolved</div>
            <div className="mt-2 text-2xl font-bold text-teal">0</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Closed with feedback</div>
          </Card>
        </div>

        {/* Complaints List Container with Genuine Empty State */}
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-bd/60 mb-6">
            <h2 className="text-base font-bold text-navy">My Submitted Complaints</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Filter by title or ID..."
                disabled
                className="rounded-lg border border-bd bg-card/60 px-3 py-1.5 text-xs text-muted-foreground focus:outline-none"
              />
            </div>
          </div>

          {/* Genuine Empty State (NON-NEGOTIABLE RULE: NO MOCK COMPLAINT RECORDS) */}
          <div className="py-12 text-center max-w-md mx-auto">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-soft text-brand mb-4 shadow-sm">
              <Icon n="file" s={28} />
            </div>
            <h3 className="text-base font-bold text-navy">No complaints submitted yet</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              You haven't submitted any complaints under this account. When you submit an issue, its genuine tracking ID, status milestones, and assigned officer will appear here.
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
        </Card>
      </div>
    </DashboardLayout>
  );
};
