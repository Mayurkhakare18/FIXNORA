// ==============================================================================
// SmartResolve Maintenance Operations & Staff Assignment Service
// Real PostgreSQL assignment tracking, maintenance jobs lifecycle, and RBAC enforcement
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { createNotification } from './notificationService';
import type {
  ComplaintAssignment,
  MaintenanceJob,
  Department,
} from '../types/database';
import type { ComplaintWithRelations } from './complaintService';

export interface EligibleStaff {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  role: 'maintenance_staff' | 'supervisor';
  designation: string;
}

export interface StaffQueueItem {
  assignment: ComplaintAssignment;
  job?: MaintenanceJob | null;
  complaint: ComplaintWithRelations;
}

export interface DepartmentWorkloadSummary {
  department: Department;
  totalComplaints: number;
  unassigned: number;
  inProgress: number;
  resolved: number;
  assignedStaffCount: number;
}

/**
 * Fetch eligible in-house maintenance technicians and supervisors for a society
 */
export async function fetchEligibleSocietyStaff(societyId: string): Promise<EligibleStaff[]> {
  if (!isSupabaseConfigured || !societyId) return [];

  const { data, error } = await supabase
    .from('society_memberships')
    .select(`
      id,
      user_id,
      role,
      staff_designation,
      profiles:user_id (id, full_name, email)
    `)
    .eq('society_id', societyId)
    .eq('status', 'active')
    .in('role', ['maintenance_staff', 'supervisor']);

  if (error) {
    throw new Error(`Failed to load eligible staff: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    membershipId: row.id,
    userId: row.user_id,
    fullName: row.profiles?.full_name || 'Staff Member',
    email: row.profiles?.email || '',
    role: row.role as 'maintenance_staff' | 'supervisor',
    designation: row.staff_designation || (row.role === 'supervisor' ? 'Supervisor' : 'Technician'),
  }));
}

/**
 * Assign a complaint to an in-house maintenance technician.
 * Creates an assignment record, initializes an operational maintenance job,
 * and advances the complaint status to 'assigned'.
 */
export async function assignComplaintToStaff(params: {
  societyId: string;
  complaintId: string;
  staffUserId: string;
  assignedByUserId: string;
  departmentId: string;
  targetDeadline?: string | null;
  complaintTitle?: string;
  complaintDescription?: string;
}): Promise<{ assignment: ComplaintAssignment; job: MaintenanceJob }> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase environment is not configured.');
  }

  // 1. Verify staff eligibility in target society
  const { data: staffMembership, error: staffErr } = await supabase
    .from('society_memberships')
    .select('id, role, status')
    .eq('society_id', params.societyId)
    .eq('user_id', params.staffUserId)
    .eq('status', 'active')
    .in('role', ['maintenance_staff', 'supervisor'])
    .maybeSingle();

  if (staffErr || !staffMembership) {
    throw new Error('Target user is not an active maintenance staff or supervisor in this society.');
  }

  // 2. Check for existing active assignment
  const { data: existingAssignment } = await supabase
    .from('complaint_assignments')
    .select('id, status')
    .eq('complaint_id', params.complaintId)
    .in('status', ['assigned', 'accepted', 'in_progress'])
    .maybeSingle();

  if (existingAssignment) {
    throw new Error(
      `Complaint already has an active assignment (${existingAssignment.status}). Reassign work to change technician.`
    );
  }

  // 3. Insert complaint assignment
  const assignmentPayload = {
    complaint_id: params.complaintId,
    society_id: params.societyId,
    assigned_to_user_id: params.staffUserId,
    assigned_by_user_id: params.assignedByUserId,
    department_id: params.departmentId,
    status: 'assigned',
    target_deadline: params.targetDeadline || null,
  };

  const { data: assignmentData, error: assignErr } = await supabase
    .from('complaint_assignments')
    .insert([assignmentPayload])
    .select('*')
    .single();

  if (assignErr) {
    throw new Error(`Assignment creation failed: ${assignErr.message}`);
  }

  // 4. Initialize operational maintenance job
  const jobPayload = {
    society_id: params.societyId,
    complaint_id: params.complaintId,
    assigned_staff_id: params.staffUserId,
    title: `Repair: ${params.complaintTitle || 'Complaint Ticket'}`,
    description: params.complaintDescription || null,
    job_type: 'complaint_repair',
    status: 'pending',
    material_cost: 0.0,
    labor_hours: 0.0,
  };

  const { data: jobData, error: jobErr } = await supabase
    .from('maintenance_jobs')
    .insert([jobPayload])
    .select('*')
    .single();

  if (jobErr) {
    console.warn('Maintenance job creation notice:', jobErr.message);
  }

  // 5. Update complaint status to 'assigned'
  await supabase
    .from('complaints')
    .update({ status: 'assigned' })
    .eq('id', params.complaintId);

  // Dispatch assignment notifications
  try {
    await createNotification({
      societyId: params.societyId,
      recipientId: params.staffUserId,
      complaintId: params.complaintId,
      title: 'New Maintenance Assignment',
      message: `You have been assigned to: "${params.complaintTitle || 'Maintenance Request'}".`,
      notificationType: 'assigned',
    });

    const { data: comp } = await supabase
      .from('complaints')
      .select('citizen_id, tracking_id')
      .eq('id', params.complaintId)
      .single();

    if (comp?.citizen_id) {
      await createNotification({
        societyId: params.societyId,
        recipientId: comp.citizen_id,
        complaintId: params.complaintId,
        title: 'Technician Assigned',
        message: `Your complaint #${comp.tracking_id} has been assigned to an in-house maintenance technician.`,
        notificationType: 'assigned',
      });
    }
  } catch (notifErr) {
    console.warn('Assignment notification notice:', notifErr);
  }

  return {
    assignment: assignmentData as ComplaintAssignment,
    job: jobData as MaintenanceJob,
  };
}

