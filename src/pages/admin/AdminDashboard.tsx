// ==============================================================================
// SmartResolve Administrative Console
// Platform governance, membership approval, in-house staff enrollment, assignments,
// society expense tracking, SLA escalation management & tamper-proof audit trails.
// STRICTLY NO VENDOR MODULES.
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
import {
  fetchSocietyExpenses,
  createSocietyExpense,
  reviewSocietyExpense,
  deleteSocietyExpense,
  computeFinancialSummary,
  exportExpensesToCsv,
  downloadExpensesCsvFile,
  getReceiptSignedUrl,
  EXPENSE_CATEGORIES,
  type ExpenseWithRelations,
} from '../../lib/expenseService';
import {
  runSocietySlaAudit,
  fetchSocietyEscalations,
  type EscalationAuditSummary,
} from '../../lib/escalationEngine';
import { fetchSocietyPendingVerifications } from '../../lib/resolutionService';
import type { Department, ComplaintCategory, ExpenseCategory } from '../../types/database';
import type { ComplaintWithRelations } from '../../lib/complaintService';
import { AnnouncementsSection } from './sections/AnnouncementsSection';
import { PollsSection } from './sections/PollsSection';
import { EmergencyContactsSection } from './sections/EmergencyContactsSection';
import { PreventiveMaintenanceSection } from './sections/PreventiveMaintenanceSection';
import { OperationalReportsSection } from './sections/OperationalReportsSection';

const ADMIN_NAV = [
  { label: "Overview", href: "/dashboard/admin", icon: "chart" as const },
  { label: "Memberships & Staff", href: "/dashboard/admin", icon: "user-check" as const },
  { label: "Society Expenses", href: "/dashboard/admin", icon: "file" as const },
  { label: "SLA Escalations", href: "/dashboard/admin", icon: "alert" as const },
  { label: "Announcements", href: "/dashboard/admin", icon: "bell" as const },
  { label: "Community Polls", href: "/dashboard/admin", icon: "check" as const },
  { label: "Emergency Contacts", href: "/dashboard/admin", icon: "alert" as const },
  { label: "Preventive Maint.", href: "/dashboard/admin", icon: "refresh-cw" as const },
  { label: "Operational Reports", href: "/dashboard/admin", icon: "chart" as const },
  { label: "Departments", href: "/admin/departments", icon: "users" as const },
  { label: "Categories", href: "/admin/categories", icon: "filter" as const },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "shield" as const },
  { label: "Settings", href: "/settings/profile", icon: "user" as const },
];

