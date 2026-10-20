// ==============================================================================
// SmartResolve Resolution Verification & Resident Feedback Service
// Handles resident verification, closure confirmation, rating/feedback,
// and issue reopening workflow with status-history audit tracking.
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { notifySocietySupervisorsAndAdmins } from './notificationService';
import type {
  Complaint,
  ResolutionVerification,
  ComplaintFeedback,
} from '../types/database';

export interface SubmitVerificationInput {
  complaintId: string;
  societyId: string;
  residentId: string;
  isSatisfied: boolean;
  verificationNotes?: string;
  rating?: number; // 1 to 5
  satisfactionLevel?: 'very_satisfied' | 'satisfied' | 'neutral' | 'dissatisfied' | 'very_dissatisfied';
  feedbackText?: string;
}

export interface ReopenComplaintInput {
  complaintId: string;
  societyId: string;
  residentId: string;
  reopenReason: string;
}

/**
 * Submit resident verification for a resolved complaint.
 * If satisfied: records verification, optional feedback, and closes ticket.
 * If dissatisfied: reopens the complaint with mandatory explanation.
 */
export async function submitResidentResolutionReview(
  input: SubmitVerificationInput
): Promise<{
  verification: ResolutionVerification;
  feedback?: ComplaintFeedback | null;
  updatedStatus: 'closed' | 'reopened';
}> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase environment is not configured.');
  }

  // 1. Fetch current complaint to verify ownership and eligibility
  const { data: complaint, error: compErr } = await supabase
    .from('complaints')
    .select('id, society_id, citizen_id, status, title, tracking_id')
    .eq('id', input.complaintId)
    .single();

  if (compErr || !complaint) {
    throw new Error('Complaint not found.');
  }

  // Security check: Must belong to this society
  if (complaint.society_id !== input.societyId) {
    throw new Error('Unauthorized: Complaint does not belong to the active society.');
  }

  // Security check: Only the original complainant resident can verify
  if (complaint.citizen_id !== input.residentId) {
    throw new Error('Security Violation: Only the complainant resident may verify this complaint.');
  }

  // Workflow check: Must be in 'resolved' status to verify
  if (complaint.status !== 'resolved') {
    if (complaint.status === 'closed') {
      throw new Error('Duplicate Verification: This complaint has already been closed and verified.');
    }
    throw new Error(`Invalid Status: Resolution review requires complaint to be in 'resolved' status (current: ${complaint.status}).`);
  }

  const now = new Date().toISOString();

  // ----------------------------------------------------------------------------
  // CASE A: Resident confirms resolution (is_satisfied = true)
  // ----------------------------------------------------------------------------
  if (input.isSatisfied) {
    // 1. Insert verification record
    const { data: verifData, error: verifErr } = await supabase
      .from('resolution_verifications')
      .insert([
        {
          complaint_id: input.complaintId,
          society_id: input.societyId,
          verified_by: input.residentId,
          is_satisfied: true,
          verification_notes: input.verificationNotes?.trim() || 'Resident confirmed resolution satisfactorily.',
          verified_at: now,
        },
      ])
      .select('*')
      .single();

    if (verifErr) {
      throw new Error(`Failed to record verification: ${verifErr.message}`);
    }

    // 2. Insert feedback if rating provided
    let feedbackRecord: ComplaintFeedback | null = null;
    if (input.rating && input.rating >= 1 && input.rating <= 5) {
      // Map rating to satisfaction level if not explicitly provided
      let level: ComplaintFeedback['satisfaction_level'] = input.satisfactionLevel || 'satisfied';
      if (!input.satisfactionLevel) {
        if (input.rating === 5) level = 'very_satisfied';
        else if (input.rating === 4) level = 'satisfied';
        else if (input.rating === 3) level = 'neutral';
        else if (input.rating === 2) level = 'dissatisfied';
        else level = 'very_dissatisfied';
      }

      const { data: fbData, error: fbErr } = await supabase
        .from('complaint_feedback')
        .insert([
          {
            complaint_id: input.complaintId,
            citizen_id: input.residentId,
            rating: input.rating,
            satisfaction_level: level,
            feedback_text: input.feedbackText?.trim() || null,
          },
        ])
        .select('*')
        .single();

      if (fbErr) {
        console.warn('Feedback recording notice:', fbErr.message);
      } else {
        feedbackRecord = fbData as ComplaintFeedback;
      }
    }

    // 3. Update complaint status to 'closed'
    const { error: updateErr } = await supabase
      .from('complaints')
      .update({
        status: 'closed',
        closed_at: now,
        resolution_remarks: input.verificationNotes?.trim() || 'Verified and closed by resident.',
      })
      .eq('id', input.complaintId);

    if (updateErr) {
      throw new Error(`Failed to update complaint status to closed: ${updateErr.message}`);
    }

    // 4. Notify society admin / supervisor
    await notifySocietySupervisorsAndAdmins({
      societyId: input.societyId,
      title: 'Resolution Confirmed',
      message: `Ticket #${complaint.tracking_id} ("${complaint.title}") has been confirmed resolved and closed by the resident.`,
      notificationType: 'resolved',
      complaintId: input.complaintId,
    });

    return {
      verification: verifData as ResolutionVerification,
      feedback: feedbackRecord,
      updatedStatus: 'closed',
    };
  }

  // ----------------------------------------------------------------------------
  // CASE B: Resident reports issue persists / requests reopen (is_satisfied = false)
  // ----------------------------------------------------------------------------
  const reopenReason = input.verificationNotes?.trim();
  if (!reopenReason || reopenReason.length < 10) {
    throw new Error('A detailed explanation (minimum 10 characters) is required when reporting that an issue persists.');
  }

  // 1. Insert verification record with is_satisfied = false
  const { data: verifData, error: verifErr } = await supabase
    .from('resolution_verifications')
    .insert([
      {
        complaint_id: input.complaintId,
        society_id: input.societyId,
        verified_by: input.residentId,
        is_satisfied: false,
        verification_notes: reopenReason,
        verified_at: now,
      },
    ])
    .select('*')
    .single();

  if (verifErr) {
    throw new Error(`Failed to record reopening verification: ${verifErr.message}`);
  }

  // 2. Reopen complaint: reset status to 'reopened', clear resolved/closed timestamps
  const { error: updateErr } = await supabase
    .from('complaints')
    .update({
      status: 'reopened',
      resolved_at: null,
      closed_at: null,
      resolution_remarks: `Reopened by resident: ${reopenReason}`,
    })
    .eq('id', input.complaintId);

  if (updateErr) {
    throw new Error(`Failed to update complaint to reopened: ${updateErr.message}`);
  }

  // 3. Notify society supervisors and admins that complaint has been reopened
  await notifySocietySupervisorsAndAdmins({
    societyId: input.societyId,
    title: 'Complaint Reopened by Resident',
    message: `Ticket #${complaint.tracking_id} has been reopened: "${reopenReason.substring(0, 80)}..."`,
    notificationType: 'status_changed',
    complaintId: input.complaintId,
  });

  return {
    verification: verifData as ResolutionVerification,
    feedback: null,
    updatedStatus: 'reopened',
  };
}

