// ==============================================================================
// SmartResolve SLA Tracking & Escalation Engine
// Evaluates complaint SLA deadlines, priority weighting, and records idempotent
// multi-tier escalation events with society-scoped in-app notifications.
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { createNotification } from './notificationService';
import type {
  Complaint,
  ComplaintEscalation,
  PriorityLevel,
  ComplaintStatus,
} from '../types/database';

export interface SlaEvaluationResult {
  isOverdue: boolean;
  overdueHours: number;
  eligibleLevel: 1 | 2 | 3 | 0;
  slaDeadline: Date;
  effectiveSlaHours: number;
  reason: string;
}

export interface EscalationAuditSummary {
  societyId: string;
  evaluatedAt: string;
  totalActiveComplaints: number;
  overdueComplaints: number;
  newEscalationsTriggered: number;
  alreadyEscalatedCount: number;
  escalations: ComplaintEscalation[];
}

// Statuses excluded from SLA escalation checks (job already completed or cancelled)
export const SLA_EXCLUDED_STATUSES: ComplaintStatus[] = ['resolved', 'closed', 'rejected'];

/**
 * Calculate effective SLA hours based on category baseline and priority weighting
 */
export function calculateEffectiveSlaHours(
  baseSlaHours: number,
  priority: PriorityLevel
): number {
  const base = baseSlaHours > 0 ? baseSlaHours : 48;
  switch (priority) {
    case 'urgent':
      return Math.max(2, Math.round(base * 0.25));
    case 'high':
      return Math.max(4, Math.round(base * 0.5));
    case 'medium':
      return base;
    case 'low':
      return Math.round(base * 1.5);
    default:
      return base;
  }
}

/**
 * Calculate target SLA deadline timestamp from submission timestamp, category SLA, and priority
 */
export function calculateSlaDeadline(
  submittedAt: string | Date,
  baseSlaHours: number,
  priority: PriorityLevel
): Date {
  const submitTime = new Date(submittedAt).getTime();
  const effectiveHours = calculateEffectiveSlaHours(baseSlaHours, priority);
  return new Date(submitTime + effectiveHours * 60 * 60 * 1000);
}

/**
 * Evaluate SLA status for a complaint.
 * Determines if overdue, overdue hours, and appropriate escalation level.
 */
export function evaluateComplaintSla(
  complaint: {
    id: string;
    status: ComplaintStatus;
    priority: PriorityLevel;
    submitted_at: string;
    sla_target_at?: string | null;
    category?: { sla_hours?: number } | null;
  },
  now: Date = new Date()
): SlaEvaluationResult {
  // If status is excluded, ticket is not overdue
  if (SLA_EXCLUDED_STATUSES.includes(complaint.status)) {
    return {
      isOverdue: false,
      overdueHours: 0,
      eligibleLevel: 0,
      slaDeadline: complaint.sla_target_at ? new Date(complaint.sla_target_at) : new Date(complaint.submitted_at),
      effectiveSlaHours: 0,
      reason: `Complaint is in ${complaint.status} status; excluded from SLA escalation.`,
    };
  }

  const baseSlaHours = complaint.category?.sla_hours || 48;
  const effectiveSlaHours = calculateEffectiveSlaHours(baseSlaHours, complaint.priority);

  // Use precomputed sla_target_at or compute from submitted_at
  const deadline = complaint.sla_target_at
    ? new Date(complaint.sla_target_at)
    : calculateSlaDeadline(complaint.submitted_at, baseSlaHours, complaint.priority);

  const nowMs = now.getTime();
  const deadlineMs = deadline.getTime();

  if (nowMs <= deadlineMs) {
    return {
      isOverdue: false,
      overdueHours: 0,
      eligibleLevel: 0,
      slaDeadline: deadline,
      effectiveSlaHours,
      reason: `On schedule. Deadline is ${deadline.toISOString()}.`,
    };
  }

  // Overdue calculation
  const overdueMs = nowMs - deadlineMs;
  const overdueHours = parseFloat((overdueMs / (1000 * 60 * 60)).toFixed(2));

  let eligibleLevel: 1 | 2 | 3 = 1;
  let reason = '';

  if (overdueHours >= 48) {
    eligibleLevel = 3;
    reason = `Severe SLA Breach (Level 3): Overdue by ${overdueHours}h (Target was: ${deadline.toLocaleString()}).`;
  } else if (overdueHours >= 24) {
    eligibleLevel = 2;
    reason = `Critical SLA Breach (Level 2): Overdue by ${overdueHours}h (Target was: ${deadline.toLocaleString()}).`;
  } else {
    eligibleLevel = 1;
    reason = `SLA Target Breach (Level 1): Overdue by ${overdueHours}h (Target was: ${deadline.toLocaleString()}).`;
  }

  return {
    isOverdue: true,
    overdueHours,
    eligibleLevel,
    slaDeadline: deadline,
    effectiveSlaHours,
    reason,
  };
}

/**
 * Idempotently trigger an SLA escalation record and dispatch notifications.
 * If the escalation level already exists for this complaint, the operation safely returns null without duplicating.
 */
