import React from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card, Pill } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';

const DEPT_NAV = [
  { label: "Department Feed", href: "/dashboard/department", icon: "users" as const },
  { label: "Officer Queue", href: "/dashboard/officer", icon: "file" as const },
  { label: "Settings", href: "/settings/profile", icon: "user" as const },
];

export const DepartmentDashboard: React.FC = () => {
  return (
    <DashboardLayout
      roleTitle="Department Oversight"
      roleBadge="Manager"
      navItems={DEPT_NAV}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">Department Operations</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review departmental workload, staff assignments, and SLA compliance
            </p>
          </div>
          <Pill tone="t">Department View</Pill>
        </div>

        {/* Workload Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Department Total</div>
            <div className="mt-2 text-2xl font-bold text-navy">0</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Active complaints</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Active Officers</div>
            <div className="mt-2 text-2xl font-bold text-navy">0</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Assigned staff</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Escalations</div>
            <div className="mt-2 text-2xl font-bold text-red-600">0</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Breached SLAs</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Avg Resolution SLA</div>
            <div className="mt-2 text-2xl font-bold text-teal">0.0d</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Historical average</div>
          </Card>
        </div>

        {/* Empty Department Table */}
        <Card className="p-6">
          <div className="flex items-center justify-between border-b border-bd/60 pb-4 mb-6">
            <h2 className="text-base font-bold text-navy">Department Complaint Tickets</h2>
            <Pill tone="n">Live PostgreSQL Sync</Pill>
          </div>

          <div className="py-12 text-center max-w-md mx-auto">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-soft text-brand mb-4 shadow-sm">
              <Icon n="users" s={28} />
            </div>
            <h3 className="text-base font-bold text-navy">No department complaints found</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              When citizen complaints are categorized and assigned to this department, they will be listed here with assignment controls, escalations, and resolution audit trails.
            </p>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};