export const AdminDashboard: React.FC = () => {
  const { user, currentSociety, approveMembership, rejectMembership, enrollStaffMember } = useAuth();
  const [activeSection, setActiveSection] = useState<
    | 'overview'
    | 'memberships'
    | 'expenses'
    | 'escalations'
    | 'announcements'
    | 'polls'
    | 'emergency'
    | 'preventive'
    | 'reports'
    | 'departments'
    | 'categories'
    | 'audit'
  >('overview');

  // Action / toast message
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Membership management states
  const [pendingMemberships, setPendingMemberships] = useState<any[]>([]);
  const [staffMemberships, setStaffMemberships] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

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

  // Society Expenses State
  const [expenses, setExpenses] = useState<ExpenseWithRelations[]>([]);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [expenseFilterCategory, setExpenseFilterCategory] = useState<string>('all');
  const [expenseFilterStatus, setExpenseFilterStatus] = useState<string>('all');
  const [showCreateExpenseModal, setShowCreateExpenseModal] = useState(false);
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('general_maintenance');
  const [expAmount, setExpAmount] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expComplaintId, setExpComplaintId] = useState('');
  const [expReceiptFile, setExpReceiptFile] = useState<File | null>(null);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // SLA Escalations State
  const [escalations, setEscalations] = useState<any[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<any[]>([]);
  const [isLoadingEscalations, setIsLoadingEscalations] = useState(false);
  const [isAuditingSla, setIsAuditingSla] = useState(false);
  const [slaAuditSummary, setSlaAuditSummary] = useState<EscalationAuditSummary | null>(null);

  // Load complaints for Overview
  const loadComplaints = async () => {
    if (!currentSociety || !isSupabaseConfigured) return;
    setIsLoadingComplaints(true);
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          *,
          category:complaint_categories!fk_complaints_category_society(id, name),
          building:buildings!fk_complaints_building_society(id, name),
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
        .eq('status', 'active')
        .in('role', ['maintenance_staff', 'supervisor']);

      setStaffMemberships(staffData || []);
    } catch (err: any) {
      console.error('Failed to load memberships:', err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // Load Society Expenses
  const loadExpenses = async () => {
    if (!currentSociety || !isSupabaseConfigured) return;
    setIsLoadingExpenses(true);
    try {
      const data = await fetchSocietyExpenses(currentSociety.id);
      setExpenses(data);
    } catch (err: any) {
      console.error('Failed to load society expenses:', err);
    } finally {
      setIsLoadingExpenses(false);
    }
  };

  // Load SLA Escalations & Pending Verifications
  const loadEscalations = async () => {
    if (!currentSociety || !isSupabaseConfigured) return;
    setIsLoadingEscalations(true);
    try {
      const [escData, verifData] = await Promise.all([
        fetchSocietyEscalations(currentSociety.id),
        fetchSocietyPendingVerifications(currentSociety.id),
      ]);
      setEscalations(escData);
      setPendingVerifications(verifData);
    } catch (err: any) {
      console.error('Failed to load escalations:', err);
    } finally {
      setIsLoadingEscalations(false);
    }
  };

  // Load section-specific data
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
    } else if (activeSection === 'expenses') {
      loadExpenses();
      loadComplaints();
    } else if (activeSection === 'escalations') {
      loadEscalations();
      loadComplaints();
    } else {
      loadSectionData();
    }
  }, [activeSection, currentSociety?.id]);

  // Handle membership approvals
  const handleApprove = async (membershipId: string) => {
    const res = await approveMembership(membershipId);
    if (res.success) {
      setActionMessage('Residency membership approved successfully.');
      await loadMemberships();
    } else {
      setActionMessage(`Approval failed: ${res.error}`);
    }
  };

  const handleReject = async (membershipId: string) => {
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

  // Expense Handlers
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentSociety) return;

    const parsedAmount = parseFloat(expAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setExpenseError('Please enter a valid amount greater than 0.');
      return;
    }
    if (!expDescription.trim() || expDescription.trim().length < 5) {
      setExpenseError('Description must be at least 5 characters.');
      return;
    }

    setIsSubmittingExpense(true);
    setExpenseError(null);

    try {
      await createSocietyExpense({
        societyId: currentSociety.id,
        recordedBy: user.id,
        category: expCategory,
        amount: parsedAmount,
        description: expDescription.trim(),
        expenseDate: expDate,
        complaintId: expComplaintId ? expComplaintId : null,
        receiptFile: expReceiptFile,
      });

      setActionMessage('Society expense record created successfully.');
      setShowCreateExpenseModal(false);
      setExpAmount('');
      setExpDescription('');
      setExpComplaintId('');
      setExpReceiptFile(null);
      await loadExpenses();
    } catch (err: any) {
      setExpenseError(err.message || 'Failed to record expense.');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleReviewExpense = async (expenseId: string, status: 'approved' | 'rejected') => {
    if (!user || !currentSociety) return;
    try {
      await reviewSocietyExpense({
        expenseId,
        societyId: currentSociety.id,
        adminUserId: user.id,
        status,
      });
      setActionMessage(`Expense ${status} successfully.`);
      await loadExpenses();
    } catch (err: any) {
      console.error(`Failed to ${status} expense:`, err);
      setActionMessage(`Failed to update expense status: ${err.message}`);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!currentSociety) return;
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await deleteSocietyExpense(expenseId, currentSociety.id);
      setActionMessage('Expense record removed.');
      await loadExpenses();
    } catch (err: any) {
      console.error('Failed to delete expense:', err);
      setActionMessage(`Failed to delete expense: ${err.message}`);
    }
  };

  const handleViewReceipt = async (filePath: string) => {
    const signedUrl = await getReceiptSignedUrl(filePath);
    if (signedUrl) {
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert('Could not generate secure access link for this receipt.');
    }
  };

  // Filtered Expenses
  const filteredExpenses = expenses.filter((e) => {
    if (expenseFilterCategory !== 'all' && e.category !== expenseFilterCategory) {
      return false;
    }
    if (expenseFilterStatus !== 'all' && e.approval_status !== expenseFilterStatus) {
      return false;
    }
    return true;
  });

  const financialSummary = computeFinancialSummary(expenses);

  const handleExportCsv = () => {
    const csvData = exportExpensesToCsv(filteredExpenses);
    downloadExpensesCsvFile(
      csvData,
      `${currentSociety?.name.replace(/[^a-zA-Z0-9]/g, '_')}_expenses.csv`
    );
  };

  // SLA Audit Handler
  const handleRunSlaAudit = async () => {
    if (!currentSociety) return;
    setIsAuditingSla(true);
    try {
      const summary = await runSocietySlaAudit(currentSociety.id);
      setSlaAuditSummary(summary);
      setActionMessage(
        `SLA evaluation complete: ${summary.overdueComplaints} overdue tickets found, ${summary.newEscalationsTriggered} new escalations triggered.`
      );
      await loadEscalations();
      await loadComplaints();
    } catch (err: any) {
      console.error('SLA audit failed:', err);
      setActionMessage(`SLA check failed: ${err.message}`);
    } finally {
      setIsAuditingSla(false);
    }
  };

  // Status counts
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

        {/* Global Action Banner */}
        {actionMessage && (
          <div className="rounded-xl border border-teal/30 bg-teal/10 p-3.5 text-xs text-teal font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon n="check" s={16} c="shrink-0 text-teal" />
              <span>{actionMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-teal/70 hover:text-teal text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Console Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-bd/60 pb-3">
          {(
            [
              ['overview', 'Complaints Overview'],
              ['memberships', 'Memberships & Staff'],
              ['expenses', 'Society Expenses'],
              ['escalations', 'SLA Escalations'],
              ['announcements', 'Announcements'],
              ['polls', 'Community Polls'],
              ['emergency', 'Emergency Contacts'],
              ['preventive', 'Preventive Maint.'],
              ['reports', 'Operational Reports'],
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
                  ? 'bg-teal text-white shadow-sm'
                  : 'bg-soft/70 text-muted-foreground hover:bg-soft hover:text-navy'
              }`}
            >
              {label}
              {sec === 'expenses' && financialSummary.pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 text-white px-1.5 py-0.2 text-[10px]">
                  {financialSummary.pendingCount}
                </span>
              )}
              {sec === 'escalations' && overdueCount > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500 text-white px-1.5 py-0.2 text-[10px]">
                  {overdueCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 1. OVERVIEW SECTION */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Card className="p-4 shadow-sm">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Total
                </div>
                <div className="mt-2 text-2xl font-bold text-navy">{totalCount}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Society complaints</div>
              </Card>

              <Card className="p-4 shadow-sm">
                <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                  Unassigned
                </div>
                <div className="mt-2 text-2xl font-bold text-amber-600">{unassignedCount}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Need staff allocation</div>
              </Card>

              <Card className="p-4 shadow-sm">
                <div className="text-xs font-bold text-brand uppercase tracking-wider">
                  In Progress
                </div>
                <div className="mt-2 text-2xl font-bold text-brand">{inProgressCount}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Active repairs</div>
              </Card>

              <Card className="p-4 shadow-sm">
                <div className="text-xs font-bold text-red-600 uppercase tracking-wider">
                  SLA Overdue
                </div>
                <div className="mt-2 text-2xl font-bold text-red-600">{overdueCount}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Breached deadlines</div>
              </Card>

              <Card className="p-4 shadow-sm">
                <div className="text-xs font-bold text-teal uppercase tracking-wider">
                  Pending Review
                </div>
                <div className="mt-2 text-2xl font-bold text-teal">{pendingVerifCount}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Awaiting resident check</div>
              </Card>
            </div>

            {/* Complaints Register Table with Assignment Actions */}
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between border-b border-bd/60 pb-4 mb-4 gap-2">
                <div>
                  <h2 className="text-base font-bold text-navy">Society Complaints Register</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tenant-isolated PostgreSQL records across all society departments
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
                    <div key={i} className="h-14 bg-soft rounded-lg animate-pulse" />
                  ))}
                </div>
              )}

              {!isLoadingComplaints && complaints.length > 0 && (
                <div className="divide-y divide-bd/60">
                  {complaints.map((c) => (
                    <div
                      key={c.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
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
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{c.category?.name || 'Category'}</span>
                          {c.building?.name && (
                            <>
                              <span>•</span>
                              <span>
                                {c.building.name}
                                {c.flat?.flat_number ? ` / ${c.flat.flat_number}` : ''}
                              </span>
                            </>
                          )}
                          <span>•</span>
                          <span>{new Date(c.submitted_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {c.status === 'submitted' && (
                          <Btn
                            v="p"
                            onClick={() => {
                              setAssigningComplaint(c);
                              setAssignError(null);
                            }}
                            className="text-xs py-1.5 px-3 bg-teal hover:bg-teal/90"
                          >
                            <Icon n="user-check" s={14} />
                            <span>Assign Tech</span>
                          </Btn>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isLoadingComplaints && complaints.length === 0 && (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No complaints filed in this society yet.
                </div>
              )}
            </Card>
          </div>
        )}

        {/* 2. MEMBERSHIPS & STAFF SECTION */}
        {activeSection === 'memberships' && (
          <div className="space-y-6">
            {/* Pending Resident Memberships */}
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between border-b border-bd/60 pb-4 mb-4 gap-2">
                <div>
                  <h2 className="text-base font-bold text-navy">Pending Residency Applications</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Review and verify incoming flat ownership and residency requests
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
                    Authorized society maintenance personnel (strictly no vendor accounts)
                  </p>
                </div>
                <Btn
                  v="p"
                  onClick={() => setShowEnrollModal(true)}
                  className="py-1.5 px-3 text-xs bg-navy text-white hover:bg-navy/90 flex items-center gap-1.5"
                >
                  <Icon n="user-check" s={14} />
                  <span>Enroll In-House Staff</span>
                </Btn>
              </div>

              {staffMemberships.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No in-house maintenance technicians or supervisors enrolled yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {staffMemberships.map((staff) => (
                    <div
                      key={staff.id}
                      className="rounded-lg border border-bd p-3.5 bg-soft/40 space-y-1.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-navy">
                          {staff.profiles?.full_name || 'Staff Member'}
                        </span>
                        <Pill tone={staff.role === 'supervisor' ? 't' : 'n'}>
                          {staff.role === 'supervisor' ? 'Supervisor' : 'Technician'}
                        </Pill>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {staff.staff_designation || 'Maintenance Operator'}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate font-mono">
                        {staff.profiles?.email}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* 3. SOCIETY EXPENSES SECTION */}
        {activeSection === 'expenses' && (
          <div className="space-y-6">
            {/* Financial Overview KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="p-4 shadow-sm">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Total Approved
                </div>
                <div className="mt-2 text-2xl font-bold text-teal">
                  ₹{financialSummary.totalApprovedAmount.toLocaleString('en-IN')}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {financialSummary.approvedCount} approved expenditures
                </div>
              </Card>

              <Card className="p-4 shadow-sm">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Current Month
                </div>
                <div className="mt-2 text-2xl font-bold text-navy">
                  ₹{financialSummary.currentMonthApprovedAmount.toLocaleString('en-IN')}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Monthly operational costs
                </div>
              </Card>

              <Card className="p-4 shadow-sm">
                <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                  Pending Review
                </div>
                <div className="mt-2 text-2xl font-bold text-amber-600">
                  ₹{financialSummary.totalPendingAmount.toLocaleString('en-IN')}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {financialSummary.pendingCount} awaiting approval
                </div>
              </Card>

              <Card className="p-4 shadow-sm">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Total Records
                </div>
                <div className="mt-2 text-2xl font-bold text-navy">{expenses.length}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Logged society expenses
                </div>
              </Card>
            </div>

            {/* Category Breakdown Chips */}
            <Card className="p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-navy mb-2.5">
                Approved Expenditure by Operational Category
              </div>
              <div className="flex flex-wrap gap-2">
                {EXPENSE_CATEGORIES.map((cat) => {
                  const amt = financialSummary.categoryBreakdown[cat.value] || 0;
                  return (
                    <div
                      key={cat.value}
                      className="rounded-lg border border-bd/60 bg-soft/40 px-3 py-1.5 text-xs flex items-center gap-2"
                    >
                      <span className="text-muted-foreground">{cat.label}:</span>
                      <strong className="text-navy font-bold">
                        ₹{amt.toLocaleString('en-IN')}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Expense Management Table */}
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between border-b border-bd/60 pb-4 mb-4 gap-3">
                <div>
                  <h2 className="text-base font-bold text-navy">Society Expense Register</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Direct society procurement & repairs • Private receipt storage • Strictly NO VENDORS
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Category Filter */}
                  <select
                    value={expenseFilterCategory}
                    onChange={(e) => setExpenseFilterCategory(e.target.value)}
                    className="rounded-lg border border-bd bg-card px-2.5 py-1.5 text-xs text-navy focus:outline-none"
                  >
                    <option value="all">All Categories</option>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>

                  {/* Status Filter */}
                  <select
                    value={expenseFilterStatus}
                    onChange={(e) => setExpenseFilterStatus(e.target.value)}
                    className="rounded-lg border border-bd bg-card px-2.5 py-1.5 text-xs text-navy focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  <Btn
                    onClick={handleExportCsv}
                    disabled={filteredExpenses.length === 0}
                    className="py-1.5 px-3 text-xs flex items-center gap-1.5"
                  >
                    <Icon n="download" s={14} />
                    <span>Export CSV</span>
                  </Btn>

                  <Btn
                    v="p"
                    onClick={() => {
                      setExpenseError(null);
                      setShowCreateExpenseModal(true);
                    }}
                    className="py-1.5 px-3 text-xs bg-teal hover:bg-teal/90 flex items-center gap-1.5"
                  >
                    <Icon n="upload" s={14} />
                    <span>Record Expense</span>
                  </Btn>
                </div>
              </div>

              {isLoadingExpenses && (
                <div className="space-y-3 py-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-soft rounded-lg animate-pulse" />
                  ))}
                </div>
              )}

              {!isLoadingExpenses && filteredExpenses.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-bd/60 text-muted-foreground font-semibold uppercase text-[10px]">
                        <th className="py-2.5 px-2">Date</th>
                        <th className="py-2.5 px-2">Category</th>
                        <th className="py-2.5 px-2">Description</th>
                        <th className="py-2.5 px-2">Amount</th>
                        <th className="py-2.5 px-2">Ticket #</th>
                        <th className="py-2.5 px-2">Status</th>
                        <th className="py-2.5 px-2">Receipt</th>
                        <th className="py-2.5 px-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bd/40">
                      {filteredExpenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-soft/30 transition">
                          <td className="py-3 px-2 font-mono whitespace-nowrap">
                            {exp.expense_date}
                          </td>
                          <td className="py-3 px-2 capitalize font-medium text-navy">
                            {exp.category.replace(/_/g, ' ')}
                          </td>
                          <td className="py-3 px-2 max-w-xs truncate text-muted-foreground">
                            {exp.description}
                          </td>
                          <td className="py-3 px-2 font-bold text-navy whitespace-nowrap">
                            ₹{Number(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-2 font-mono text-teal">
                            {exp.complaint?.tracking_id || '—'}
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                                exp.approval_status === 'approved'
                                  ? 'bg-teal/15 text-teal'
                                  : exp.approval_status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {exp.approval_status}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            {exp.receipts && exp.receipts.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleViewReceipt(exp.receipts![0].file_path)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal hover:underline"
                              >
                                <Icon n="paperclip" s={12} />
                                <span>Receipt ({exp.receipts.length})</span>
                              </button>
                            ) : (
                              <span className="text-muted-foreground/60 text-[11px]">None</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {exp.approval_status === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleReviewExpense(exp.id, 'approved')}
                                    className="rounded bg-teal/15 px-2 py-1 text-[11px] font-semibold text-teal hover:bg-teal/25 transition"
                                    title="Approve expense"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReviewExpense(exp.id, 'rejected')}
                                    className="rounded bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-200 transition"
                                    title="Reject expense"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteExpense(exp.id)}
                                className="text-muted-foreground hover:text-red-600 p-1"
                                title="Delete record"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!isLoadingExpenses && filteredExpenses.length === 0 && (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No society expenses found matching your filter criteria.
                </div>
              )}
            </Card>
          </div>
        )}

        {/* 4. SLA ESCALATIONS SECTION */}
        {activeSection === 'escalations' && (
          <div className="space-y-6">
            {/* SLA Escalation Audit Trigger Header */}
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between border-b border-bd/60 pb-4 mb-4 gap-3">
                <div>
                  <h2 className="text-base font-bold text-navy">SLA Tracking & Automated Escalations</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Evaluates unresolved complaints against category SLA targets and priority deadlines
                  </p>
                </div>
                <Btn
                  v="p"
                  onClick={handleRunSlaAudit}
                  disabled={isAuditingSla}
                  className="py-1.5 px-4 text-xs bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 shadow-sm"
                >
                  <Icon n="alert" s={14} className={isAuditingSla ? "animate-spin" : ""} />
                  <span>{isAuditingSla ? 'Evaluating SLA Targets...' : 'Run SLA Escalation Check'}</span>
                </Btn>
              </div>

              {/* SLA Audit Summary Banner if executed */}
              {slaAuditSummary && (
                <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 mb-4 text-xs space-y-1.5 text-red-900">
                  <div className="font-bold flex items-center gap-2">
                    <Icon n="check" s={16} c="text-red-600" />
                    <span>SLA Evaluation Results ({new Date(slaAuditSummary.evaluatedAt).toLocaleTimeString()})</span>
                  </div>
                  <p className="leading-relaxed">
                    Evaluated <strong>{slaAuditSummary.totalActiveComplaints}</strong> active complaints in society:
                    found <strong>{slaAuditSummary.overdueComplaints}</strong> overdue items.
                    Triggered <strong>{slaAuditSummary.newEscalationsTriggered}</strong> new multi-tier escalations (
                    <strong>{slaAuditSummary.alreadyEscalatedCount}</strong> items were already recorded idempotently).
                  </p>
                </div>
              )}

              {/* Escalated Incidents Register */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-navy">
                  Active Escalation Events ({escalations.length})
                </h3>

                {isLoadingEscalations && (
                  <div className="space-y-2 py-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 bg-soft rounded-lg animate-pulse" />
                    ))}
                  </div>
                )}

                {!isLoadingEscalations && escalations.length > 0 && (
                  <div className="divide-y divide-bd/60">
                    {escalations.map((esc) => (
                      <div key={esc.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-teal">
                              #{esc.complaint?.tracking_id || esc.complaint_id.slice(0, 8)}
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                                esc.escalation_level === 3
                                  ? 'bg-red-600 text-white'
                                  : esc.escalation_level === 2
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              Tier {esc.escalation_level} Escalation
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                              Trigger: {esc.trigger_type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <h4 className="font-bold text-navy">{esc.complaint?.title || 'Maintenance Complaint'}</h4>
                          <p className="text-muted-foreground leading-relaxed">{esc.reason}</p>
                          <div className="text-[10px] text-muted-foreground">
                            Notified Roles: <strong>{esc.notified_roles?.join(', ')}</strong> • Escalated At: {new Date(esc.escalated_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!isLoadingEscalations && escalations.length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No active SLA escalation events. All maintenance complaints are currently within resolution deadlines!
                  </div>
                )}
              </div>
            </Card>

            {/* Pending Resident Resolution Verifications */}
            <Card className="p-6">
              <div className="border-b border-bd/60 pb-3 mb-4">
                <h3 className="text-sm font-bold text-navy">
                  Complaints Awaiting Resident Verification ({pendingVerifications.length})
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Repairs marked resolved by technicians, awaiting resident closure sign-off or reopen review
                </p>
              </div>

              {pendingVerifications.length > 0 ? (
                <div className="divide-y divide-bd/60">
                  {pendingVerifications.map((pv) => (
                    <div key={pv.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-teal">#{pv.tracking_id}</span>
                          <span className="font-bold text-navy">{pv.title}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Resident: {pv.citizen?.full_name || 'Resident'} ({pv.citizen?.phone_number || 'N/A'}) • Category: {pv.category?.name || 'General'}
                        </div>
                        {pv.resolution_remarks && (
                          <p className="text-muted-foreground italic mt-1 bg-soft/50 p-2 rounded">
                            Technician Notes: "{pv.resolution_remarks}"
                          </p>
                        )}
                      </div>
                      <Pill tone="t">Resolved • Awaiting Citizen</Pill>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No complaints pending resident verification at this time.
                </div>
              )}
            </Card>
          </div>
        )}

        {/* 5. DEPARTMENTS SECTION */}
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

        {/* 6. CATEGORIES SECTION */}
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
                    <p className="text-xs text-muted-foreground">{cat.description || 'Category'}</p>
                  </div>
                ))}
              </div>
            )}

            {!isLoadingSection && categories.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No complaint categories configured yet for this society.
              </div>
            )}
          </Card>
        )}

        {/* 7. AUDIT LOGS SECTION */}
        {activeSection === 'audit' && (
          <Card className="p-6">
            <div className="flex items-center justify-between border-b border-bd/60 pb-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-navy">Platform Audit Trail</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tamper-proof, immutable logs of society events and record modifications
                </p>
              </div>
              <Pill tone="t">Immutable Trail</Pill>
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
                  <div key={log.id} className="py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-navy capitalize">{log.action}</span> on{' '}
                      <span className="font-mono text-teal">{log.table_name}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoadingSection && auditLogs.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No audit entries recorded for this society.
              </div>
            )}
          </Card>
        )}

        {/* 8. ANNOUNCEMENTS SECTION */}
        {activeSection === 'announcements' && currentSociety && (
          <AnnouncementsSection
            societyId={currentSociety.id}
            authorId={user?.id || ''}
          />
        )}

        {/* 9. COMMUNITY POLLS SECTION */}
        {activeSection === 'polls' && currentSociety && (
          <PollsSection
            societyId={currentSociety.id}
            userId={user?.id || ''}
          />
        )}

        {/* 10. EMERGENCY CONTACTS SECTION */}
        {activeSection === 'emergency' && currentSociety && (
          <EmergencyContactsSection
            societyId={currentSociety.id}
          />
        )}

        {/* 11. PREVENTIVE MAINTENANCE SECTION */}
        {activeSection === 'preventive' && currentSociety && (
          <PreventiveMaintenanceSection
            societyId={currentSociety.id}
            departments={departments}
            userId={user?.id || ''}
          />
        )}

        {/* 12. OPERATIONAL REPORTS SECTION */}
        {activeSection === 'reports' && currentSociety && (
          <OperationalReportsSection
            societyId={currentSociety.id}
          />
        )}

        {/* MODAL: Record Society Expense */}
        {showCreateExpenseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="relative w-full max-w-lg rounded-2xl border border-bd bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-bd/60 pb-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-navy">Record Society Expense</h3>
                  <p className="text-xs text-muted-foreground">
                    Direct procurement and maintenance accounting (Strictly NO VENDORS)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateExpenseModal(false)}
                  className="text-muted-foreground hover:text-navy text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {expenseError && (
                <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200 mb-3">
                  {expenseError}
                </div>
              )}

              <form onSubmit={handleCreateExpense} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Expense Category *
                  </label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value as any)}
                    className="w-full rounded-lg border border-bd bg-background px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                      Amount (INR) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-bd bg-background px-3 py-2 text-xs font-mono text-navy focus:border-teal focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                      Expense Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      className="w-full rounded-lg border border-bd bg-background px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Description * (min 5 characters)
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={expDescription}
                    onChange={(e) => setExpDescription(e.target.value)}
                    placeholder="Provide details on materials purchased or maintenance servicing performed..."
                    className="w-full rounded-lg border border-bd bg-background p-3 text-xs text-navy focus:border-teal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Associated Maintenance Ticket (Optional)
                  </label>
                  <select
                    value={expComplaintId}
                    onChange={(e) => setExpComplaintId(e.target.value)}
                    className="w-full rounded-lg border border-bd bg-background px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  >
                    <option value="">None (General Society Expenditure)</option>
                    {complaints.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.tracking_id} — {c.title.slice(0, 45)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Attach Invoice / Receipt (Optional, max 10MB)
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) => setExpReceiptFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal/10 file:text-teal hover:file:bg-teal/20"
                  />
                  <small className="block text-[10px] text-muted-foreground mt-0.5">
                    Saved to private bucket <code className="font-mono">expense-receipts</code>. Visible only to society administrators.
                  </small>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-bd/60">
                  <Btn
                    type="button"
                    onClick={() => setShowCreateExpenseModal(false)}
                    className="py-2 text-xs"
                  >
                    Cancel
                  </Btn>
                  <Btn
                    type="submit"
                    v="p"
                    disabled={isSubmittingExpense}
                    className="py-2 text-xs bg-teal hover:bg-teal/90"
                  >
                    {isSubmittingExpense ? 'Recording...' : 'Submit Expense'}
                  </Btn>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Assign Complaint Staff */}
        {assigningComplaint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-bd/60 pb-3">
                <div>
                  <h3 className="text-base font-bold text-navy">Assign In-House Staff</h3>
                  <p className="text-xs text-muted-foreground">
                    Ticket #{assigningComplaint.tracking_id} • {assigningComplaint.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAssigningComplaint(null)}
                  className="text-muted-foreground hover:text-navy"
                >
                  ✕
                </button>
              </div>

              {assignError && (
                <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                  {assignError}
                </div>
              )}

              <form onSubmit={handleAssignSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                    Select In-House Technician *
                  </label>
                  {eligibleStaff.length === 0 ? (
                    <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
                      No in-house technicians are currently enrolled in this society. Please enroll maintenance staff first under the Memberships tab.
                    </div>
                  ) : (
                    <select
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                    >
                      {eligibleStaff.map((st) => (
                        <option key={st.userId} value={st.userId}>
                          {st.fullName} ({st.designation}) — {st.role}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Btn
                    type="button"
                    onClick={() => setAssigningComplaint(null)}
                    className="py-2 text-xs"
                  >
                    Cancel
                  </Btn>
                  <Btn
                    type="submit"
                    v="p"
                    disabled={isSubmittingAssign || eligibleStaff.length === 0}
                    className="py-2 text-xs bg-teal hover:bg-teal/90"
                  >
                    {isSubmittingAssign ? 'Assigning...' : 'Confirm Assignment'}
                  </Btn>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* MODAL: Enroll In-House Staff */}
        {showEnrollModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-bd/60 pb-3">
                <div>
                  <h3 className="text-base font-bold text-navy">Enroll In-House Maintenance Staff</h3>
                  <p className="text-xs text-muted-foreground">
                    Add authorized technician or supervisor to society roster
                  </p>
                </div>
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