export async function triggerSlaEscalation(params: {
  complaintId: string;
  societyId: string;
  escalationLevel: 1 | 2 | 3;
  reason: string;
  trackingId?: string;
  complaintTitle?: string;
}): Promise<ComplaintEscalation | null> {
  if (!isSupabaseConfigured) return null;

  // 1. Check if this level already exists (idempotency guard)
  const { data: existing } = await supabase
    .from('complaint_escalations')
    .select('id, escalation_level, escalated_at')
    .eq('complaint_id', params.complaintId)
    .eq('escalation_level', params.escalationLevel)
    .maybeSingle();

  if (existing) {
    // Already escalated at this level
    return null;
  }

  // 2. Determine target notification roles based on escalation tier
  const notifiedRoles =
    params.escalationLevel === 1
      ? ['supervisor']
      : params.escalationLevel === 2
      ? ['supervisor', 'society_admin']
      : ['society_admin'];

  // 3. Insert escalation record
  const payload = {
    complaint_id: params.complaintId,
    society_id: params.societyId,
    escalation_level: params.escalationLevel,
    trigger_type: 'automated_sla_breach',
    reason: params.reason,
    notified_roles: notifiedRoles,
    escalated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('complaint_escalations')
    .insert([payload])
    .select('*')
    .single();

  if (error) {
    // Could be unique constraint violation from a concurrent runner
    console.warn(`Notice on escalation insertion: ${error.message}`);
    return null;
  }

  // 4. Dispatch in-app notifications to eligible roles in the society
  const { data: targetUsers } = await supabase
    .from('society_memberships')
    .select('user_id, role')
    .eq('society_id', params.societyId)
    .eq('status', 'active')
    .in('role', notifiedRoles);

  if (targetUsers && targetUsers.length > 0) {
    const title = `SLA Escalation Level ${params.escalationLevel}`;
    const msg = `Ticket #${params.trackingId || params.complaintId.slice(0, 8)} (${params.complaintTitle || 'Maintenance'}) breached SLA: ${params.reason}`;

    for (const u of targetUsers) {
      await createNotification({
        societyId: params.societyId,
        recipientId: u.user_id,
        complaintId: params.complaintId,
        title,
        message: msg,
        notificationType: 'escalated',
      });
    }
  }

  return data as ComplaintEscalation;
}

/**
 * Execute an idempotent SLA audit across all unresolved complaints in a society.
 * Evaluates deadlines, identifies overdue items, and inserts missing escalation levels.
 */
export async function runSocietySlaAudit(
  societyId: string
): Promise<EscalationAuditSummary> {
  const evaluatedAt = new Date().toISOString();
  if (!isSupabaseConfigured || !societyId) {
    return {
      societyId,
      evaluatedAt,
      totalActiveComplaints: 0,
      overdueComplaints: 0,
      newEscalationsTriggered: 0,
      alreadyEscalatedCount: 0,
      escalations: [],
    };
  }

  // Fetch all active, non-excluded complaints in this society
  const { data: complaints, error } = await supabase
    .from('complaints')
    .select(`
      id,
      society_id,
      status,
      priority,
      submitted_at,
      sla_target_at,
      tracking_id,
      title,
      category:complaint_categories!fk_complaints_category_society(id, name, sla_hours)
    `)
    .eq('society_id', societyId)
    .not('status', 'in', '("resolved","closed","rejected")');

  if (error || !complaints) {
    console.warn('Failed to query complaints for SLA audit:', error?.message);
    return {
      societyId,
      evaluatedAt,
      totalActiveComplaints: 0,
      overdueComplaints: 0,
      newEscalationsTriggered: 0,
      alreadyEscalatedCount: 0,
      escalations: [],
    };
  }

  const now = new Date();
  let overdueComplaints = 0;
  let newEscalationsTriggered = 0;
  let alreadyEscalatedCount = 0;
  const triggeredEscalations: ComplaintEscalation[] = [];

  for (const c of complaints as any[]) {
    const evaluation = evaluateComplaintSla(c, now);
    if (evaluation.isOverdue && evaluation.eligibleLevel > 0) {
      overdueComplaints++;

      // Trigger all levels up to eligibleLevel idempotently
      for (let lvl = 1; lvl <= evaluation.eligibleLevel; lvl++) {
        const levelNum = lvl as 1 | 2 | 3;
        const result = await triggerSlaEscalation({
          complaintId: c.id,
          societyId,
          escalationLevel: levelNum,
          reason: evaluation.reason,
          trackingId: c.tracking_id,
          complaintTitle: c.title,
        });

        if (result) {
          newEscalationsTriggered++;
          triggeredEscalations.push(result);
        } else {
          alreadyEscalatedCount++;
        }
      }
    }
  }

  return {
    societyId,
    evaluatedAt,
    totalActiveComplaints: complaints.length,
    overdueComplaints,
    newEscalationsTriggered,
    alreadyEscalatedCount,
    escalations: triggeredEscalations,
  };
}

/**
 * Fetch all recorded escalations for a society
 */
export async function fetchSocietyEscalations(
  societyId: string
): Promise<(ComplaintEscalation & { complaint?: Complaint })[]> {
  if (!isSupabaseConfigured || !societyId) return [];

  const { data, error } = await supabase
    .from('complaint_escalations')
    .select(`
      *,
      complaint:complaints (
        id,
        tracking_id,
        title,
        priority,
        status,
        submitted_at,
        sla_target_at
      )
    `)
    .eq('society_id', societyId)
    .order('escalated_at', { ascending: false });

  if (error) {
    console.warn('Failed to fetch society escalations:', error.message);
    return [];
  }

  return (data || []) as any;
}
