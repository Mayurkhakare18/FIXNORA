// ==============================================================================
// SmartResolve Administrative Console
// Platform governance, membership approval, in-house staff enrollment, assignments & audit
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card, Pill, Btn } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  fetchEligibleSocietyStaff,
  assignComplaintToStaff,
  type EligibleStaff,
} from '../../lib/maintenanceService';
import type { Department, ComplaintCategory } from '../../types/database';
import type { ComplaintWithRelations } from '../../lib/complaintService';

const ADMIN_NAV = [
  { label: "Overview", href: "/dashboard/admin", icon: "chart" as const },
  { label: "Memberships & Staff", href: "/dashboard/admin", icon: "user-check" as const },
  { label: "Departments", href: "/admin/departments", icon: "users" as const },
  { label: "Categories", href: "/admin/categories", icon: "filter" as const },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "shield" as const },
  { label: "Settings", href: "/settings/profile", icon: "user" as const },
];

export const AdminDashboard: React.FC = () => {
  const { user, currentSociety, approveMembership, rejectMembership, enrollStaffMember } = useAuth();
  const [activeSection, setActiveSection] = useState<'overview' | 'memberships' | 'departments' | 'categories' | 'audit'>('overview');
  
  // Membership management states
  const [pendingMemberships, setPendingMemberships] = useState<any[]>([]);
  const [staffMemberships, setStaffMemberships] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Staff Enrollment modal state
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollUserId, setEnrollUserId] = useState('');
  const [enrollRole, setEnrollRole] = useState<'maintenance_staff' | 'supervisor'>('maintenance_staff');
  const [enrollDesignation, setEnrollDesignation] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // Overview / Complaints states
  const [complaints, setComplaints] = useState<ComplaintWithRelations[]>([]);
  const [isLoadingComplaints, setIsLoadingComplaints] = useState(false);

  // Assignment Modal
  const [assigningComplaint, setAssigningComplaint] = useState<ComplaintWithRelations | null>(null);
  const [eligibleStaff, setEligibleStaff] = useState<EligibleStaff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Departments, Categories & Audit logs
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingSection, setIsLoadingSection] = useState(false);

  // Load complaints for Overview
  const loadComplaints = async () => {
    if (!currentSociety || !isSupabaseConfigured) return;
    setIsLoadingComplaints(true);
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          *,
          category:complaint_categories(id, name),
          building:buildings(id, name),
          flat:flats(id, flat_number)
        `)
        .eq('society_id', currentSociety.id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setComplaints((data || []) as ComplaintWithRelations[]);

      // Load eligible staff for assignments
      const staffList = await fetchEligibleSocietyStaff(currentSociety.id);
      setEligibleStaff(staffList);
      if (staffList.length > 0) {
        setSelectedStaffId(staffList[0].userId);
      }
    } catch (err: any) {
      console.error('Failed to load complaints in admin:', err);
    } finally {
      setIsLoadingComplaints(false);
    }
  };

  // Load memberships
  const loadMemberships = async () => {
    if (!currentSociety || !isSupabaseConfigured) return;
    setIsLoadingMembers(true);
    try {
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

  // Load section-specific data (departments, categories, audit logs)
  const loadSectionData = async () => {
    if (!currentSociety || !isSupabaseConfigured) return;
    setIsLoadingSection(true);

    try {
      if (activeSection === 'departments') {
        const { data } = await supabase
          .from('departments')
          .select('*')
          .eq('society_id', currentSociety.id)
          .order('name');
        setDepartments((data || []) as Department[]);
      } else if (activeSection === 'categories') {
        const { data } = await supabase
          .from('complaint_categories')
          .select('*')
          .eq('society_id', currentSociety.id)
          .order('name');
        setCategories((data || []) as ComplaintCategory[]);
      } else if (activeSection === 'audit') {
        const { data } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('society_id', currentSociety.id)
          .order('created_at', { ascending: false })
          .limit(50);
        setAuditLogs(data || []);
      }
    } catch (err: any) {
      console.error('Failed to load section data:', err);
    } finally {
      setIsLoadingSection(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'overview') {
      loadComplaints();
    } else if (activeSection === 'memberships') {
      loadMemberships();
    } else {
      loadSectionData();
    }
  }, [activeSection, currentSociety?.id]);

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

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningComplaint || !user || !currentSociety) return;

    if (!selectedStaffId) {
      setAssignError('Please select a technician.');
      return;
    }

    setAssignError(null);
    setIsSubmittingAssign(true);

    try {
      await assignComplaintToStaff({
        societyId: currentSociety.id,
        complaintId: assigningComplaint.id,
        staffUserId: selectedStaffId,
        assignedByUserId: user.id,
        departmentId: assigningComplaint.department_id,
        complaintTitle: assigningComplaint.title,
        complaintDescription: assigningComplaint.description,
      });

      setActionMessage(`Ticket ${assigningComplaint.tracking_id} assigned successfully.`);
      setAssigningComplaint(null);
      await loadComplaints();
    } catch (err: any) {
      setAssignError(err.message || 'Failed to assign complaint.');
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  // Status counts
  const totalCount = complaints.length;
  const unassignedCount = complaints.filter((c) => c.status === 'submitted').length;
  const inProgressCount = complaints.filter((c) => ['assigned', 'in_progress'].includes(c.status)).length;
  const resolvedCount = complaints.filter((c) => ['resolved', 'closed'].includes(c.status)).length;

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
      roleTitle="Administrative Console"
      roleBadge="Society Admin"
      navItems={ADMIN_NAV}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">Society Governance & Operations</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Society: <strong className="text-navy">{currentSociety?.name || 'Loading...'}</strong>
            </p>
          </div>
          <Pill tone="t">Society Administrator</Pill>
        </div>

        {/* Console Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-bd/60 pb-3">
          {(
            [
              ['overview', 'Complaints Overview'],
              ['memberships', 'Memberships & Staff'],
              ['departments', 'Departments'],
              ['categories', 'Categories & SLAs'],
              ['audit', 'Audit Logs'],
            ] as const
          ).map(([sec, label]) => (
            <button
              key={sec}
              type="button"
              onClick={() => setActiveSection(sec)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeSection === sec
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
          <div className="rounded-lg bg-teal/10 p-3 text-xs text-teal font-medium border border-teal/20 flex items-center justify-between">
            <span>{actionMessage}</span>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="font-bold text-teal hover:opacity-75"
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. OVERVIEW SECTION: Real Complaints & Assignment */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="p-4 shadow-sm">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Complaints
                </div>
                <div className="mt-2 text-2xl font-bold text-navy">
                  {isLoadingComplaints ? '...' : totalCount}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Society register</div>
              </Card>
              <Card className="p-4 shadow-sm">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Awaiting Assignment
                </div>
                <div className="mt-2 text-2xl font-bold text-amber-600">
                  {isLoadingComplaints ? '...' : unassignedCount}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Requires technician</div>
              </Card>
              <Card className="p-4 shadow-sm">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  In Progress
                </div>
                <div className="mt-2 text-2xl font-bold text-brand">
                  {isLoadingComplaints ? '...' : inProgressCount}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Assigned & active</div>
              </Card>
              <Card className="p-4 shadow-sm">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Resolved
                </div>
                <div className="mt-2 text-2xl font-bold text-teal">
                  {isLoadingComplaints ? '...' : resolvedCount}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Closed tickets</div>
              </Card>
            </div>

            <Card className="p-6">
              <div className="flex items-center justify-between border-b border-bd/60 pb-4 mb-4">
                <div>
                  <h2 className="text-base font-bold text-navy">Live Complaints Register</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Inspect records, assign technicians, and monitor resolution progress
                  </p>
                </div>
                <Btn
                  onClick={loadComplaints}
                  disabled={isLoadingComplaints}
                  className="py-1.5 px-3 text-xs flex items-center gap-1.5"
                >
                  <Icon n="refresh-cw" s={12} className={isLoadingComplaints ? "animate-spin" : ""} />
                  <span>Refresh</span>
                </Btn>
              </div>

              {isLoadingComplaints && (
                <div className="space-y-3 py-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-soft animate-pulse" />
                  ))}
                </div>
              )}

              {!isLoadingComplaints && complaints.length > 0 && (
                <div className="space-y-3">
                  {complaints.map((comp) => (
                    <div
                      key={comp.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-bd bg-soft/30 hover:bg-soft/60 p-4 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-teal">
                            {comp.tracking_id}
                          </span>
                          <Pill tone={getStatusPillTone(comp.status)}>
                            {comp.status.replace(/_/g, ' ').toUpperCase()}
                          </Pill>
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                            Priority: {comp.priority}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-navy">{comp.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{comp.category?.name || 'Category'}</span>
                          {comp.building?.name && (
                            <>
                              <span>•</span>
                              <span>
                                {comp.building.name}
                                {comp.flat?.flat_number ? ` / Flat ${comp.flat.flat_number}` : ''}
                              </span>
                            </>
                          )}
                          <span>•</span>
                          <span>{new Date(comp.submitted_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {comp.status === 'submitted' && (
                          <Btn
                            v="p"
                            onClick={() => {
                              setAssigningComplaint(comp);
                              setAssignError(null);
                            }}
                            className="text-xs py-1.5 px-3 bg-teal hover:bg-teal/90"
                          >
                            <Icon n="user-check" s={14} />
                            <span>Assign</span>
                          </Btn>
                        )}
                        <a
                          href={`/track?id=${comp.tracking_id}`}
                          className="text-xs text-teal font-semibold hover:underline px-2"
                        >
                          View
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isLoadingComplaints && complaints.length === 0 && (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  No complaints submitted in this society yet.
                </div>
              )}
            </Card>
          </div>
        )}

        {/* 2. MEMBERSHIPS & IN-HOUSE STAFF SECTION */}
        {activeSection === 'memberships' && (
          <div className="space-y-6">
            {/* Pending Residency Applications Queue */}
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

            {/* In-House Maintenance Staff Directory & Enrollment */}
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
          </div>
        )}

        {/* 3. DEPARTMENTS SECTION */}
        {activeSection === 'departments' && (
          <Card className="p-6">
            <div className="flex items-center justify-between border-b border-bd/60 pb-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-navy">Society Facility Departments</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Internal operational divisions (Electrical, Plumbing, Elevators, Civil, Security)
                </p>
              </div>
              <Pill tone="n">PostgreSQL Sync</Pill>
            </div>

            {isLoadingSection && (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-soft rounded-lg animate-pulse" />
                ))}
              </div>
            )}

            {!isLoadingSection && departments.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {departments.map((dept) => (
                  <div key={dept.id} className="rounded-lg border border-bd p-4 bg-soft/30 space-y-1">
                    <h3 className="text-sm font-bold text-navy">{dept.name}</h3>
                    <p className="text-xs text-muted-foreground">{dept.description || 'Facility department'}</p>
                  </div>
                ))}
              </div>
            )}

            {!isLoadingSection && departments.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No departments configured yet for this society.
              </div>
            )}
          </Card>
        )}

        {/* 4. CATEGORIES SECTION */}
        {activeSection === 'categories' && (
          <Card className="p-6">
            <div className="flex items-center justify-between border-b border-bd/60 pb-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-navy">Complaint Categories & SLAs</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Resolution timelines and default priority rules
                </p>
              </div>
              <Pill tone="n">PostgreSQL Sync</Pill>
            </div>

            {isLoadingSection && (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-soft rounded-lg animate-pulse" />
                ))}
              </div>
            )}

            {!isLoadingSection && categories.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <div key={cat.id} className="rounded-lg border border-bd p-4 bg-soft/30 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-navy">{cat.name}</h3>
                      <Pill tone="t">{cat.sla_hours}h SLA</Pill>
                    </div>
                    <p className="text-xs text-muted-foreground">{cat.description || 'Standard category'}</p>
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase pt-1">
                      Default Priority: {cat.default_priority}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoadingSection && categories.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No categories configured yet for this society.
              </div>
            )}
          </Card>
        )}

        {/* 5. AUDIT LOGS SECTION */}
        {activeSection === 'audit' && (
          <Card className="p-6">
            <div className="flex items-center justify-between border-b border-bd/60 pb-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-navy">System Audit Log & Security Trail</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Immutable records from public.audit_logs tracking insertions, status changes, and assignments
                </p>
              </div>
              <Pill tone="n">Immutable</Pill>
            </div>

            {isLoadingSection && (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-soft rounded-lg animate-pulse" />
                ))}
              </div>
            )}

            {!isLoadingSection && auditLogs.length > 0 && (
              <div className="divide-y divide-bd/60">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-bold font-mono text-navy uppercase mr-2">[{log.action}]</span>
                      <span className="font-semibold text-teal">{log.table_name}</span>
                      <span className="text-muted-foreground ml-2">Record: {log.record_id}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!isLoadingSection && auditLogs.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No audit transactions logged yet for this society.
              </div>
            )}
          </Card>
        )}

        {/* Staff Assignment Modal */}
        {assigningComplaint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
            <Card className="max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-bd/60 pb-3">
                <div>
                  <h3 className="text-base font-bold text-navy">Assign In-House Technician</h3>
                  <p className="text-xs text-muted-foreground">
                    Ticket: <span className="font-mono text-teal font-bold">{assigningComplaint.tracking_id}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAssigningComplaint(null)}
                  className="text-muted-foreground hover:text-navy font-bold"
                >
                  ✕
                </button>
              </div>

              {assignError && (
                <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                  {assignError}
                </div>
              )}

              <form onSubmit={handleAssignSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Select Technician *
                  </label>
                  {eligibleStaff.length > 0 ? (
                    <select
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                    >
                      {eligibleStaff.map((staff) => (
                        <option key={staff.userId} value={staff.userId}>
                          {staff.fullName} ({staff.designation})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                      No staff enrolled in this society yet. Enroll technicians in "Memberships & Staff" tab first.
                    </p>
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-bd/60">
                  <Btn
                    type="button"
                    onClick={() => setAssigningComplaint(null)}
                    className="text-xs py-1.5"
                  >
                    Cancel
                  </Btn>
                  <Btn
                    type="submit"
                    v="p"
                    disabled={isSubmittingAssign || eligibleStaff.length === 0}
                    className="text-xs py-1.5 px-4 bg-teal hover:bg-teal/90"
                  >
                    {isSubmittingAssign ? 'Assigning...' : 'Confirm Assignment'}
                  </Btn>
                </div>
              </form>
            </Card>
          </div>
        )}

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
    </DashboardLayout>
  );
};
