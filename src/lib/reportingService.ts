// ==============================================================================
// SmartResolve Operational Reporting Service
// Performance Analytics, SLA Compliance, Preventive Compliance & RFC-4180 CSV Exports
// Strictly scoped to authorized society boundaries — NO VENDOR DATA
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { fetchSocietyExpenses, computeFinancialSummary, type ExpenseFinancialSummary } from './expenseService';
import { fetchPreventiveSchedules, fetchMaintenanceRecords } from './preventiveService';

export interface OperationalReportData {
  society_id: string;
  generated_at: string;
  period: {
    start_date?: string;
    end_date?: string;
  };
  complaints: {
    total: number;
    submitted: number;
    in_progress: number;
    resolved: number;
    closed: number;
    reopened: number;
    avg_turnaround_hours: number;
    sla_compliance_rate_percent: number;
    sla_compliant_count: number;
    sla_breached_count: number;
    by_category: Record<string, number>;
    by_department: Record<string, number>;
    by_priority: Record<string, number>;
  };
  escalations: {
    total: number;
    level_1: number;
    level_2: number;
    level_3: number;
  };
  staff_performance: Array<{
    staff_id: string;
    staff_name: string;
    designation: string;
    assigned_count: number;
    completed_count: number;
    active_count: number;
  }>;
  preventive_maintenance: {
    total_schedules: number;
    on_schedule: number;
    overdue: number;
    total_inspections: number;
    satisfactory_count: number;
    defect_count: number;
    compliance_rate_percent: number;
  };
  financial_summary: ExpenseFinancialSummary;
}

/**
 * Generate a comprehensive operational report for a society
 */