/**
 * Reassign a complaint to a different technician with a mandatory reason
 */
export async function reassignComplaint(params: {
  societyId: string;
  complaintId: string;
  currentAssignmentId: string;
  newStaffUserId: string;
  reassignedByUserId: string;
  reason: string;
  departmentId: string;
}): Promise<ComplaintAssignment> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase environment is not configured.');
  }

  if (!params.reason || params.reason.trim().length < 5) {
    throw new Error('A detailed reason (at least 5 characters) is required for reassignment.');
  }

  // 1. Mark existing assignment as reassigned
  const { error: updateErr } = await supabase
    .from('complaint_assignments')
    .update({
      status: 'reassigned',
      reassigned_reason: params.reason.trim(),
    })
    .eq('id', params.currentAssignmentId);

  if (updateErr) {
    throw new Error(`Failed to update prior assignment: ${updateErr.message}`);
  }

  // 2. Mark prior pending maintenance job as cancelled
  await supabase
    .from('maintenance_jobs')
    .update({ status: 'cancelled' })
    .eq('complaint_id', params.complaintId)
    .in('status', ['pending', 'in_progress']);

  // 3. Create new assignment
  const newAssignmentPayload = {
    complaint_id: params.complaintId,
    society_id: params.societyId,
    assigned_to_user_id: params.newStaffUserId,
    assigned_by_user_id: params.reassignedByUserId,
    department_id: params.departmentId,
    status: 'assigned',
  };

  const { data: newAssignment, error: newAssignErr } = await supabase
    .from('complaint_assignments')
    .insert([newAssignmentPayload])
    .select('*')
    .single();

  if (newAssignErr) {
    throw new Error(`Failed to create new assignment: ${newAssignErr.message}`);
  }

  // 4. Create new maintenance job for the new technician
  await supabase.from('maintenance_jobs').insert([
    {
      society_id: params.societyId,
      complaint_id: params.complaintId,
      assigned_staff_id: params.newStaffUserId,
      title: 'Reassigned Complaint Repair',
      description: `Reassigned from prior worker. Reason: ${params.reason.trim()}`,
      job_type: 'complaint_repair',
      status: 'pending',
    },
  ]);

  // Dispatch reassignment notifications
  try {
    await createNotification({
      societyId: params.societyId,
      recipientId: params.newStaffUserId,
      complaintId: params.complaintId,
      title: 'Reassigned Maintenance Task',
      message: `You have been assigned ticket #${params.complaintId.slice(0, 8)}. Reason: ${params.reason.trim()}`,
      notificationType: 'assigned',
    });

    const { data: comp } = await supabase
      .from('complaints')
      .select('citizen_id, tracking_id')
      .eq('id', params.complaintId)
      .single();

    if (comp?.citizen_id) {
      await createNotification({
        societyId: params.societyId,
        recipientId: comp.citizen_id,
        complaintId: params.complaintId,
        title: 'Technician Reassigned',
        message: `Your complaint #${comp.tracking_id} has been reassigned to another technician. Reason: ${params.reason.trim()}`,
        notificationType: 'assigned',
      });
    }
  } catch (notifErr) {
    console.warn('Reassignment notification notice:', notifErr);
  }

  return newAssignment as ComplaintAssignment;
}

