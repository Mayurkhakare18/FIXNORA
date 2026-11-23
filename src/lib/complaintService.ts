// ==============================================================================
// SmartResolve Complaint Service & Storage Management
// Real PostgreSQL persistence, Supabase Storage for evidence, and RLS integration
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { createNotification } from './notificationService';
import type {
  Complaint,
  ComplaintCategory,
  Building,
  Flat,
  ComplaintAttachment,
  ComplaintStatusHistory,
  ComplaintComment,
  PriorityLevel,
} from '../types/database';

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export interface ComplaintFormData {
  categories: ComplaintCategory[];
  buildings: Building[];
  flats: Flat[];
}

export interface ComplaintSubmissionInput {
  societyId: string;
  citizenId: string;
  categoryId: string;
  departmentId: string;
  title: string;
  description: string;
  priority: PriorityLevel;
  buildingId?: string | null;
  flatId?: string | null;
  locationDetails?: string | null;
  isAnonymous?: boolean;
}

export interface ComplaintWithRelations extends Complaint {
  citizen?: { full_name: string; phone?: string; phone_number?: string } | null;
  category?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  building?: { id: string; name: string } | null;
  flat?: { id: string; flat_number: string } | null;
  assignments?: Array<{ id: string; status: string; assigned_at: string }>;
  attachments?: ComplaintAttachment[];
  history?: ComplaintStatusHistory[];
  comments?: ComplaintComment[];
  verification?: any | null;
  feedback?: any | null;
  escalations?: any[];
}

export interface ResidentDashboardData {
  total: number;
  underReview: number;
  inProgress: number;
  resolved: number;
  recentComplaints: ComplaintWithRelations[];
}

export const DEFAULT_DEMO_CATEGORIES: ComplaintCategory[] = [
  {
    id: 'cat-plumbing-01',
    society_id: '11111111-1111-1111-1111-111111111111',
    department_id: 'dept-maintenance-01',
    name: 'Plumbing & Water Supply',
    default_priority: 'medium',
    sla_hours: 24,
    description: 'Issues with water leakage, pipes, taps, and low water pressure',
    created_at: new Date().toISOString(),
  },
  {
    id: 'cat-electrical-02',
    society_id: '11111111-1111-1111-1111-111111111111',
    department_id: 'dept-maintenance-01',
    name: 'Electrical & Lighting',
    default_priority: 'high',
    sla_hours: 12,
    description: 'Streetlights, corridor fixtures, short circuits, meter box issues',
    created_at: new Date().toISOString(),
  },
  {
    id: 'cat-lift-03',
    society_id: '11111111-1111-1111-1111-111111111111',
    department_id: 'dept-facility-02',
    name: 'Elevator / Lift Service',
    default_priority: 'urgent',
    sla_hours: 6,
    description: 'Elevator breakdown, door jams, unusual sounds, emergency alarm',
    created_at: new Date().toISOString(),
  },
  {
    id: 'cat-housekeeping-04',
    society_id: '11111111-1111-1111-1111-111111111111',
    department_id: 'dept-housekeeping-03',
    name: 'Housekeeping & Waste Management',
    default_priority: 'low',
    sla_hours: 18,
    description: 'Staircase cleaning, garbage disposal, lobby sanitation',
    created_at: new Date().toISOString(),
  },
  {
    id: 'cat-security-05',
    society_id: '11111111-1111-1111-1111-111111111111',
    department_id: 'dept-security-04',
    name: 'Security & Access Control',
    default_priority: 'medium',
    sla_hours: 12,
    description: 'Boom barrier, CCTV cameras, gate pass, visitor verification',
    created_at: new Date().toISOString(),
  },
  {
    id: 'cat-civil-06',
    society_id: '11111111-1111-1111-1111-111111111111',
    department_id: 'dept-maintenance-01',
    name: 'Civil & Structural Repairs',
    default_priority: 'medium',
    sla_hours: 72,
    description: 'Tile damage, wall cracks, seepage, plastering work',
    created_at: new Date().toISOString(),
  },
];

