import React, { useState } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card, Pill } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';

const OFFICER_NAV = [
  { label: "Assigned Queue", href: "/dashboard/officer", icon: "file" as const },
  { label: "Department Feed", href: "/dashboard/department", icon: "users" as const },
  { label: "Settings", href: "/settings/profile", icon: "user" as const },
];

export const OfficerDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'in_progress' | 'overdue'>('all');

  return (
    <DashboardLayout
      roleTitle="Department Officer Portal"
      roleBadge="Officer"
      navItems={OFFICER_NAV}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">Assigned Queue</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Service requests assigned to your department officer profile
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone="t">Electrical Department</Pill>
          </div>
        </div>

        {/* Queue Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Assigned to Me</div>
            <div className="mt-2 text-2xl font-bold text-navy">0</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Active cases</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Awaiting Action</div>
            <div className="mt-2 text-2xl font-bold text-brand">0</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Pending site visit</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Overdue SLA</div>
            <div className="mt-2 text-2xl font-bold text-red-600">0</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Past deadline</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Resolved This Month</div>
            <div className="mt-2 text-2xl font-bold text-teal">0</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Verified resolutions</div>
          </Card>
        </div>

        {/* Tab Filters & Queue Table */}
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bd/60 pb-4 mb-6">
            <div className="flex gap-2">
              {(
                [
                  ['all', 'All Cases (0)'],
                  ['pending', 'Pending (0)'],
                  ['in_progress', 'In Progress (0)'],
                  ['overdue', 'Overdue (0)'],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === tab
                      ? "bg-[#263B52] text-white shadow-sm"
                      : "text-muted-foreground hover:bg-soft hover:text-navy"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search queue..."
                disabled
                className="rounded-lg border border-bd bg-card/60 px-3 py-1.5 text-xs text-muted-foreground focus:outline-none"
              />
            </div>
          </div>

          {/* Authentic Empty Queue State */}
          <div className="py-12 text-center max-w-md mx-auto">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-soft text-brand mb-4 shadow-sm">
              <Icon n="users" s={28} />
            </div>
            <h3 className="text-base font-bold text-navy">Queue is currently empty</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              No complaint tickets are assigned to your officer profile. When citizens submit issues or department administrators assign tasks, they will appear here with SLA countdowns and case remarks.
            </p>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};
