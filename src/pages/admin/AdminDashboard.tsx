// ==============================================================================
// SmartResolve Administrative Console
// Platform governance, membership approval, in-house staff enrollment, and oversight
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card, Pill, Btn } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

const ADMIN_NAV = [
  { label: "Overview", href: "/dashboard/admin", icon: "chart" as const },
  { label: "Memberships & Staff", href: "/dashboard/admin", icon: "user-check" as const },
  { label: "Departments", href: "/admin/departments", icon: "users" as const },
  { label: "Categories", href: "/admin/categories", icon: "filter" as const },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "shield" as const },
  { label: "Settings", href: "/settings/profile", icon: "user" as const },
];

export const AdminDashboard: React.FC = () => {
  const { currentSociety, approveMembership, rejectMembership, enrollStaffMember } = useAuth();
  const [activeSection, setActiveSection] = useState<'overview' | 'memberships' | 'departments' | 'categories' | 'audit'>('overview');
  
  // Membership management states
  const [pendingMemberships, setPendingMemberships] = useState<any[]>([]);
  const [staffMemberships, setStaffMemberships] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Enrollment modal/form state
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollUserId, setEnrollUserId] = useState('');
  const [enrollRole, setEnrollRole] = useState<'maintenance_staff' | 'supervisor'>('maintenance_staff');
  const [enrollDesignation, setEnrollDesignation] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const loadMemberships = async () => {
    if (!currentSociety || !isSupabaseConfigured) return;
    setIsLoadingMembers(true);
    try {
      // Load pending resident requests
      const { data: pendingData } = await supabase
        .from('society_memberships')
        .select(`
          id,
          society_id,
          user_id,
          role,
          status,
          created_at,
          profiles:user_id (id, full_name, email)
        `)
        .eq('society_id', currentSociety.id)
        .eq('status', 'pending');

      setPendingMemberships(pendingData || []);

      // Load active in-house staff
      const { data: staffData } = await supabase
        .from('society_memberships')
        .select(`
          id,
          society_id,
          user_id,
          role,
          status,
          staff_designation,
          created_at,
          profiles:user_id (id, full_name, email)
        `)
        .eq('society_id', currentSociety.id)
        .in('role', ['maintenance_staff', 'supervisor']);

      setStaffMemberships(staffData || []);
    } catch (err: any) {
      console.error('Failed to load memberships:', err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'memberships') {
      loadMemberships();
    }
  }, [activeSection, currentSociety]);

  const handleApprove = async (membershipId: string) => {
    setActionMessage('Approving residency request...');
    const res = await approveMembership(membershipId);
    if (res.success) {
      setActionMessage('Residency membership approved successfully.');
      await loadMemberships();
    } else {
      setActionMessage(`Approval failed: ${res.error}`);
    }
  };

  const handleReject = async (membershipId: string) => {
    setActionMessage('Rejecting residency request...');
    const res = await rejectMembership(membershipId);
    if (res.success) {
      setActionMessage('Residency membership rejected.');
      await loadMemberships();
    } else {
      setActionMessage(`Rejection failed: ${res.error}`);
    }
  };

  const handleEnrollStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSociety || !enrollUserId.trim() || !enrollDesignation.trim()) {
      setEnrollError('Please specify technician user ID and designation.');
      return;
    }

    setEnrollError(null);
    setIsEnrolling(true);

    const res = await enrollStaffMember(
      currentSociety.id,
      enrollUserId.trim(),
      enrollRole,
      enrollDesignation.trim()
    );

    if (res.success) {
      setShowEnrollModal(false);
      setEnrollUserId('');
      setEnrollDesignation('');
      setActionMessage('In-house maintenance staff member enrolled successfully.');
      await loadMemberships();
    } else {
      setEnrollError(res.error || 'Failed to enroll staff member.');
    }
    setIsEnrolling(false);
  };

  return (
    <DashboardLayout
      roleTitle="Society Administration"
      roleBadge="Administrator"
      navItems={ADMIN_NAV}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">Administrative Console</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Platform governance, resident approvals, in-house staff enrollment, and oversight
            </p>
          </div>
          <Pill tone="h">{currentSociety?.name || 'Admin Scope'}</Pill>
        </div>

        {/* Live Aggregation Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Total Complaints</div>
            <div className="mt-2 text-2xl font-bold text-navy">0</div>
            <div className="mt-1 text-[11px] text-muted-foreground">All departments</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Pending Approvals</div>
            <div className="mt-2 text-2xl font-bold text-amber-600">{pendingMemberships.length}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Resident applications</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">In-House Staff</div>
            <div className="mt-2 text-2xl font-bold text-brand">{staffMemberships.length}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Active technicians</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground">Resolution Rate</div>
            <div className="mt-2 text-2xl font-bold text-teal">0%</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Computed via SQL</div>
          </Card>
        </div>

        {/* Console Navigation Tabs */}
        <div className="flex gap-2 border-b border-bd pb-2 overflow-x-auto">
          {(
            [
              ['overview', 'Complaint Oversight'],
              ['memberships', `Memberships & Staff (${pendingMemberships.length} pending)`],
              ['departments', 'Departments (0)'],
              ['categories', 'Categories (0)'],
              ['audit', 'Audit Logs (0)'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSection(key)}
              className={`rounded-lg px-4 py-2 text-xs font-bold whitespace-nowrap transition ${
                activeSection === key
                  ? "bg-[#263B52] text-white shadow-sm"
                  : "text-muted-foreground hover:bg-soft hover:text-navy"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Action feedback message */}
        {actionMessage && (
          <div className="rounded-lg bg-soft p-3 text-xs text-navy border border-bd flex items-center justify-between">
            <span>{actionMessage}</span>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-muted-foreground hover:text-navy font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Section View */}
        {activeSection === 'memberships' ? (
          <div className="space-y-6">
            {/* 1. Pending Approvals Queue */}
            <Card className="p-6">
              <div className="flex items-center justify-between border-b border-bd/60 pb-4 mb-4">
                <div>
                  <h2 className="text-base font-bold text-navy">Pending Residency Applications</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Verify applicant identity and approve access to the housing society portal
                  </p>
                </div>
                <Btn
                  onClick={loadMemberships}
                  disabled={isLoadingMembers}
                  className="py-1.5 px-3 text-xs flex items-center gap-1.5"
                >
                  <Icon n="refresh-cw" s={12} className={isLoadingMembers ? "animate-spin" : ""} />
                  <span>Refresh</span>
                </Btn>
              </div>

              {pendingMemberships.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No pending residency membership applications at this time.
                </div>
              ) : (
                <div className="divide-y divide-bd/60">
                  {pendingMemberships.map((mem) => (
                    <div key={mem.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-navy">
                          {mem.profiles?.full_name || 'Resident Applicant'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {mem.profiles?.email} • Applied: {new Date(mem.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Btn
                          v="p"
                          onClick={() => handleApprove(mem.id)}
                          className="py-1.5 px-3 text-xs bg-teal hover:bg-teal/90"
                        >
                          Approve
                        </Btn>
                        <Btn
                          onClick={() => handleReject(mem.id)}
                          className="py-1.5 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50"
                        >
                          Reject
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 2. In-House Maintenance Staff Directory & Enrollment */}
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between border-b border-bd/60 pb-4 mb-4 gap-2">
                <div>
                  <h2 className="text-base font-bold text-navy">In-House Maintenance Staff & Supervisors</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Authorized technicians enrolled under approved Phase 2.2 administrative policy (No Vendors)
                  </p>
                </div>
                <Btn
                  v="p"
                  onClick={() => setShowEnrollModal(true)}
                  className="py-1.5 px-3 text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Icon n="plus" s={14} />
                  <span>Enroll In-House Staff</span>
                </Btn>
              </div>

              {staffMemberships.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No in-house maintenance staff enrolled yet. Use the button above to authorize technicians.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {staffMemberships.map((staff) => (
                    <div key={staff.id} className="rounded-lg border border-bd p-3 bg-soft/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-navy">
                          {staff.profiles?.full_name || 'Staff Member'}
                        </span>
                        <Pill tone="t">{staff.role}</Pill>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {staff.staff_designation || 'Technician'} • {staff.profiles?.email}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* In-House Staff Enrollment Modal */}
            {showEnrollModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                <Card className="max-w-md w-full p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-bd/60 pb-3">
                    <h3 className="text-base font-bold text-navy">Enroll In-House Staff</h3>
                    <button
                      type="button"
                      onClick={() => setShowEnrollModal(false)}
                      className="text-muted-foreground hover:text-navy"
                    >
                      ✕
                    </button>
                  </div>

                  {enrollError && (
                    <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                      {enrollError}
                    </div>
                  )}

                  <form onSubmit={handleEnrollStaff} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                        User Profile UUID
                      </label>
                      <input
                        type="text"
                        required
                        value={enrollUserId}
                        onChange={(e) => setEnrollUserId(e.target.value)}
                        placeholder="e.g. 12345678-1234-1234-1234-123456789abc"
                        className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs font-mono text-navy focus:border-teal focus:outline-none"
                      />
                      <small className="block text-[10px] text-muted-foreground mt-0.5">
                        UUID of the registered user's profile to authorize as staff.
                      </small>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                        Role
                      </label>
                      <select
                        value={enrollRole}
                        onChange={(e) => setEnrollRole(e.target.value as any)}
                        className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                      >
                        <option value="maintenance_staff">In-House Maintenance Staff</option>
                        <option value="supervisor">Maintenance Supervisor</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                        In-House Designation
                      </label>
                      <input
                        type="text"
                        required
                        value={enrollDesignation}
                        onChange={(e) => setEnrollDesignation(e.target.value)}
                        placeholder="e.g. Senior Electrician, Plumber"
                        className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                      <Btn
                        type="button"
                        onClick={() => setShowEnrollModal(false)}
                        className="py-2 text-xs"
                      >
                        Cancel
                      </Btn>
                      <Btn
                        type="submit"
                        v="p"
                        disabled={isEnrolling}
                        className="py-2 text-xs"
                      >
                        {isEnrolling ? 'Enrolling...' : 'Confirm Enrollment'}
                      </Btn>
                    </div>
                  </form>
                </Card>
              </div>
            )}
          </div>
        ) : (
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
                  "Live complaint records will appear here as citizens submit them in Phase 4."}
                {activeSection === 'departments' &&
                  "In-house facility departments will be managed here."}
                {activeSection === 'categories' &&
                  "Complaint categories and SLAs will be configured here."}
                {activeSection === 'audit' &&
                  "Immutable transaction logs for every status change, assignment, and authorization action are recorded in public.audit_logs."}
              </p>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};
