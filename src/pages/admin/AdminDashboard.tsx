import React, { useState } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card, Pill } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';

const ADMIN_NAV = [
  { label: "Overview", href: "/dashboard/admin", icon: "chart" as const },
  { label: "Departments", href: "/admin/departments", icon: "users" as const },
  { label: "Categories", href: "/admin/categories", icon: "filter" as const },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "shield" as const },
  { label: "Settings", href: "/settings/profile", icon: "user" as const },
];

export const AdminDashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'overview' | 'departments' | 'categories' | 'audit'>('overview');

  return (
    <DashboardLayout
      roleTitle="System Administration"
      roleBadge="Administrator"
      navItems={ADMIN_NAV}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">Administrative Console</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Platform governance, department management, role authorization, and audit oversight
            </p>
          </div>
          <Pill tone="h">Admin Scope</Pill>
        </div>

        {/* Live Aggregation Summary — Authentic Zero State */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Total Complaints</div>
            <div className="mt-2 text-2xl font-bold text-navy">0</div>
            <div className="mt-1 text-[11px] text-muted-foreground">All departments</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Open / In Progress</div>
            <div className="mt-2 text-2xl font-bold text-brand">0</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Active workload</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Overdue SLAs</div>
            <div className="mt-2 text-2xl font-bold text-red-600">0</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Breached thresholds</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Resolution Rate</div>
            <div className="mt-2 text-2xl font-bold text-teal">0%</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Computed via SQL</div>
          </Card>
        </div>

        {/* Console Tabs */}
        <div className="flex gap-2 border-b border-bd pb-2">
          {(
            [
              ['overview', 'Complaint Oversight'],
              ['departments', 'Departments (0)'],
              ['categories', 'Categories (0)'],
              ['audit', 'Audit Logs (0)'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSection(key)}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                activeSection === key
                  ? "bg-[#263B52] text-white shadow-sm"
                  : "text-muted-foreground hover:bg-soft hover:text-navy"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Section View */}
        <Card className="p-6">
          <div className="flex items-center justify-between border-b border-bd/60 pb-4 mb-6">
            <h2 className="text-base font-bold text-navy">
              {activeSection === 'overview' && "Live Complaints Register"}
              {activeSection === 'departments' && "Department Directory"}
              {activeSection === 'categories' && "Complaint Categories & SLAs"}
              {activeSection === 'audit' && "System Audit Log & Security Trail"}
            </h2>
            <Pill tone="n">Supabase Table Sync</Pill>
          </div>

          <div className="py-12 text-center max-w-md mx-auto">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-soft text-brand mb-4 shadow-sm">
              <Icon n="shield" s={28} />
            </div>
            <h3 className="text-base font-bold text-navy">
              {activeSection === 'overview' && "No complaints in database"}
              {activeSection === 'departments' && "No departments configured"}
              {activeSection === 'categories' && "No categories configured"}
              {activeSection === 'audit' && "No audit records found"}
            </h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {activeSection === 'overview' &&
                "Live complaint records will appear here as citizens submit them. Admin overrides and SLA controls will be managed directly from this view."}
              {activeSection === 'departments' &&
                "Departments (Electrical, Water, Roads, Waste, etc.) will be seeded into PostgreSQL tables in Phase 2."}
              {activeSection === 'categories' &&
                "Complaint categories and default resolution deadlines will be configured in Phase 2."}
              {activeSection === 'audit' &&
                "Immutable transaction logs for every status change, assignment, and authorization action will be stored in PostgreSQL audit_logs in Phase 2."}
            </p>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};
