// ==============================================================================
// Database TypeScript Definitions for SmartResolve Housing Society Platform
// All 27 Normalized Tables
// ==============================================================================

export type UserRole = 'resident' | 'society_admin' | 'maintenance_staff' | 'supervisor';
export type MembershipStatus = 'pending' | 'active' | 'suspended' | 'rejected';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';
export type ComplaintStatus =
  | 'submitted'
  | 'under_review'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'awaiting_citizen_response'
  | 'reopened'
  | 'rejected';

export type JobType =
  | 'complaint_repair'
  | 'preventive_inspection'
  | 'emergency_repair'
  | 'routine_servicing';

export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type MaintenanceFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual';

export type ExpenseCategory =
  | 'electrical_parts'
  | 'plumbing_parts'
  | 'lift_servicing'
  | 'generator_diesel'
  | 'cleaning_materials'
  | 'security_equipment'
  | 'civil_repairs'
  | 'general_maintenance';

export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  preferred_language: 'en' | 'hi' | 'mr';
  is_platform_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Society {
  id: string;
  name: string;
  registration_number: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  rules_summary?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Building {
  id: string;
  society_id: string;
  name: string;
  total_floors: number;
  created_at: string;
}

export interface Flat {
  id: string;
  society_id: string;
  building_id: string;
  flat_number: string;
  floor: number;
  occupancy_type: 'owner_occupied' | 'tenant' | 'vacant';
  created_at: string;
}

export interface SocietyMembership {
  id: string;
  society_id: string;
  user_id: string;
  flat_id?: string | null;
  role: UserRole;
  status: MembershipStatus;
  staff_designation?: string | null; // In-house staff title
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  society_id: string;
  name: string;
  description?: string | null;
  head_officer_id?: string | null;
  created_at: string;
}

export interface ComplaintCategory {
  id: string;
  society_id: string;
  department_id: string;
  name: string;
  default_priority: PriorityLevel;
  sla_hours: number;
  description?: string | null;
  created_at: string;
}

export interface Complaint {
  id: string;
  society_id: string;
  tracking_id: string;
  citizen_id: string;
  building_id?: string | null;
  flat_id?: string | null;
  category_id: string;
  department_id: string;
  title: string;
  description: string;
  location_details?: string | null;
  priority: PriorityLevel;
  status: ComplaintStatus;
  is_anonymous: boolean;
  submitted_at: string;
  sla_target_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  resolution_remarks?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplaintAttachment {
  id: string;
  complaint_id: string;
  society_id: string;
  uploaded_by: string;
  file_path: string;
  file_name: string;
  file_size_bytes: number;
  content_type: string;
  attachment_type: 'evidence' | 'resolution_proof' | 'invoice_receipt';
  created_at: string;
}

export interface ComplaintAssignment {
  id: string;
  complaint_id: string;
  society_id: string;
  assigned_to_user_id: string;
  assigned_by_user_id: string;
  department_id: string;
  status: 'assigned' | 'accepted' | 'rejected' | 'in_progress' | 'completed' | 'reassigned';
  rejection_reason?: string | null;
  reassigned_reason?: string | null;
  target_deadline?: string | null;
  assigned_at: string;
  completed_at?: string | null;
  created_at: string;
}

export interface MaintenanceJob {
  id: string;
  society_id: string;
  complaint_id?: string | null;
  assigned_staff_id: string;
  title: string;
  description?: string | null;
  job_type: JobType;
  status: JobStatus;
  material_cost: number;
  labor_hours: number;
  repair_notes?: string | null;
  before_photo_url?: string | null;
  after_photo_url?: string | null;
  scheduled_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceSchedule {
  id: string;
  society_id: string;
  department_id: string;
  facility_name: string;
  frequency: MaintenanceFrequency;
  assigned_staff_id?: string | null;
  next_due_date: string;
  last_completed_date?: string | null;
  is_active: boolean;
  checklist_items: string[];
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRecord {
  id: string;
  schedule_id: string;
  society_id: string;
  performed_by: string;
  performed_date: string;
  status: 'satisfactory' | 'needs_repair' | 'critical_fault';
  observations?: string | null;
  checklist_results: Record<string, boolean>;
  created_at: string;
}

export interface ComplaintStatusHistory {
  id: string;
  complaint_id: string;
  society_id: string;
  actor_id?: string | null;
  previous_status?: string | null;
  new_status: string;
  remarks: string;
  changed_at: string;
}

export interface ComplaintComment {
  id: string;
  complaint_id: string;
  society_id: string;
  author_id: string;
  comment_text: string;
  is_internal: boolean;
  created_at: string;
}

export interface ComplaintEscalation {
  id: string;
  complaint_id: string;
  society_id: string;
  escalation_level: number;
  trigger_type: 'automated_sla_breach' | 'manual_supervisor' | 'citizen_appeal';
  reason: string;
  notified_roles: string[];
  escalated_at: string;
}

export interface ResolutionVerification {
  id: string;
  complaint_id: string;
  society_id: string;
  verified_by: string;
  is_satisfied: boolean;
  verification_notes?: string | null;
  verified_at: string;
}

export interface NotificationItem {
  id: string;
  society_id: string;
  recipient_id: string;
  complaint_id?: string | null;
  title: string;
  message: string;
  notification_type:
    | 'complaint_submitted'
    | 'assigned'
    | 'status_changed'
    | 'escalated'
    | 'resolved'
    | 'announcement'
    | 'poll_published'
    | 'emergency_alert';
  channel: 'in_app' | 'email' | 'sms';
  is_read: boolean;
  delivered_at?: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  society_id: string;
  author_id: string;
  title: string;
  content: string;
  category: 'general' | 'maintenance' | 'emergency' | 'event' | 'billing';
  is_pinned: boolean;
  published_at: string;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Poll {
  id: string;
  society_id: string;
  created_by: string;
  question: string;
  description?: string | null;
  closing_date: string;
  voting_unit: 'per_flat' | 'per_resident';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  display_order: number;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  option_id: string;
  user_id: string;
  flat_id?: string | null;
  voted_at: string;
}

export interface ComplaintFeedback {
  id: string;
  complaint_id: string;
  citizen_id: string;
  rating: number;
  satisfaction_level: 'very_satisfied' | 'satisfied' | 'neutral' | 'dissatisfied' | 'very_dissatisfied';
  feedback_text?: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  society_id: string;
  department_id?: string | null;
  complaint_id?: string | null;
  recorded_by: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  description: string;
  approval_status: ExpenseStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseReceipt {
  id: string;
  expense_id: string;
  file_path: string;
  file_name: string;
  file_size_bytes: number;
  content_type: string;
  created_at: string;
}

export interface EmergencyContact {
  id: string;
  society_id: string;
  title: string;
  contact_person?: string | null;
  phone_number: string;
  alternative_phone?: string | null;
  available_hours: string;
  display_order: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  society_id?: string | null;
  actor_id?: string | null;
  action: string;
  table_name: string;
  record_id?: string | null;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}