/**
 * Correct department/category routing for a complaint within a society
 */
export async function correctComplaintRouting(params: {
  societyId: string;
  complaintId: string;
  newCategoryId: string;
  newDepartmentId: string;
}): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase environment is not configured.');
  }

  // 1. Validate that the category genuinely belongs to the department in this society
  const { data: category, error: catErr } = await supabase
    .from('complaint_categories')
    .select('id, society_id, department_id, name')
    .eq('id', params.newCategoryId)
    .eq('society_id', params.societyId)
    .single();

  if (catErr || !category) {
    throw new Error('Category not found or does not belong to this society.');
  }

  if (category.department_id !== params.newDepartmentId) {
    throw new Error('Routing rejection: The selected category does not belong to the chosen department.');
  }

  // 2. Update complaint routing fields
  const { error: updateErr } = await supabase
    .from('complaints')
    .update({
      category_id: params.newCategoryId,
      department_id: params.newDepartmentId,
    })
    .eq('id', params.complaintId)
    .eq('society_id', params.societyId);

  if (updateErr) {
    throw new Error(`Failed to update complaint routing: ${updateErr.message}`);
  }
}

/**
 * Fetch staff assigned queue items (assignments + jobs + complaint details)
 */
export async function fetchStaffAssignedQueue(
  staffUserId: string,
  societyId: string
): Promise<StaffQueueItem[]> {
  if (!isSupabaseConfigured || !staffUserId || !societyId) return [];

  // Query assignments for this technician in this society
  const { data: assignments, error: assignErr } = await supabase
    .from('complaint_assignments')
    .select(`
      *,
      complaint:complaints!fk_assignments_complaint_society (
        *,
        category:complaint_categories!fk_complaints_category_society(id, name),
        building:buildings!fk_complaints_building_society(id, name),
        flat:flats(id, flat_number)
      )
    `)
    .eq('society_id', societyId)
    .eq('assigned_to_user_id', staffUserId)
    .order('assigned_at', { ascending: false });

  if (assignErr) {
    throw new Error(`Failed to load assigned queue: ${assignErr.message}`);
  }

  // Query maintenance jobs for this technician
  const { data: jobs } = await supabase
    .from('maintenance_jobs')
    .select('*')
    .eq('society_id', societyId)
    .eq('assigned_staff_id', staffUserId);

  const jobMap = new Map<string, MaintenanceJob>();
  (jobs || []).forEach((j: any) => {
    if (j.complaint_id) {
      jobMap.set(j.complaint_id, j as MaintenanceJob);
    }
  });

  return (assignments || [])
    .filter((a: any) => Boolean(a.complaint))
    .map((a: any) => ({
      assignment: a as ComplaintAssignment,
      job: jobMap.get(a.complaint_id) || null,
      complaint: a.complaint as ComplaintWithRelations,
    }));
}

/**
 * Acknowledge / Accept an assigned task
 */
export async function acknowledgeAssignment(assignmentId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from('complaint_assignments')
    .update({ status: 'accepted' })
    .eq('id', assignmentId);

  if (error) {
    throw new Error(`Failed to accept assignment: ${error.message}`);
  }
}

/**
 * Start work on a job (transitions to 'in_progress')
 */
