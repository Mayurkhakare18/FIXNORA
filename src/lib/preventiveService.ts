// ==============================================================================
// SmartResolve Preventive Maintenance Service
// Facility Maintenance Schedules, Checklists, Inspection Records & Due-Date Roll-Forward
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { createNotification } from './notificationService';
import type {
  MaintenanceSchedule,
  MaintenanceRecord,
  MaintenanceFrequency,
} from '../types/database';

export interface ScheduleWithRelations extends MaintenanceSchedule {
  department_name?: string;
  assigned_staff_name?: string;
  is_overdue: boolean;
  days_overdue: number;
}

export interface MaintenanceRecordWithRelations extends MaintenanceRecord {
  inspector_name?: string;
  facility_name?: string;
}

export const FREQUENCY_LABELS: Record<MaintenanceFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Bi-Weekly (Every 2 Weeks)',
  monthly: 'Monthly',
  quarterly: 'Quarterly (Every 3 Months)',
  semiannual: 'Semi-Annual (Every 6 Months)',
  annual: 'Annual (Once a Year)',
};

/**
 * Calculate the next due date based on frequency from a base date
 */
export function calculateNextDueDate(baseDate: Date, frequency: MaintenanceFrequency): string {
  const next = new Date(baseDate);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'semiannual':
      next.setMonth(next.getMonth() + 6);
      break;
    case 'annual':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next.toISOString().split('T')[0];
}

/**
 * Fetch preventive schedules for a society
 */
export async function fetchPreventiveSchedules(
  societyId: string,
  departmentId?: string
): Promise<{ data: ScheduleWithRelations[] | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: [], error: null };
  }

  try {
    let query = supabase
      .from('maintenance_schedules')
      .select(`
        *,
        department:departments(name),
        staff:profiles!maintenance_schedules_assigned_staff_id_fkey(full_name)
      `)
      .eq('society_id', societyId)
      .order('next_due_date', { ascending: true });

    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(todayStr);

    const formatted: ScheduleWithRelations[] = (data || []).map((s: any) => {
      const dueDate = new Date(s.next_due_date);
      const diffTime = today.getTime() - dueDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isOverdue = diffDays > 0;

      return {
        ...s,
        department_name: s.department?.name || 'General Facility',
        assigned_staff_name: s.staff?.full_name || 'Unassigned',
        is_overdue: isOverdue,
        days_overdue: isOverdue ? diffDays : 0,
      };
    });

    return { data: formatted, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to fetch maintenance schedules' };
  }
}

/**
 * Create a new preventive maintenance schedule
 */