/**
 * Fetch resolution verification details for a complaint
 */
export async function fetchComplaintVerification(
  complaintId: string
): Promise<ResolutionVerification | null> {
  if (!isSupabaseConfigured || !complaintId) return null;

  const { data, error } = await supabase
    .from('resolution_verifications')
    .select('*')
    .eq('complaint_id', complaintId)
    .order('verified_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('Failed to load verification:', error.message);
    return null;
  }

  return data as ResolutionVerification | null;
}

/**
 * Fetch complaint feedback rating & review
 */
export async function fetchComplaintFeedback(
  complaintId: string
): Promise<ComplaintFeedback | null> {
  if (!isSupabaseConfigured || !complaintId) return null;

  const { data, error } = await supabase
    .from('complaint_feedback')
    .select('*')
    .eq('complaint_id', complaintId)
    .maybeSingle();

  if (error) {
    console.warn('Failed to load complaint feedback:', error.message);
    return null;
  }

  return data as ComplaintFeedback | null;
}

/**
 * Fetch complaints awaiting resident verification for a specific resident
 */
export async function fetchResidentPendingVerifications(
  residentId: string,
  societyId: string
): Promise<Complaint[]> {
  if (!isSupabaseConfigured || !residentId || !societyId) return [];

  const { data, error } = await supabase
    .from('complaints')
    .select('*, category:complaint_categories(id, name), building:buildings(id, name), flat:flats(id, flat_number)')
    .eq('society_id', societyId)
    .eq('citizen_id', residentId)
    .eq('status', 'resolved')
    .order('resolved_at', { ascending: false });

  if (error) {
    console.warn('Failed to fetch pending verifications:', error.message);
    return [];
  }

  return (data || []) as Complaint[];
}

/**
 * Fetch all complaints in resolved status pending resident verification in the society
 */
export async function fetchSocietyPendingVerifications(
  societyId: string
): Promise<Complaint[]> {
  if (!isSupabaseConfigured || !societyId) return [];

  const { data, error } = await supabase
    .from('complaints')
    .select('*, citizen:profiles!complaints_citizen_id_fkey(full_name, phone_number), category:complaint_categories(id, name)')
    .eq('society_id', societyId)
    .eq('status', 'resolved')
    .order('resolved_at', { ascending: false });

  if (error) {
    console.warn('Failed to fetch society pending verifications:', error.message);
    return [];
  }

  return (data || []) as Complaint[];
}