export async function startJobWork(params: {
  assignmentId: string;
  complaintId: string;
  jobId?: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured) return;

  // 1. Update assignment
  await supabase
    .from('complaint_assignments')
    .update({ status: 'in_progress' })
    .eq('id', params.assignmentId);

  // 2. Update maintenance job if exists
  if (params.jobId) {
    await supabase
      .from('maintenance_jobs')
      .update({ status: 'in_progress' })
      .eq('id', params.jobId);
  }

  // 3. Update complaint
  const { error } = await supabase
    .from('complaints')
    .update({ status: 'in_progress' })
    .eq('id', params.complaintId);

  if (error) {
    throw new Error(`Failed to update complaint to in_progress: ${error.message}`);
  }

  // Dispatch work commencement notification to resident
  try {
    const { data: comp } = await supabase
      .from('complaints')
      .select('society_id, citizen_id, tracking_id')
      .eq('id', params.complaintId)
      .single();

    if (comp?.citizen_id) {
      await createNotification({
        societyId: comp.society_id,
        recipientId: comp.citizen_id,
        complaintId: params.complaintId,
        title: 'Work Commenced',
        message: `Maintenance staff has started work on complaint #${comp.tracking_id}.`,
        notificationType: 'status_changed',
      });
    }
  } catch (notifErr) {
    console.warn('Start job notification notice:', notifErr);
  }
}

/**
 * Complete a maintenance job with repair notes, labor hours, costs, and evidence photos
 */
export async function completeJobWork(params: {
  assignmentId: string;
  complaintId: string;
  jobId?: string | null;
  repairNotes: string;
  laborHours: number;
  materialCost: number;
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured) return;

  if (!params.repairNotes || params.repairNotes.trim().length < 10) {
    throw new Error('Comprehensive repair notes (minimum 10 characters) are required for job completion.');
  }

  const now = new Date().toISOString();

  // 1. Update maintenance job
  if (params.jobId) {
    await supabase
      .from('maintenance_jobs')
      .update({
        status: 'completed',
        repair_notes: params.repairNotes.trim(),
        labor_hours: Math.max(0, params.laborHours),
        material_cost: Math.max(0, params.materialCost),
        before_photo_url: params.beforePhotoUrl || null,
        after_photo_url: params.afterPhotoUrl || null,
        completed_at: now,
      })
      .eq('id', params.jobId);
  }

  // 2. Update assignment
  await supabase
    .from('complaint_assignments')
    .update({
      status: 'completed',
      completed_at: now,
    })
    .eq('id', params.assignmentId);

  // 3. Update complaint to 'resolved'
  const { error } = await supabase
    .from('complaints')
    .update({
      status: 'resolved',
      resolved_at: now,
      resolution_remarks: params.repairNotes.trim(),
    })
    .eq('id', params.complaintId);

  if (error) {
    throw new Error(`Failed to resolve complaint: ${error.message}`);
  }

  // 4. Dispatch notification to resident: ready for resolution review
  try {
    const { data: comp } = await supabase
      .from('complaints')
      .select('society_id, citizen_id, tracking_id, title')
      .eq('id', params.complaintId)
      .single();

    if (comp?.citizen_id) {
      await createNotification({
        societyId: comp.society_id,
        recipientId: comp.citizen_id,
        complaintId: params.complaintId,
        title: 'Work Completed — Verification Needed',
        message: `Your complaint #${comp.tracking_id} ("${comp.title}") has been marked resolved. Please confirm resolution or request reopening.`,
        notificationType: 'resolved',
      });
    }
  } catch (notifErr) {
    console.warn('Resolution notification notice:', notifErr);
  }
}

/**
 * Add an internal technician progress note or public bulletin comment
 */
export async function addComplaintComment(params: {
  complaintId: string;
  societyId: string;
  authorId: string;
  commentText: string;
  isInternal: boolean;
}): Promise<void> {
  if (!isSupabaseConfigured) return;

  if (!params.commentText || params.commentText.trim().length < 3) {
    throw new Error('Comment text must be at least 3 characters.');
  }

  const { error } = await supabase.from('complaint_comments').insert([
    {
      complaint_id: params.complaintId,
      society_id: params.societyId,
      author_id: params.authorId,
      comment_text: params.commentText.trim(),
      is_internal: params.isInternal,
    },
  ]);

  if (error) {
    throw new Error(`Failed to add comment: ${error.message}`);
  }
}