export const DEFAULT_DEMO_BUILDINGS: Building[] = [
  {
    id: 'bld-wing-a',
    society_id: '11111111-1111-1111-1111-111111111111',
    name: 'Wing A (Tower 1)',
    total_floors: 12,
    created_at: new Date().toISOString(),
  },
  {
    id: 'bld-wing-b',
    society_id: '11111111-1111-1111-1111-111111111111',
    name: 'Wing B (Tower 2)',
    total_floors: 12,
    created_at: new Date().toISOString(),
  },
  {
    id: 'bld-wing-c',
    society_id: '11111111-1111-1111-1111-111111111111',
    name: 'Clubhouse & Common Areas',
    total_floors: 3,
    created_at: new Date().toISOString(),
  },
];

export const DEFAULT_DEMO_FLATS: Flat[] = [
  { id: 'flat-101', building_id: 'bld-wing-a', society_id: '11111111-1111-1111-1111-111111111111', flat_number: 'Flat 101', floor: 1, occupancy_type: 'owner_occupied', created_at: new Date().toISOString() },
  { id: 'flat-102', building_id: 'bld-wing-a', society_id: '11111111-1111-1111-1111-111111111111', flat_number: 'Flat 102', floor: 1, occupancy_type: 'tenant', created_at: new Date().toISOString() },
  { id: 'flat-201', building_id: 'bld-wing-a', society_id: '11111111-1111-1111-1111-111111111111', flat_number: 'Flat 201', floor: 2, occupancy_type: 'owner_occupied', created_at: new Date().toISOString() },
  { id: 'flat-202', building_id: 'bld-wing-a', society_id: '11111111-1111-1111-1111-111111111111', flat_number: 'Flat 202', floor: 2, occupancy_type: 'tenant', created_at: new Date().toISOString() },
  { id: 'flat-301', building_id: 'bld-wing-b', society_id: '11111111-1111-1111-1111-111111111111', flat_number: 'Flat 301', floor: 3, occupancy_type: 'owner_occupied', created_at: new Date().toISOString() },
  { id: 'flat-302', building_id: 'bld-wing-b', society_id: '11111111-1111-1111-1111-111111111111', flat_number: 'Flat 302', floor: 3, occupancy_type: 'vacant', created_at: new Date().toISOString() },
];

/**
 * Fetch categories, buildings, and flats for a society
 */
export async function fetchComplaintFormData(societyId: string): Promise<ComplaintFormData> {
  if (!isSupabaseConfigured) {
    return {
      categories: DEFAULT_DEMO_CATEGORIES,
      buildings: DEFAULT_DEMO_BUILDINGS,
      flats: DEFAULT_DEMO_FLATS,
    };
  }

  try {
    const [catRes, bldRes, fltRes] = await Promise.all([
      supabase
        .from('complaint_categories')
        .select('*')
        .eq('society_id', societyId)
        .order('name'),
      supabase
        .from('buildings')
        .select('*')
        .eq('society_id', societyId)
        .order('name'),
      supabase
        .from('flats')
        .select('*')
        .eq('society_id', societyId)
        .order('flat_number'),
    ]);

    if (catRes.error || !catRes.data || catRes.data.length === 0) {
      return {
        categories: DEFAULT_DEMO_CATEGORIES,
        buildings: DEFAULT_DEMO_BUILDINGS,
        flats: DEFAULT_DEMO_FLATS,
      };
    }

    return {
      categories: (catRes.data || []) as ComplaintCategory[],
      buildings: (bldRes.data || []) as Building[],
      flats: (fltRes.data || []) as Flat[],
    };
  } catch {
    return {
      categories: DEFAULT_DEMO_CATEGORIES,
      buildings: DEFAULT_DEMO_BUILDINGS,
      flats: DEFAULT_DEMO_FLATS,
    };
  }
}

/**
 * Validate complaint input fields before submission
 */
export function validateComplaintInput(input: ComplaintSubmissionInput): string | null {
  if (!input.title || input.title.trim().length < 5) {
    return 'Complaint title must be at least 5 characters.';
  }
  if (input.title.trim().length > 150) {
    return 'Complaint title must not exceed 150 characters.';
  }
  if (!input.description || input.description.trim().length < 15) {
    return 'Detailed description must be at least 15 characters.';
  }
  if (!input.categoryId) {
    return 'Please select a valid complaint category.';
  }
  if (!input.departmentId) {
    return 'Invalid category: department association is missing.';
  }
  const validPriorities: PriorityLevel[] = ['low', 'medium', 'high', 'urgent'];
  if (!validPriorities.includes(input.priority)) {
    return 'Invalid priority selected.';
  }
  return null;
}