export async function createPreventiveSchedule(
  societyId: string,
  payload: {
    department_id: string;
    facility_name: string;
    frequency: MaintenanceFrequency;
    assigned_staff_id?: string | null;
    next_due_date: string;
    checklist_items: string[];
  }
): Promise<{ data: MaintenanceSchedule | null; error: string | null }> {
  if (!payload.facility_name || payload.facility_name.trim().length < 3) {
    return { data: null, error: 'Facility name must be at least 3 characters' };
  }
  if (!payload.department_id) {
    return { data: null, error: 'Department is required for preventive schedules' };
  }
  if (!payload.next_due_date) {
    return { data: null, error: 'Next due date is required' };
  }

  const cleanChecklist = (payload.checklist_items || [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (!isSupabaseConfigured) {
    return {
      data: {
        id: 'mock-schedule-' + Date.now(),
        society_id: societyId,
        department_id: payload.department_id,
        facility_name: payload.facility_name.trim(),
        frequency: payload.frequency,
        assigned_staff_id: payload.assigned_staff_id || null,
        next_due_date: payload.next_due_date,
        last_completed_date: null,
        is_active: true,
        checklist_items: cleanChecklist,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from('maintenance_schedules')
      .insert({
        society_id: societyId,
        department_id: payload.department_id,
        facility_name: payload.facility_name.trim(),
        frequency: payload.frequency,
        assigned_staff_id: payload.assigned_staff_id || null,
        next_due_date: payload.next_due_date,
        checklist_items: cleanChecklist,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to create preventive maintenance schedule' };
  }
}

/**
 * Record a completed preventive maintenance inspection
 * Advances schedule next_due_date automatically
 */
export async function recordPreventiveInspection(
  societyId: string,
  scheduleId: string,
  performedBy: string,
  payload: {
    performed_date?: string;
    status: 'satisfactory' | 'needs_repair' | 'critical_fault';
    observations?: string;
    checklist_results: Record<string, boolean>;
  }
): Promise<{ data: MaintenanceRecord | null; error: string | null }> {
  if (!scheduleId || !performedBy) {
    return { data: null, error: 'Schedule and inspector information are required' };
  }

  const performedDate = payload.performed_date || new Date().toISOString().split('T')[0];

  if (!isSupabaseConfigured) {
    return {
      data: {
        id: 'mock-record-' + Date.now(),
        schedule_id: scheduleId,
        society_id: societyId,
        performed_by: performedBy,
        performed_date: performedDate,
        status: payload.status,
        observations: payload.observations || null,
        checklist_results: payload.checklist_results,
        created_at: new Date().toISOString(),
      },
      error: null,
    };
  }

  try {
    // 1. Insert maintenance record
    const { data, error } = await supabase
      .from('maintenance_records')
      .insert({
        schedule_id: scheduleId,
        society_id: societyId,
        performed_by: performedBy,
        performed_date: performedDate,
        status: payload.status,
        observations: payload.observations?.trim() || null,
        checklist_results: payload.checklist_results,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    // 2. Fetch schedule to roll-forward client-side if DB trigger did not execute
    const { data: schedule } = await supabase
      .from('maintenance_schedules')
      .select('frequency, facility_name')
      .eq('id', scheduleId)
      .single();

    if (schedule) {
      const nextDue = calculateNextDueDate(new Date(performedDate), schedule.frequency);
      await supabase
        .from('maintenance_schedules')
        .update({
          last_completed_date: performedDate,
          next_due_date: nextDue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scheduleId);

      // If critical fault or needs repair, alert supervisor
      if (payload.status === 'critical_fault' || payload.status === 'needs_repair') {
        try {
          await createNotification({
            societyId,
            recipientId: performedBy,
            title: `Facility Defect Alert: ${schedule.facility_name}`,
            message: `Inspection outcome was '${payload.status}'. Notes: ${payload.observations || 'Attention required'}`,
            notificationType: 'escalated',
          });
        } catch {
          // notification is non-blocking
        }
      }
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to record maintenance inspection' };
  }
}

/**
 * Fetch maintenance inspection history
 */
export async function fetchMaintenanceRecords(
  societyId: string,
  scheduleId?: string
): Promise<{ data: MaintenanceRecordWithRelations[] | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: [], error: null };
  }

  try {
    let query = supabase
      .from('maintenance_records')
      .select(`
        *,
        inspector:profiles!maintenance_records_performed_by_fkey(full_name),
        schedule:maintenance_schedules!fk_records_schedule_society(facility_name)
      `)
      .eq('society_id', societyId)
      .order('performed_date', { ascending: false });

    if (scheduleId) {
      query = query.eq('schedule_id', scheduleId);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    const formatted: MaintenanceRecordWithRelations[] = (data || []).map((r: any) => ({
      ...r,
      inspector_name: r.inspector?.full_name || 'Staff Member',
      facility_name: r.schedule?.facility_name || 'Facility',
    }));

    return { data: formatted, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to fetch maintenance records' };
  }
}

/**
 * On-Demand Audit Runner for Preventive Maintenance
 * Evaluates overdue schedules and returns an audit summary
 */
export async function runPreventiveMaintenanceAudit(societyId: string): Promise<{
  total_schedules: number;
  on_schedule: number;
  due_today: number;
  overdue: number;
  overdue_facilities: string[];
}> {
  const { data: schedules } = await fetchPreventiveSchedules(societyId);
  const list = schedules || [];

  const todayStr = new Date().toISOString().split('T')[0];
  let onSchedule = 0;
  let dueToday = 0;
  let overdue = 0;
  const overdueFacilities: string[] = [];

  list.forEach((s) => {
    if (s.next_due_date < todayStr) {
      overdue++;
      overdueFacilities.push(s.facility_name);
    } else if (s.next_due_date === todayStr) {
      dueToday++;
    } else {
      onSchedule++;
    }
  });

  return {
    total_schedules: list.length,
    on_schedule: onSchedule,
    due_today: dueToday,
    overdue: overdue,
    overdue_facilities: overdueFacilities,
  };
}