export async function generateOperationalReport(
  societyId: string,
  startDate?: string,
  endDate?: string
): Promise<{ data: OperationalReportData | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    // Graceful unconfigured fallback
    return {
      data: {
        society_id: societyId,
        generated_at: new Date().toISOString(),
        period: { start_date: startDate, end_date: endDate },
        complaints: {
          total: 0,
          submitted: 0,
          in_progress: 0,
          resolved: 0,
          closed: 0,
          reopened: 0,
          avg_turnaround_hours: 0,
          sla_compliance_rate_percent: 100,
          sla_compliant_count: 0,
          sla_breached_count: 0,
          by_category: {},
          by_department: {},
          by_priority: {},
        },
        escalations: { total: 0, level_1: 0, level_2: 0, level_3: 0 },
        staff_performance: [],
        preventive_maintenance: {
          total_schedules: 0,
          on_schedule: 0,
          overdue: 0,
          total_inspections: 0,
          satisfactory_count: 0,
          defect_count: 0,
          compliance_rate_percent: 100,
        },
        financial_summary: computeFinancialSummary([]),
      },
      error: null,
    };
  }

  try {
    // 1. Fetch complaints
    let complaintQuery = supabase
      .from('complaints')
      .select(`
        id, tracking_id, title, priority, status, created_at, resolved_at, closed_at, sla_target_at,
        category:complaint_categories(name),
        department:departments(name)
      `)
      .eq('society_id', societyId);

    if (startDate) {
      complaintQuery = complaintQuery.gte('created_at', startDate);
    }
    if (endDate) {
      complaintQuery = complaintQuery.lte('created_at', endDate);
    }

    const { data: rawComplaints, error: compError } = await complaintQuery;
    if (compError) {
      return { data: null, error: compError.message };
    }

    const complaintsList = rawComplaints || [];
    const totalComplaints = complaintsList.length;

    // Complaint status counts
    let submitted = 0;
    let inProgress = 0;
    let resolved = 0;
    let closed = 0;
    let reopened = 0;
    const byCategory: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    let totalTurnaroundHours = 0;
    let completedWithDates = 0;
    let slaCompliantCount = 0;
    let slaBreachedCount = 0;

    complaintsList.forEach((c: any) => {
      // Status
      if (c.status === 'submitted' || c.status === 'under_review') submitted++;
      else if (c.status === 'assigned' || c.status === 'in_progress') inProgress++;
      else if (c.status === 'resolved') resolved++;
      else if (c.status === 'closed') closed++;
      else if (c.status === 'reopened') reopened++;

      // Priority
      byPriority[c.priority] = (byPriority[c.priority] || 0) + 1;

      // Category
      const catName = c.category?.name || 'General';
      byCategory[catName] = (byCategory[catName] || 0) + 1;

      // Department
      const deptName = c.department?.name || 'Operations';
      byDepartment[deptName] = (byDepartment[deptName] || 0) + 1;

      // Turnaround time & SLA compliance
      const endTimestamp = c.closed_at || c.resolved_at;
      if (endTimestamp && c.created_at) {
        const diffMs = new Date(endTimestamp).getTime() - new Date(c.created_at).getTime();
        const diffHours = Math.max(0, diffMs / (1000 * 60 * 60));
        totalTurnaroundHours += diffHours;
        completedWithDates++;

        if (c.sla_target_at) {
          if (new Date(endTimestamp) <= new Date(c.sla_target_at)) {
            slaCompliantCount++;
          } else {
            slaBreachedCount++;
          }
        }
      } else if (c.sla_target_at && new Date() > new Date(c.sla_target_at)) {
        // Active overdue ticket
        slaBreachedCount++;
      }
    });

    const avgTurnaround =
      completedWithDates > 0 ? Math.round((totalTurnaroundHours / completedWithDates) * 10) / 10 : 0;

    const totalEvaluatedForSla = slaCompliantCount + slaBreachedCount;
    const slaComplianceRate =
      totalEvaluatedForSla > 0
        ? Math.round((slaCompliantCount / totalEvaluatedForSla) * 100)
        : 100;

    // 2. Fetch escalations
    const { data: rawEscalations } = await supabase
      .from('complaint_escalations')
      .select('escalation_level')
      .eq('society_id', societyId);

    const escalationsList = rawEscalations || [];
    let l1 = 0;
    let l2 = 0;
    let l3 = 0;
    escalationsList.forEach((e: any) => {
      if (e.escalation_level === 1) l1++;
      else if (e.escalation_level === 2) l2++;
      else if (e.escalation_level >= 3) l3++;
    });

    // 3. Fetch staff performance
    const { data: rawMemberships } = await supabase
      .from('society_memberships')
      .select(`
        user_id, role, staff_designation,
        profile:profiles(full_name)
      `)
      .eq('society_id', societyId)
      .in('role', ['maintenance_staff', 'supervisor']);

    const staffList = rawMemberships || [];
    const staffIds = staffList.map((m: any) => m.user_id);

    const { data: rawAssignments } = await supabase
      .from('complaint_assignments')
      .select('assigned_to, status')
      .eq('society_id', societyId)
      .in('assigned_to', staffIds.length > 0 ? staffIds : ['00000000-0000-0000-0000-000000000000']);

    const assignments = rawAssignments || [];

    const staffPerformance = staffList.map((s: any) => {
      const userAssignments = assignments.filter((a: any) => a.assigned_to === s.user_id);
      const completed = userAssignments.filter((a: any) => a.status === 'completed').length;
      const active = userAssignments.filter(
        (a: any) => a.status === 'assigned' || a.status === 'accepted' || a.status === 'in_progress'
      ).length;

      return {
        staff_id: s.user_id,
        staff_name: s.profile?.full_name || 'Staff Member',
        designation: s.staff_designation || (s.role === 'supervisor' ? 'Supervisor' : 'Technician'),
        assigned_count: userAssignments.length,
        completed_count: completed,
        active_count: active,
      };
    });

    // 4. Fetch preventive maintenance
    const { data: schedules } = await fetchPreventiveSchedules(societyId);
    const schedList = schedules || [];
    const totalSchedules = schedList.length;
    const overdueSchedules = schedList.filter((s) => s.is_overdue).length;
    const onSchedule = totalSchedules - overdueSchedules;

    const { data: records } = await fetchMaintenanceRecords(societyId);
    const recList = records || [];
    const totalInspections = recList.length;
    const satisfactory = recList.filter((r) => r.status === 'satisfactory').length;
    const defectCount = totalInspections - satisfactory;
    const prevComplianceRate =
      totalSchedules > 0 ? Math.round((onSchedule / totalSchedules) * 100) : 100;

    // 5. Fetch society financial summary
    const expenses = await fetchSocietyExpenses(societyId);
    const financialSummary = computeFinancialSummary(expenses);

    return {
      data: {
        society_id: societyId,
        generated_at: new Date().toISOString(),
        period: { start_date: startDate, end_date: endDate },
        complaints: {
          total: totalComplaints,
          submitted,
          in_progress: inProgress,
          resolved,
          closed,
          reopened,
          avg_turnaround_hours: avgTurnaround,
          sla_compliance_rate_percent: slaComplianceRate,
          sla_compliant_count: slaCompliantCount,
          sla_breached_count: slaBreachedCount,
          by_category: byCategory,
          by_department: byDepartment,
          by_priority: byPriority,
        },
        escalations: {
          total: escalationsList.length,
          level_1: l1,
          level_2: l2,
          level_3: l3,
        },
        staff_performance: staffPerformance,
        preventive_maintenance: {
          total_schedules: totalSchedules,
          on_schedule: onSchedule,
          overdue: overdueSchedules,
          total_inspections: totalInspections,
          satisfactory_count: satisfactory,
          defect_count: defectCount,
          compliance_rate_percent: prevComplianceRate,
        },
        financial_summary: financialSummary,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to generate operational report' };
  }
}

// ------------------------------------------------------------------------------
// RFC-4180 Compliant CSV Export Utilities
// ------------------------------------------------------------------------------

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Export complaints register to CSV
 */
export function exportComplaintsToCsv(complaints: any[]): string {
  const headers = [
    'Tracking ID',
    'Title',
    'Department',
    'Category',
    'Priority',
    'Status',
    'Submitted At',
    'SLA Target',
    'Resolved At',
  ];

  const rows = complaints.map((c) => [
    escapeCsvCell(c.tracking_id),
    escapeCsvCell(c.title),
    escapeCsvCell(c.department?.name || c.department_name || ''),
    escapeCsvCell(c.category?.name || c.category_name || ''),
    escapeCsvCell(c.priority),
    escapeCsvCell(c.status),
    escapeCsvCell(c.created_at || c.submitted_at || ''),
    escapeCsvCell(c.sla_target_at || ''),
    escapeCsvCell(c.resolved_at || c.closed_at || ''),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Export preventive schedules to CSV
 */
export function exportPreventiveSchedulesToCsv(schedules: any[]): string {
  const headers = [
    'Facility Name',
    'Department',
    'Frequency',
    'Assigned Staff',
    'Next Due Date',
    'Last Completed Date',
    'Status',
  ];

  const rows = schedules.map((s) => [
    escapeCsvCell(s.facility_name),
    escapeCsvCell(s.department_name || ''),
    escapeCsvCell(s.frequency),
    escapeCsvCell(s.assigned_staff_name || 'Unassigned'),
    escapeCsvCell(s.next_due_date),
    escapeCsvCell(s.last_completed_date || 'None'),
    escapeCsvCell(s.is_overdue ? 'OVERDUE' : 'On Schedule'),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Client browser trigger to download CSV
 */
export function downloadCsv(filename: string, csvContent: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