/**
 * Submit a complaint to Supabase PostgreSQL.
 * Note: tracking_id is generated by the database trigger trg_generate_complaint_tracking_id.
 */
export async function submitComplaint(
  input: ComplaintSubmissionInput
): Promise<Complaint> {
  const validationError = validateComplaintInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  // If Supabase is unconfigured, handle locally with demo session storage
  if (!isSupabaseConfigured) {
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const trackingId = `SR-${year}-${randomSeq}`;
    const newId = `cmp-${Date.now()}`;

    const newComplaint: Complaint = {
      id: newId,
      tracking_id: trackingId,
      society_id: input.societyId,
      citizen_id: input.citizenId,
      category_id: input.categoryId,
      department_id: input.departmentId,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority,
      building_id: input.buildingId || null,
      flat_id: input.flatId || null,
      location_details: input.locationDetails?.trim() || null,
      is_anonymous: Boolean(input.isAnonymous),
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const stored = localStorage.getItem('smartresolve_demo_complaints');
      const list = stored ? JSON.parse(stored) : [];
      list.unshift(newComplaint);
      localStorage.setItem('smartresolve_demo_complaints', JSON.stringify(list));
    } catch (e) {
      console.warn('Could not cache demo complaint in localStorage', e);
    }

    try {
      await createNotification({
        societyId: input.societyId,
        recipientId: input.citizenId,
        complaintId: newId,
        title: 'Complaint Registered (Demo Mode)',
        message: `Your complaint #${trackingId} ("${newComplaint.title}") has been registered and is under review.`,
        notificationType: 'complaint_submitted',
      });
    } catch (notifErr) {
      console.warn('Demo notification notice:', notifErr);
    }

    return newComplaint;
  }

  const payload = {
    society_id: input.societyId,
    citizen_id: input.citizenId,
    category_id: input.categoryId,
    department_id: input.departmentId,
    title: input.title.trim(),
    description: input.description.trim(),
    priority: input.priority,
    building_id: input.buildingId || null,
    flat_id: input.flatId || null,
    location_details: input.locationDetails?.trim() || null,
    is_anonymous: Boolean(input.isAnonymous),
    status: 'submitted',
  };

  const { data, error } = await supabase
    .from('complaints')
    .insert([payload])
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to submit complaint: ${error.message}`);
  }

  const createdComplaint = data as Complaint;

  // Dispatch submission confirmation notification to resident
  try {
    await createNotification({
      societyId: input.societyId,
      recipientId: input.citizenId,
      complaintId: createdComplaint.id,
      title: 'Complaint Registered',
      message: `Your complaint #${createdComplaint.tracking_id} ("${createdComplaint.title}") has been registered and is under review.`,
      notificationType: 'complaint_submitted',
    });
  } catch (notifErr) {
    console.warn('Submission notification notice:', notifErr);
  }

  return createdComplaint;
}

/**
 * Validate an evidence file before upload
 */
export function validateEvidenceFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return `Invalid file type "${file.type}". Allowed formats: JPG, PNG, WebP, PDF.`;
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return `File "${file.name}" exceeds maximum allowed size of 10MB.`;
  }
  if (file.size === 0) {
    return `File "${file.name}" is empty.`;
  }
  return null;
}

/**
 * Upload an evidence file to Supabase Storage and register in complaint_attachments.
 * Implements partial-failure cleanup: if attachment table insert fails, the uploaded
 * storage object is deleted to prevent orphaned files.
 */
