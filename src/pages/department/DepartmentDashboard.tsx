// ==============================================================================
// SmartResolve Department Oversight: Supervisor Dashboard
// Workload inspection, staff assignment, reassignment, and routing corrections
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
  reassignComplaint,
  correctComplaintRouting,
  type EligibleStaff,
} from '../../lib/maintenanceService';
import type { Department, ComplaintCategory } from '../../types/database';
import type { ComplaintWithRelations } from '../../lib/complaintService';

const DEPT_NAV = [
  { label: "Department Feed", href: "/dashboard/department", icon: "users" as const },
  { label: "Staff Queue", href: "/dashboard/officer", icon: "file" as const },
  { label: "Settings", href: "/settings/profile", icon: "user" as const },
];

export const DepartmentDashboard: React.FC = () => {
  const { user, currentSociety } = useAuth();

  const [complaints, setComplaints] = useState<ComplaintWithRelations[]>([]);
  const [eligibleStaff, setEligibleStaff] = useState<EligibleStaff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<ComplaintCategory[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Assignment Modal
  const [assigningComplaint, setAssigningComplaint] = useState<ComplaintWithRelations | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [targetDeadline, setTargetDeadline] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Reassignment Modal
  const [reassigningComplaint, setReassigningComplaint] = useState<ComplaintWithRelations | null>(null);
  const [reassignStaffId, setReassignStaffId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  // Route Correction Modal
  const [routingComplaint, setRoutingComplaint] = useState<ComplaintWithRelations | null>(null);
  const [correctDeptId, setCorrectDeptId] = useState('');
  const [correctCatId, setCorrectCatId] = useState('');
  const [isSubmittingRoute, setIsSubmittingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const loadData = async () => {
    if (!currentSociety || !isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Load society complaints with relations
      const { data: compData, error: compErr } = await supabase
        .from('complaints')
        .select(`
          *,
          category:complaint_categories(id, name, department_id),
          building:buildings(id, name),
          flat:flats(id, flat_number)
        `)
        .eq('society_id', currentSociety.id)
        .order('submitted_at', { ascending: false });

      if (compErr) throw compErr;
      setComplaints((compData || []) as ComplaintWithRelations[]);

      // 2. Load eligible technicians and supervisors
      const staffList = await fetchEligibleSocietyStaff(currentSociety.id);
      setEligibleStaff(staffList);
      if (staffList.length > 0) {
        setSelectedStaffId(staffList[0].userId);
        setReassignStaffId(staffList[0].userId);
      }

      // 3. Load departments and categories for routing
      const [deptRes, catRes] = await Promise.all([
        supabase.from('departments').select('*').eq('society_id', currentSociety.id),
        supabase.from('complaint_categories').select('*').eq('society_id', currentSociety.id),
      ]);

      setDepartments((deptRes.data || []) as Department[]);
      setCategories((catRes.data || []) as ComplaintCategory[]);
    } catch (err: any) {
      console.error('Failed to load supervisor dashboard data:', err);
      setError(err.message || 'Could not load department operational data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentSociety?.id]);

  // Handle Staff Assignment
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningComplaint || !user || !currentSociety) return;

    if (!selectedStaffId) {
      setAssignError('Please select a maintenance technician.');
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
        targetDeadline: targetDeadline || null,
        complaintTitle: assigningComplaint.title,
        complaintDescription: assigningComplaint.description,
      });

      setActionMessage(`Complaint ${assigningComplaint.tracking_id} successfully assigned to staff.`);
      setAssigningComplaint(null);
      setTargetDeadline('');
      await loadData();
    } catch (err: any) {
      setAssignError(err.message || 'Failed to assign complaint.');
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  // Handle Reassignment
  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassigningComplaint || !user || !currentSociety) return;

    if (!reassignReason.trim() || reassignReason.trim().length < 5) {
      setReassignError('A reason (minimum 5 characters) is required for reassignment.');
      return;
    }

    setReassignError(null);
    setIsSubmittingReassign(true);

    try {
      // Find current active assignment
      const { data: currentAssignment } = await supabase
        .from('complaint_assignments')
        .select('id')
        .eq('complaint_id', reassigningComplaint.id)
        .in('status', ['assigned', 'accepted', 'in_progress'])
        .single();

      if (!currentAssignment) {
        throw new Error('No active assignment found to reassign.');
      }

      await reassignComplaint({
        societyId: currentSociety.id,
        complaintId: reassigningComplaint.id,
        currentAssignmentId: currentAssignment.id,
        newStaffUserId: reassignStaffId,
        reassignedByUserId: user.id,
        reason: reassignReason.trim(),
        departmentId: reassigningComplaint.department_id,
      });

      setActionMessage(`Complaint ${reassigningComplaint.tracking_id} successfully reassigned.`);
      setReassigningComplaint(null);
      setReassignReason('');
      await loadData();
    } catch (err: any) {
      setReassignError(err.message || 'Failed to reassign work.');
    } finally {
      setIsSubmittingReassign(false);
    }
  };

  // Handle Routing Correction
  const handleRoutingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routingComplaint || !currentSociety) return;

    if (!correctDeptId || !correctCatId) {
      setRouteError('Please select both department and category.');
      return;
    }

    setRouteError(null);
    setIsSubmittingRoute(true);

    try {
      await correctComplaintRouting({
        societyId: currentSociety.id,
        complaintId: routingComplaint.id,
        newCategoryId: correctCatId,
        newDepartmentId: correctDeptId,
      });

      setActionMessage(`Routing corrected for ticket ${routingComplaint.tracking_id}.`);
      setRoutingComplaint(null);
      await loadData();
    } catch (err: any) {
      setRouteError(err.message || 'Routing correction rejected.');
    } finally {
      setIsSubmittingRoute(false);
    }
  };

  // Open Routing Modal with initial values
  const openRoutingModal = (comp: ComplaintWithRelations) => {
    setRoutingComplaint(comp);
    setCorrectDeptId(comp.department_id);
    setCorrectCatId(comp.category_id);
    setRouteError(null);
  };

  // Available categories filtered by chosen department in modal
  const modalCategories = correctDeptId
    ? categories.filter((c) => c.department_id === correctDeptId)
    : categories;

  // Counts
  const totalCount = complaints.length;
  const unassignedCount = complaints.filter((c) => c.status === 'submitted').length;
  const inProgressCount = complaints.filter((c) => ['assigned', 'in_progress'].includes(c.status)).length;
  const pendingVerifCount = complaints.filter((c) => c.status === 'resolved').length;
  const overdueCount = complaints.filter(
    (c) =>
      !['resolved', 'closed', 'rejected'].includes(c.status) &&
      c.sla_target_at &&
      new Date(c.sla_target_at).getTime() < Date.now()
  ).length;

  const getStatusPillTone = (status: string): 'n' | 'h' | 't' | 'w' => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return 't';
      case 'in_progress':
      case 'assigned':
        return 'n';
      case 'rejected':
      case 'reopened':
        return 'h';
      default:
        return 'w';
    }
  };

  return (
    <DashboardLayout
      roleTitle="Department Oversight"
      roleBadge="Supervisor"
      navItems={DEPT_NAV}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">Department Operations & Triage</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review departmental workload, assign in-house staff, and correct issue routing for {currentSociety?.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              title="Refresh feed"
              className="rounded-lg border border-bd bg-card p-2 text-muted-foreground hover:text-navy hover:border-teal transition disabled:opacity-50"
            >
              <Icon n="refresh-cw" s={16} c={isLoading ? "animate-spin text-teal" : ""} />
            </button>
            <Pill tone="t">Operational Oversight</Pill>
          </div>
        </div>

        {/* Action message */}
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

        {/* Workload Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total
            </div>
            <div className="mt-2 text-2xl font-bold text-navy">
              {isLoading ? '...' : totalCount}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Society register</div>
          </Card>
          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Unassigned
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600">
              {isLoading ? '...' : unassignedCount}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Awaiting technician</div>
          </Card>
          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              In Progress
            </div>
            <div className="mt-2 text-2xl font-bold text-brand">
              {isLoading ? '...' : inProgressCount}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Active repairs</div>
          </Card>
          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-red-600 uppercase tracking-wider">
              SLA Overdue
            </div>
            <div className="mt-2 text-2xl font-bold text-red-600">
              {isLoading ? '...' : overdueCount}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Breached SLA targets</div>
          </Card>
          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-teal uppercase tracking-wider">
              Pending Review
            </div>
            <div className="mt-2 text-2xl font-bold text-teal">
              {isLoading ? '...' : pendingVerifCount}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Fixed • Awaiting resident</div>
          </Card>
        </div>

        {/* Complaints Register Table */}
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bd/60 pb-4 mb-6">
            <div>
              <h2 className="text-base font-bold text-navy">Operational Complaint Feed</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assign technicians, reassign workload, and correct department routing
              </p>
            </div>
            <Pill tone="n">Live PostgreSQL Sync</Pill>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200 mb-4">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="space-y-3 py-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-soft animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && complaints.length > 0 && (
            <div className="space-y-3">
              {complaints.map((comp) => (
                <div
                  key={comp.id}
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-bd bg-soft/30 hover:bg-soft/60 p-4 transition"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-teal">
                        {comp.tracking_id}
                      </span>
                      <Pill tone={getStatusPillTone(comp.status)}>
                        {comp.status.replace(/_/g, ' ').toUpperCase()}
                      </Pill>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Priority: {comp.priority}
                      </span>
                      {comp.is_anonymous && (
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                          Anonymous
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-navy">{comp.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {comp.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1">
                      <span>Category: <strong>{comp.category?.name || 'General'}</strong></span>
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

                  {/* Supervisor Triage Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-bd/60">
                    {/* Assign Action */}
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
                        <span>Assign Staff</span>
                      </Btn>
                    )}

                    {/* Reassign Action */}
                    {['assigned', 'in_progress'].includes(comp.status) && (
                      <Btn
                        onClick={() => {
                          setReassigningComplaint(comp);
                          setReassignError(null);
                        }}
                        className="text-xs py-1.5 px-3"
                      >
                        <Icon n="refresh-cw" s={12} />
                        <span>Reassign</span>
                      </Btn>
                    )}

                    {/* Correct Routing */}
                    <Btn
                      onClick={() => openRoutingModal(comp)}
                      className="text-xs py-1.5 px-3"
                    >
                      <Icon n="filter" s={12} />
                      <span>Correct Routing</span>
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && complaints.length === 0 && (
            <div className="py-12 text-center max-w-md mx-auto">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-soft text-brand mb-4 shadow-sm">
                <Icon n="users" s={28} />
              </div>
              <h3 className="text-base font-bold text-navy">No complaint tickets recorded</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                When residents submit issues in {currentSociety?.name}, they will appear here for staff assignment and operational oversight.
              </p>
            </div>
          )}
        </Card>

        {/* Assign Modal */}
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
                      No eligible staff enrolled in this society yet. Enroll maintenance staff from the Admin console first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Target SLA Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={targetDeadline}
                    onChange={(e) => setTargetDeadline(e.target.value)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  />
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

        {/* Reassign Modal */}
        {reassigningComplaint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
            <Card className="max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-bd/60 pb-3">
                <div>
                  <h3 className="text-base font-bold text-navy">Reassign Work to Another Worker</h3>
                  <p className="text-xs text-muted-foreground">
                    Ticket: <span className="font-mono text-teal font-bold">{reassigningComplaint.tracking_id}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReassigningComplaint(null)}
                  className="text-muted-foreground hover:text-navy font-bold"
                >
                  ✕
                </button>
              </div>

              {reassignError && (
                <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                  {reassignError}
                </div>
              )}

              <form onSubmit={handleReassignSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    New Assignee *
                  </label>
                  <select
                    value={reassignStaffId}
                    onChange={(e) => setReassignStaffId(e.target.value)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  >
                    {eligibleStaff.map((staff) => (
                      <option key={staff.userId} value={staff.userId}>
                        {staff.fullName} ({staff.designation})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Justification / Reason for Reassignment *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    placeholder="e.g. Prior technician on leave; urgent electrical specialization required (min 5 chars)..."
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-bd/60">
                  <Btn
                    type="button"
                    onClick={() => setReassigningComplaint(null)}
                    className="text-xs py-1.5"
                  >
                    Cancel
                  </Btn>
                  <Btn
                    type="submit"
                    v="p"
                    disabled={isSubmittingReassign}
                    className="text-xs py-1.5 px-4"
                  >
                    {isSubmittingReassign ? 'Reassigning...' : 'Confirm Reassignment'}
                  </Btn>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Route Correction Modal */}
        {routingComplaint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
            <Card className="max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-bd/60 pb-3">
                <div>
                  <h3 className="text-base font-bold text-navy">Correct Department Routing</h3>
                  <p className="text-xs text-muted-foreground">
                    Ticket: <span className="font-mono text-teal font-bold">{routingComplaint.tracking_id}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRoutingComplaint(null)}
                  className="text-muted-foreground hover:text-navy font-bold"
                >
                  ✕
                </button>
              </div>

              {routeError && (
                <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                  {routeError}
                </div>
              )}

              <form onSubmit={handleRoutingSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Department *
                  </label>
                  <select
                    value={correctDeptId}
                    onChange={(e) => {
                      const newDeptId = e.target.value;
                      setCorrectDeptId(newDeptId);
                      const matchingCats = categories.filter((c) => c.department_id === newDeptId);
                      if (matchingCats.length > 0) {
                        setCorrectCatId(matchingCats[0].id);
                      }
                    }}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Category (Must belong to Department) *
                  </label>
                  <select
                    value={correctCatId}
                    onChange={(e) => setCorrectCatId(e.target.value)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  >
                    {modalCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-bd/60">
                  <Btn
                    type="button"
                    onClick={() => setRoutingComplaint(null)}
                    className="text-xs py-1.5"
                  >
                    Cancel
                  </Btn>
                  <Btn
                    type="submit"
                    v="p"
                    disabled={isSubmittingRoute}
                    className="text-xs py-1.5 px-4"
                  >
                    {isSubmittingRoute ? 'Updating Routing...' : 'Save Routing'}
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