export async function uploadComplaintEvidence(
  societyId: string,
  complaintId: string,
  file: File,
  uploaderUserId: string
): Promise<ComplaintAttachment> {
  const fileError = validateEvidenceFile(file);
  if (fileError) {
    throw new Error(fileError);
  }

  if (!isSupabaseConfigured) {
    const demoAtt: ComplaintAttachment = {
      id: `att-demo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      complaint_id: complaintId,
      society_id: societyId,
      uploaded_by: uploaderUserId,
      file_path: typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : `demo/${file.name}`,
      file_name: file.name,
      file_size_bytes: file.size,
      content_type: file.type,
      attachment_type: 'evidence',
      created_at: new Date().toISOString(),
    };
    return demoAtt;
  }

  // Safe file path: <society_id>/<complaint_id>/<timestamp>-<sanitized_name>
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${societyId}/${complaintId}/${Date.now()}-${sanitizedName}`;

  // 1. Upload to Supabase Storage private bucket
  const { error: uploadError } = await supabase.storage
    .from('complaint-evidence')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Evidence upload failed for ${file.name}: ${uploadError.message}`);
  }

  // 2. Persist record in complaint_attachments
  const attachmentPayload = {
    complaint_id: complaintId,
    society_id: societyId,
    uploaded_by: uploaderUserId,
    file_path: storagePath,
    file_name: file.name,
    file_size_bytes: file.size,
    content_type: file.type,
    attachment_type: 'evidence',
  };

  const { data: attachmentRecord, error: insertError } = await supabase
    .from('complaint_attachments')
    .insert([attachmentPayload])
    .select('*')
    .single();

  if (insertError) {
    // Partial failure cleanup: remove the uploaded file to avoid orphaned storage objects
    console.warn(
      `Rolling back orphaned storage file ${storagePath} due to database error:`,
      insertError
    );
    await supabase.storage.from('complaint-evidence').remove([storagePath]);
    throw new Error(`Failed to save attachment record: ${insertError.message}`);
  }

  return attachmentRecord as ComplaintAttachment;
}

/**
 * Create a secure time-limited signed URL for viewing private evidence attachments
 */
export async function createAttachmentSignedUrl(
  filePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!isSupabaseConfigured || !filePath) return null;

  try {
    const { data, error } = await supabase.storage
      .from('complaint-evidence')
      .createSignedUrl(filePath, expiresInSeconds);

    if (error) {
      console.error('Failed to create signed URL:', error);
      return null;
    }
    return data?.signedUrl || null;
  } catch (err) {
    console.error('Error generating attachment signed URL:', err);
    return null;
  }
}

/**
 * Lookup complaint by Tracking ID.
 * Returns consistent null response if not found or unauthorized to prevent information disclosure.
 */
export async function lookupComplaintByTrackingId(
  trackingId: string
): Promise<ComplaintWithRelations | null> {
  if (!trackingId.trim()) {
    return null;
  }

  const cleanId = trackingId.trim().toUpperCase();

  // 1. Check local demo complaints first
  try {
    const stored = localStorage.getItem('smartresolve_demo_complaints');
    if (stored) {
      const list: Complaint[] = JSON.parse(stored);
      const matched = list.find((c) => c.tracking_id?.toUpperCase() === cleanId);
      if (matched) {
        const cat = DEFAULT_DEMO_CATEGORIES.find((c) => c.id === matched.category_id);
        const bld = DEFAULT_DEMO_BUILDINGS.find((b) => b.id === matched.building_id);
        const flt = DEFAULT_DEMO_FLATS.find((f) => f.id === matched.flat_id);
        return {
          ...matched,
          category: cat ? { id: cat.id, name: cat.name } : { id: 'cat-0', name: 'General Maintenance' },
          department: { id: matched.department_id, name: 'Operations & Maintenance' },
          building: bld ? { id: bld.id, name: bld.name } : null,
          flat: flt ? { id: flt.id, flat_number: flt.flat_number } : null,
          assignments: [
            { id: 'asgn-01', status: 'assigned', assigned_at: new Date().toISOString() }
          ],
          history: [
            {
              id: 'h1',
              complaint_id: matched.id,
              society_id: matched.society_id,
              previous_status: null,
              new_status: 'submitted',
              remarks: 'Complaint submitted by resident',
              changed_at: matched.submitted_at || matched.created_at,
            },
            {
              id: 'h2',
              complaint_id: matched.id,
              society_id: matched.society_id,
              previous_status: 'submitted',
              new_status: 'under_review',
              remarks: 'Acknowledged by Society Operations Desk',
              changed_at: new Date().toISOString(),
            },
          ],
          comments: [],
          attachments: [],
          verification: null,
          feedback: null,
          escalations: [],
        } as ComplaintWithRelations;
      }
    }
  } catch (err) {
    console.warn('Demo tracking lookup error:', err);
  }

  // 2. Also check sample tracking ID SR-2026-1042
  if (cleanId === 'SR-2026-1042' || cleanId.includes('1042')) {
    return {
      id: 'demo-cmp-1042',
      tracking_id: 'SR-2026-1042',
      society_id: '11111111-1111-1111-1111-111111111111',
      citizen_id: 'demo-user-1',
      category_id: 'cat-electrical-02',
      department_id: 'dept-maintenance-01',
      title: 'Corridor Streetlight & Fixture Breakdown',
      description: 'The overhead lighting on 3rd floor corridor has been blinking rapidly and tripped the breaker.',
      priority: 'high',
      building_id: 'bld-wing-a',
      flat_id: 'flat-301',
      location_details: '3rd Floor Main Lobby near Lift #2',
      is_anonymous: false,
      status: 'in_progress',
      submitted_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      updated_at: new Date().toISOString(),
      category: { id: 'cat-electrical-02', name: 'Electrical & Lighting' },
      department: { id: 'dept-maintenance-01', name: 'Maintenance & Operations' },
      building: { id: 'bld-wing-a', name: 'Wing A (Tower 1)' },
      flat: { id: 'flat-301', flat_number: 'Flat 301' },
      assignments: [{ id: 'asgn-1', status: 'assigned', assigned_at: new Date().toISOString() }],
      history: [
        { id: 'h1', complaint_id: 'demo-cmp-1042', from_status: null, to_status: 'submitted', remarks: 'Complaint submitted by resident', changed_at: new Date(Date.now() - 3600000 * 5).toISOString() } as any,
        { id: 'h2', complaint_id: 'demo-cmp-1042', from_status: 'submitted', to_status: 'in_progress', remarks: 'Assigned to R. Deshmukh (Lead Electrician)', changed_at: new Date(Date.now() - 3600000 * 2).toISOString() } as any,
      ],
      comments: [],
      attachments: [],
      verification: null,
      feedback: null,
      escalations: [],
    } as ComplaintWithRelations;
  }

  if (!isSupabaseConfigured) {
    return null;
  }

  // Query complaint with related names
  const { data: complaint, error: complaintErr } = await supabase
    .from('complaints')
    .select(`
      *,
      category:complaint_categories!fk_complaints_category_society(id, name),
      department:departments(id, name),
      building:buildings!fk_complaints_building_society(id, name),
      flat:flats(id, flat_number),
      assignments:complaint_assignments!fk_assignments_complaint_society(id, status, assigned_at)
    `)
    .eq('tracking_id', cleanId)
    .maybeSingle();

  if (complaintErr || !complaint) {
    return null;
  }

  // Load status history, public comments, attachments, verifications, feedback, and escalations in parallel
  const [historyRes, commentsRes, attachmentsRes, verifRes, feedbackRes, escalationsRes] = await Promise.all([
    supabase
      .from('complaint_status_history')
      .select('*')
      .eq('complaint_id', complaint.id)
      .order('changed_at', { ascending: true }),
    supabase
      .from('complaint_comments')
      .select('*')
      .eq('complaint_id', complaint.id)
      .eq('is_internal', false) // Public comments only
      .order('created_at', { ascending: true }),
    supabase
      .from('complaint_attachments')
      .select('*')
      .eq('complaint_id', complaint.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('resolution_verifications')
      .select('*')
      .eq('complaint_id', complaint.id)
      .order('verified_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('complaint_feedback')
      .select('*')
      .eq('complaint_id', complaint.id)
      .maybeSingle(),
    supabase
      .from('complaint_escalations')
      .select('*')
      .eq('complaint_id', complaint.id)
      .order('escalated_at', { ascending: true }),
  ]);

  return {
    ...complaint,
    history: (historyRes.data || []) as ComplaintStatusHistory[],
    comments: (commentsRes.data || []) as ComplaintComment[],
    attachments: (attachmentsRes.data || []) as ComplaintAttachment[],
    verification: verifRes.data || null,
    feedback: feedbackRes.data || null,
    escalations: escalationsRes.data || [],
  } as ComplaintWithRelations;
}

/**
 * Fetch resident complaints and live dashboard statistics
 */
export async function fetchResidentDashboardData(
  citizenId: string,
  societyId: string
): Promise<ResidentDashboardData> {
  if (!isSupabaseConfigured || !citizenId || !societyId) {
    let demoComplaints: ComplaintWithRelations[] = [];
    try {
      const stored = localStorage.getItem('smartresolve_demo_complaints');
      if (stored) {
        const list: Complaint[] = JSON.parse(stored);
        demoComplaints = list.map((c) => {
          const cat = DEFAULT_DEMO_CATEGORIES.find((catItem) => catItem.id === c.category_id);
          const bld = DEFAULT_DEMO_BUILDINGS.find((b) => b.id === c.building_id);
          const flt = DEFAULT_DEMO_FLATS.find((f) => f.id === c.flat_id);
          return {
            ...c,
            category: cat ? { id: cat.id, name: cat.name } : { id: 'cat-0', name: 'General Maintenance' },
            building: bld ? { id: bld.id, name: bld.name } : null,
            flat: flt ? { id: flt.id, flat_number: flt.flat_number } : null,
          } as ComplaintWithRelations;
        });
      }
    } catch (e) {
      console.warn('Could not load demo complaints', e);
    }

    if (demoComplaints.length === 0) {
      demoComplaints = [
        {
          id: 'demo-cmp-1042',
          tracking_id: 'SR-2026-1042',
          society_id: societyId,
          citizen_id: citizenId,
          category_id: 'cat-electrical-02',
          department_id: 'dept-maintenance-01',
          title: 'Corridor Streetlight & Fixture Breakdown',
          description: 'The overhead lighting on 3rd floor corridor has been blinking rapidly.',
          priority: 'high',
          building_id: 'bld-wing-a',
          flat_id: 'flat-301',
          location_details: '3rd Floor Corridor',
          is_anonymous: false,
          status: 'in_progress',
          submitted_at: new Date(Date.now() - 3600000 * 4).toISOString(),
          created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
          updated_at: new Date().toISOString(),
          category: { id: 'cat-electrical-02', name: 'Electrical & Lighting' },
          building: { id: 'bld-wing-a', name: 'Wing A (Tower 1)' },
          flat: { id: 'flat-301', flat_number: 'Flat 301' },
        } as ComplaintWithRelations,
        {
          id: 'demo-cmp-2089',
          tracking_id: 'SR-2026-2089',
          society_id: societyId,
          citizen_id: citizenId,
          category_id: 'cat-plumbing-01',
          department_id: 'dept-maintenance-01',
          title: 'Main Water Inlet Low Pressure',
          description: 'Water pressure in kitchen inlet pipe dropped significantly this morning.',
          priority: 'medium',
          building_id: 'bld-wing-a',
          flat_id: 'flat-201',
          location_details: 'Kitchen utility area',
          is_anonymous: false,
          status: 'resolved',
          submitted_at: new Date(Date.now() - 3600000 * 28).toISOString(),
          created_at: new Date(Date.now() - 3600000 * 28).toISOString(),
          updated_at: new Date(Date.now() - 3600000 * 6).toISOString(),
          category: { id: 'cat-plumbing-01', name: 'Plumbing & Water Supply' },
          building: { id: 'bld-wing-a', name: 'Wing A (Tower 1)' },
          flat: { id: 'flat-201', flat_number: 'Flat 201' },
        } as ComplaintWithRelations,
      ];
    }

    const underReview = demoComplaints.filter((c) => ['submitted', 'under_review'].includes(c.status)).length;
    const inProgress = demoComplaints.filter((c) => ['assigned', 'in_progress', 'awaiting_citizen_response', 'reopened'].includes(c.status)).length;
    const resolved = demoComplaints.filter((c) => ['resolved', 'closed'].includes(c.status)).length;

    return {
      total: demoComplaints.length,
      underReview,
      inProgress,
      resolved,
      recentComplaints: demoComplaints,
    };
  }

  const { data, error } = await supabase
    .from('complaints')
    .select(`
      *,
      category:complaint_categories!fk_complaints_category_society(id, name),
      building:buildings!fk_complaints_building_society(id, name),
      flat:flats(id, flat_number)
    `)
    .eq('society_id', societyId)
    .eq('citizen_id', citizenId)
    .order('submitted_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load dashboard complaints: ${error.message}`);
  }

  const complaints = (data || []) as ComplaintWithRelations[];

  const underReview = complaints.filter((c) =>
    ['submitted', 'under_review'].includes(c.status)
  ).length;

  const inProgress = complaints.filter((c) =>
    ['assigned', 'in_progress', 'awaiting_citizen_response', 'reopened'].includes(
      c.status
    )
  ).length;

  const resolved = complaints.filter((c) =>
    ['resolved', 'closed'].includes(c.status)
  ).length;

  return {
    total: complaints.length,
    underReview,
    inProgress,
    resolved,
    recentComplaints: complaints,
  };
}
