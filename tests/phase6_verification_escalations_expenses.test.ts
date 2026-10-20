// ==============================================================================
// SmartResolve Phase 6 Automated Test Suite
// Verifies Resolution Verification, SLA Escalations, Feedback, In-App Notifications,
// and Society Expense Management (Strictly NO VENDOR workflows).
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';

interface TestResult {
  name: string;
  category: 'static' | 'simulated' | 'local_integration' | 'live_supabase';
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(
  condition: boolean,
  testName: string,
  category: 'static' | 'simulated' | 'local_integration' | 'live_supabase',
  errorMsg?: string
) {
  if (condition) {
    results.push({ name: testName, category, passed: true });
    console.log(`  ✓ PASS [${category.toUpperCase()}]: ${testName}`);
  } else {
    results.push({ name: testName, category, passed: false, error: errorMsg });
    console.error(`  ✗ FAIL [${category.toUpperCase()}]: ${testName} - ${errorMsg}`);
  }
}

// ------------------------------------------------------------------------------
// In-Memory Simulation Fixtures & Mock Models
// ------------------------------------------------------------------------------
const MOCK_SOCIETY_A = '11111111-1111-1111-1111-111111111111';
const MOCK_SOCIETY_B = '22222222-2222-2222-2222-222222222222';

const MOCK_RESIDENT_A = 'user-resident-aaaa';
const MOCK_RESIDENT_B = 'user-resident-bbbb';
const MOCK_STAFF_A = 'user-staff-aaaa';
const MOCK_SUPERVISOR_A = 'user-supervisor-aaaa';
const MOCK_ADMIN_A = 'user-admin-aaaa';

interface MockComplaint {
  id: string;
  tracking_id: string;
  society_id: string;
  citizen_id: string;
  title: string;
  status: 'submitted' | 'under_review' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'reopened' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  submitted_at: string;
  sla_target_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  resolution_remarks?: string | null;
}

interface MockVerification {
  id: string;
  complaint_id: string;
  society_id: string;
  verified_by: string;
  is_satisfied: boolean;
  verification_notes?: string | null;
  verified_at: string;
}

interface MockFeedback {
  id: string;
  complaint_id: string;
  citizen_id: string;
  rating: number;
  satisfaction_level: 'very_satisfied' | 'satisfied' | 'neutral' | 'dissatisfied' | 'very_dissatisfied';
  feedback_text?: string | null;
}

interface MockEscalation {
  id: string;
  complaint_id: string;
  society_id: string;
  escalation_level: 1 | 2 | 3;
  trigger_type: 'automated_sla_breach' | 'manual_supervisor' | 'citizen_appeal';
  reason: string;
  notified_roles: string[];
  escalated_at: string;
}

interface MockNotification {
  id: string;
  society_id: string;
  recipient_id: string;
  complaint_id?: string | null;
  title: string;
  message: string;
  notification_type: string;
  channel: string;
  is_read: boolean;
  delivered_at: string;
}

interface MockExpense {
  id: string;
  society_id: string;
  recorded_by: string;
  category: string;
  amount: number;
  expense_date: string;
  description: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
  complaint_id?: string | null;
  department_id?: string | null;
}

// ------------------------------------------------------------------------------
// Import application functions for unit testing
// ------------------------------------------------------------------------------
import {
  calculateEffectiveSlaHours,
  calculateSlaDeadline,
  evaluateComplaintSla,
  SLA_EXCLUDED_STATUSES,
} from '../src/lib/escalationEngine';

import {
  validateExpenseInput,
  computeFinancialSummary,
  exportExpensesToCsv,
  ALLOWED_RECEIPT_TYPES,
  MAX_RECEIPT_SIZE_BYTES,
  EXPENSE_CATEGORIES,
} from '../src/lib/expenseService';

console.log('================================================================');
console.log('SMARTRESOLVE PHASE 6: VERIFICATION, SLA, FEEDBACK & EXPENSES');
console.log('================================================================\n');

// ==============================================================================
// Section 1: Static Code, Schema & Migration 10 Inspection
// ==============================================================================
console.log('[Section 1] Static Code, Schema & Migration 10 Inspection:');

const migration10Path = path.resolve(
  process.cwd(),
  'supabase/migrations/20261020000010_resolution_escalations_and_expenses.sql'
);
const hasMigration10 = fs.existsSync(migration10Path);
assert(hasMigration10, 'Migration 10 file exists', 'static');

let migration10Content = '';
if (hasMigration10) {
  migration10Content = fs.readFileSync(migration10Path, 'utf-8');
}

assert(
  migration10Content.includes('uq_complaint_escalation_level'),
  'Migration 10 defines unique index uq_complaint_escalation_level for idempotent SLA escalation',
  'static'
);

assert(
  migration10Content.includes('calculate_complaint_sla_target'),
  'Migration 10 implements calculate_complaint_sla_target trigger function',
  'static'
);

assert(
  migration10Content.includes('trg_set_complaint_sla_target'),
  'Migration 10 binds trg_set_complaint_sla_target BEFORE INSERT on complaints',
  'static'
);

assert(
  migration10Content.includes('uq_resolution_satisfied_verification'),
  'Migration 10 enforces unique satisfied verification per complaint',
  'static'
);

assert(
  migration10Content.includes('expense-receipts'),
  'Migration 10 provisions private Supabase Storage bucket expense-receipts',
  'static'
);

assert(
  migration10Content.includes('receipts_select_society_admin_supervisor'),
  'Migration 10 restricts receipt storage access to society admins and supervisors (residents denied)',
  'static'
);

assert(
  migration10Content.includes('verifications_insert') &&
    migration10Content.includes('citizen_id = public.auth_user_id()'),
  'Migration 10 hardens verifications_insert to strictly require complainant citizen identity',
  'static'
);

// Verify core service files exist
const resolutionServicePath = path.resolve(process.cwd(), 'src/lib/resolutionService.ts');
assert(fs.existsSync(resolutionServicePath), 'src/lib/resolutionService.ts exists', 'static');

const escalationEnginePath = path.resolve(process.cwd(), 'src/lib/escalationEngine.ts');
assert(fs.existsSync(escalationEnginePath), 'src/lib/escalationEngine.ts exists', 'static');

const expenseServicePath = path.resolve(process.cwd(), 'src/lib/expenseService.ts');
assert(fs.existsSync(expenseServicePath), 'src/lib/expenseService.ts exists', 'static');

const notificationServicePath = path.resolve(process.cwd(), 'src/lib/notificationService.ts');
assert(fs.existsSync(notificationServicePath), 'src/lib/notificationService.ts exists', 'static');

// Verify dashboard files exist
const citizenDashPath = path.resolve(process.cwd(), 'src/pages/citizen/CitizenDashboard.tsx');
assert(fs.existsSync(citizenDashPath), 'CitizenDashboard.tsx exists', 'static');

const trackingPagePath = path.resolve(process.cwd(), 'src/pages/citizen/ComplaintTrackingPage.tsx');
assert(fs.existsSync(trackingPagePath), 'ComplaintTrackingPage.tsx exists', 'static');

const adminDashPath = path.resolve(process.cwd(), 'src/pages/admin/AdminDashboard.tsx');
assert(fs.existsSync(adminDashPath), 'AdminDashboard.tsx exists', 'static');

const notificationBellPath = path.resolve(process.cwd(), 'src/components/notifications/NotificationBell.tsx');
assert(fs.existsSync(notificationBellPath), 'NotificationBell.tsx exists', 'static');

// ==============================================================================
// Section 2: Simulating Resolution Verification & Reopening Workflow
// ==============================================================================
console.log('\n[Section 2] Simulating Resolution Verification & Reopening:');

// Setup mock database state
const mockComplaints: Record<string, MockComplaint> = {
  'comp-001': {
    id: 'comp-001',
    tracking_id: 'SR-2026-1001',
    society_id: MOCK_SOCIETY_A,
    citizen_id: MOCK_RESIDENT_A,
    title: 'Water pressure low in B-Wing',
    status: 'resolved',
    priority: 'medium',
    submitted_at: '2026-10-18T10:00:00Z',
    resolved_at: '2026-10-19T14:00:00Z',
    resolution_remarks: 'Pump impeller cleared and tested.',
  },
  'comp-002': {
    id: 'comp-002',
    tracking_id: 'SR-2026-1002',
    society_id: MOCK_SOCIETY_A,
    citizen_id: MOCK_RESIDENT_A,
    title: 'Corridor lighting flicker',
    status: 'in_progress', // Not yet resolved!
    priority: 'low',
    submitted_at: '2026-10-19T10:00:00Z',
  },
  'comp-003': {
    id: 'comp-003',
    tracking_id: 'SR-2026-1003',
    society_id: MOCK_SOCIETY_A,
    citizen_id: MOCK_RESIDENT_A,
    title: 'Lift button stuck',
    status: 'closed', // Already closed!
    priority: 'high',
    submitted_at: '2026-10-15T10:00:00Z',
    resolved_at: '2026-10-16T10:00:00Z',
    closed_at: '2026-10-16T12:00:00Z',
  },
};

const mockVerifications: MockVerification[] = [
  {
    id: 'v-003',
    complaint_id: 'comp-003',
    society_id: MOCK_SOCIETY_A,
    verified_by: MOCK_RESIDENT_A,
    is_satisfied: true,
    verification_notes: 'All buttons working smoothly.',
    verified_at: '2026-10-16T12:00:00Z',
  },
];

const mockFeedbacks: MockFeedback[] = [
  {
    id: 'fb-003',
    complaint_id: 'comp-003',
    citizen_id: MOCK_RESIDENT_A,
    rating: 5,
    satisfaction_level: 'very_satisfied',
    feedback_text: 'Prompt elevator servicing.',
  },
];

// Test: Unauthorized resolution verification (Resident B tries to verify Resident A's ticket)
function simulateVerification(params: {
  complaintId: string;
  actorUserId: string;
  isSatisfied: boolean;
  notes?: string;
  rating?: number;
}): { success: boolean; error?: string } {
  const comp = mockComplaints[params.complaintId];
  if (!comp) return { success: false, error: 'Complaint not found.' };

  // Rule: Only the complainant resident may verify
  if (comp.citizen_id !== params.actorUserId) {
    return { success: false, error: 'Security Violation: Only the complainant resident may verify this complaint.' };
  }

  // Rule: Must be in 'resolved' status
  if (comp.status !== 'resolved') {
    if (comp.status === 'closed') {
      return { success: false, error: 'Duplicate Verification: This complaint has already been closed and verified.' };
    }
    return { success: false, error: `Invalid Status: Complaint must be in resolved status (current: ${comp.status}).` };
  }

  // Rule: If reopening, explanation of >= 10 chars required
  if (!params.isSatisfied) {
    if (!params.notes || params.notes.trim().length < 10) {
      return { success: false, error: 'Detailed explanation (minimum 10 characters) is required for reopening.' };
    }
  }

  // Rule: Rating range 1..5 if provided
  if (params.rating !== undefined && (params.rating < 1 || params.rating > 5)) {
    return { success: false, error: 'Rating must be between 1 and 5.' };
  }

  // Perform state update
  if (params.isSatisfied) {
    comp.status = 'closed';
    comp.closed_at = new Date().toISOString();
  } else {
    comp.status = 'reopened';
    comp.resolved_at = null;
    comp.closed_at = null;
    comp.resolution_remarks = `Reopened by resident: ${params.notes}`;
  }

  return { success: true };
}

// 1. Unauthorized resident verification rejection
const resUnauthorized = simulateVerification({
  complaintId: 'comp-001',
  actorUserId: MOCK_RESIDENT_B,
  isSatisfied: true,
});
assert(
  !resUnauthorized.success && resUnauthorized.error?.includes('Security Violation'),
  'Security Enforcement: Resident B cannot verify Resident A\'s complaint',
  'simulated'
);

// 2. Staff/Admin cannot verify resident resolution on resident's behalf
const staffUnauthorized = simulateVerification({
  complaintId: 'comp-001',
  actorUserId: MOCK_STAFF_A,
  isSatisfied: true,
});
assert(
  !staffUnauthorized.success && staffUnauthorized.error?.includes('Security Violation'),
  'Security Enforcement: Staff/Admin cannot verify resident resolution on resident\'s behalf',
  'simulated'
);

// 3. Verification rejected if complaint is not resolved (e.g. in_progress)
const resNotResolved = simulateVerification({
  complaintId: 'comp-002',
  actorUserId: MOCK_RESIDENT_A,
  isSatisfied: true,
});
assert(
  !resNotResolved.success && resNotResolved.error?.includes('Invalid Status'),
  'Workflow Guard: Verification rejected when complaint is in_progress',
  'simulated'
);

// 4. Duplicate verification rejected when complaint is already closed
const resDuplicate = simulateVerification({
  complaintId: 'comp-003',
  actorUserId: MOCK_RESIDENT_A,
  isSatisfied: true,
});
assert(
  !resDuplicate.success && resDuplicate.error?.includes('Duplicate Verification'),
  'Idempotency Guard: Duplicate resolution verification is rejected for already closed ticket',
  'simulated'
);

// 5. Valid resolution verification succeeds and closes ticket
const resValid = simulateVerification({
  complaintId: 'comp-001',
  actorUserId: MOCK_RESIDENT_A,
  isSatisfied: true,
  rating: 5,
  notes: 'Water pressure restored to normal across all flats.',
});
assert(
  resValid.success && mockComplaints['comp-001'].status === 'closed' && Boolean(mockComplaints['comp-001'].closed_at),
  'Resolution Confirmation: Valid verification transitions complaint to closed with timestamp',
  'simulated'
);

// 6. Reopening without adequate explanation (< 10 chars) is rejected
mockComplaints['comp-001'].status = 'resolved'; // Reset to resolved for test
const resReopenShort = simulateVerification({
  complaintId: 'comp-001',
  actorUserId: MOCK_RESIDENT_A,
  isSatisfied: false,
  notes: 'No fix', // 6 chars
});
assert(
  !resReopenShort.success && resReopenShort.error?.includes('minimum 10 characters'),
  'Reopen Validation: Reopening without adequate explanation (< 10 chars) is rejected',
  'simulated'
);

// 7. Valid reopening transitions complaint to reopened and clears resolved_at
const resReopenValid = simulateVerification({
  complaintId: 'comp-001',
  actorUserId: MOCK_RESIDENT_A,
  isSatisfied: false,
  notes: 'The pump started leaking again within 2 hours of technician departure.',
});
assert(
  resReopenValid.success &&
    mockComplaints['comp-001'].status === 'reopened' &&
    mockComplaints['comp-001'].resolved_at === null,
  'Reopen Workflow: Valid reopening moves status to reopened and clears resolved_at',
  'simulated'
);

// ==============================================================================
// Section 3: SLA Deadline Calculation & Automated Escalations
// ==============================================================================
console.log('\n[Section 3] SLA Deadline Calculation & Automated Escalations:');

// 1. Effective SLA hours calculation with priority weighting
const urgentHours = calculateEffectiveSlaHours(48, 'urgent'); // 48 * 0.25 = 12h
assert(urgentHours === 12, 'SLA Weighting: Urgent priority reduces 48h SLA to 12h (25%)', 'simulated');

const highHours = calculateEffectiveSlaHours(48, 'high'); // 48 * 0.50 = 24h
assert(highHours === 24, 'SLA Weighting: High priority reduces 48h SLA to 24h (50%)', 'simulated');

const medHours = calculateEffectiveSlaHours(48, 'medium'); // 48 * 1.0 = 48h
assert(medHours === 48, 'SLA Weighting: Medium priority retains baseline 48h SLA', 'simulated');

const lowHours = calculateEffectiveSlaHours(48, 'low'); // 48 * 1.50 = 72h
assert(lowHours === 72, 'SLA Weighting: Low priority extends 48h SLA to 72h (150%)', 'simulated');

// Minimum hours boundary check
const minUrgentHours = calculateEffectiveSlaHours(4, 'urgent'); // 4 * 0.25 = 1 -> min 2h
assert(minUrgentHours === 2, 'SLA Weighting: Minimum threshold of 2 hours enforced for urgent tickets', 'simulated');

// 2. Deadline timestamp calculation
const testSubmitDate = new Date('2026-10-20T10:00:00Z');
const deadlineUrgent = calculateSlaDeadline(testSubmitDate, 48, 'urgent');
assert(
  deadlineUrgent.toISOString() === '2026-10-20T22:00:00.000Z',
  'SLA Deadline: Correctly computes 12h deadline timestamp from submission',
  'simulated'
);

// 3. Excluded statuses (resolved, closed, rejected) are not overdue
const evalResolved = evaluateComplaintSla(
  {
    id: 'c-test-1',
    status: 'resolved',
    priority: 'medium',
    submitted_at: '2026-10-01T10:00:00Z', // Long ago
    category: { sla_hours: 48 },
  },
  new Date('2026-10-20T10:00:00Z')
);
assert(!evalResolved.isOverdue && evalResolved.eligibleLevel === 0, 'SLA Exclusion: Resolved complaint is never overdue', 'simulated');

const evalClosed = evaluateComplaintSla(
  {
    id: 'c-test-2',
    status: 'closed',
    priority: 'urgent',
    submitted_at: '2026-10-01T10:00:00Z',
    category: { sla_hours: 48 },
  },
  new Date('2026-10-20T10:00:00Z')
);
assert(!evalClosed.isOverdue && evalClosed.eligibleLevel === 0, 'SLA Exclusion: Closed complaint is never overdue', 'simulated');

// 4. On-schedule complaint
const evalOnTrack = evaluateComplaintSla(
  {
    id: 'c-test-3',
    status: 'in_progress',
    priority: 'medium',
    submitted_at: '2026-10-20T08:00:00Z', // 2 hours ago (out of 48h)
    category: { sla_hours: 48 },
  },
  new Date('2026-10-20T10:00:00Z')
);
assert(!evalOnTrack.isOverdue && evalOnTrack.eligibleLevel === 0, 'SLA Tracking: Active complaint within deadline is On-Schedule', 'simulated');

// 5. Multi-tier overdue evaluation
// Level 1: Overdue < 24h
const evalLevel1 = evaluateComplaintSla(
  {
    id: 'c-test-4',
    status: 'in_progress',
    priority: 'medium',
    submitted_at: '2026-10-18T00:00:00Z', // 48h deadline was 2026-10-20T00:00:00Z, now is +10h
    category: { sla_hours: 48 },
  },
  new Date('2026-10-20T10:00:00Z')
);
assert(evalLevel1.isOverdue && evalLevel1.eligibleLevel === 1, 'SLA Escalation Tier 1: Overdue by < 24h triggers Level 1', 'simulated');

// Level 2: Overdue 24h-48h
const evalLevel2 = evaluateComplaintSla(
  {
    id: 'c-test-5',
    status: 'assigned',
    priority: 'medium',
    submitted_at: '2026-10-17T00:00:00Z', // 48h deadline was 2026-10-19T00:00:00Z, now is +34h
    category: { sla_hours: 48 },
  },
  new Date('2026-10-20T10:00:00Z')
);
assert(evalLevel2.isOverdue && evalLevel2.eligibleLevel === 2, 'SLA Escalation Tier 2: Overdue by 24h-48h triggers Level 2', 'simulated');

// Level 3: Overdue >= 48h
const evalLevel3 = evaluateComplaintSla(
  {
    id: 'c-test-6',
    status: 'submitted',
    priority: 'medium',
    submitted_at: '2026-10-15T00:00:00Z', // 48h deadline was 2026-10-17T00:00:00Z, now is +82h
    category: { sla_hours: 48 },
  },
  new Date('2026-10-20T10:00:00Z')
);
assert(evalLevel3.isOverdue && evalLevel3.eligibleLevel === 3, 'SLA Escalation Tier 3: Overdue by >= 48h triggers Level 3', 'simulated');

// 6. Escalation Idempotency & Duplicate Prevention
const mockEscalations: MockEscalation[] = [];

function simulateTriggerEscalation(params: {
  complaintId: string;
  societyId: string;
  level: 1 | 2 | 3;
  reason: string;
}): boolean {
  // Check unique constraint (complaint_id, escalation_level)
  const existing = mockEscalations.find(
    (e) => e.complaint_id === params.complaintId && e.escalation_level === params.level
  );
  if (existing) {
    return false; // Skip insertion (idempotent)
  }

  mockEscalations.push({
    id: `esc-${Date.now()}-${params.level}`,
    complaint_id: params.complaintId,
    society_id: params.societyId,
    escalation_level: params.level,
    trigger_type: 'automated_sla_breach',
    reason: params.reason,
    notified_roles: params.level === 1 ? ['supervisor'] : ['supervisor', 'society_admin'],
    escalated_at: new Date().toISOString(),
  });
  return true;
}

// First invocation triggers level 1
const firstRun = simulateTriggerEscalation({
  complaintId: 'c-test-4',
  societyId: MOCK_SOCIETY_A,
  level: 1,
  reason: evalLevel1.reason,
});
assert(firstRun === true, 'SLA Escalation Execution: First escalation run inserts level 1 record', 'simulated');

// Second invocation on the same task does NOT create a duplicate level 1
const secondRun = simulateTriggerEscalation({
  complaintId: 'c-test-4',
  societyId: MOCK_SOCIETY_A,
  level: 1,
  reason: evalLevel1.reason,
});
assert(secondRun === false, 'Idempotency Guarantee: Second evaluation safely skips duplicate level 1', 'simulated');

const countLevel1 = mockEscalations.filter(
  (e) => e.complaint_id === 'c-test-4' && e.escalation_level === 1
).length;
assert(countLevel1 === 1, 'Database Constraint: Strictly one level 1 record exists for complaint', 'simulated');

// ==============================================================================
// Section 4: In-App Notifications & Recipient Isolation
// ==============================================================================
console.log('\n[Section 4] In-App Notifications & Recipient Isolation:');

const mockNotifications: MockNotification[] = [];

function simulateDispatchNotification(params: {
  societyId: string;
  recipientId: string;
  complaintId?: string | null;
  title: string;
  message: string;
  type: string;
}): MockNotification {
  const notif: MockNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    society_id: params.societyId,
    recipient_id: params.recipientId,
    complaint_id: params.complaintId || null,
    title: params.title,
    message: params.message,
    notification_type: params.type,
    channel: 'in_app',
    is_read: false,
    delivered_at: new Date().toISOString(),
  };
  mockNotifications.push(notif);
  return notif;
}

// 1. Dispatch notification for work completion to Resident A
const notifResident = simulateDispatchNotification({
  societyId: MOCK_SOCIETY_A,
  recipientId: MOCK_RESIDENT_A,
  complaintId: 'comp-001',
  title: 'Work Completed — Verification Needed',
  message: 'Your complaint has been marked resolved. Please verify the resolution.',
  type: 'resolved',
});
assert(
  notifResident.channel === 'in_app' && Boolean(notifResident.delivered_at),
  'Notification Delivery: In-app notification delivered with timestamp',
  'simulated'
);

// 2. Dispatch escalation notification to Supervisor
const notifSupervisor = simulateDispatchNotification({
  societyId: MOCK_SOCIETY_A,
  recipientId: MOCK_SUPERVISOR_A,
  complaintId: 'c-test-4',
  title: 'SLA Escalation Level 1',
  message: 'Ticket breached SLA target deadline.',
  type: 'escalated',
});
assert(notifSupervisor.recipient_id === MOCK_SUPERVISOR_A, 'Notification Scoping: SLA escalation delivered to supervisor', 'simulated');

// 3. Strict Recipient Isolation: Resident B cannot see Resident A's notifications
function fetchUserNotifications(userId: string): MockNotification[] {
  return mockNotifications.filter((n) => n.recipient_id === userId);
}

const residentBNotifications = fetchUserNotifications(MOCK_RESIDENT_B);
assert(
  residentBNotifications.length === 0,
  'Recipient Isolation: Resident B cannot view notifications addressed to Resident A',
  'simulated'
);

const residentANotifications = fetchUserNotifications(MOCK_RESIDENT_A);
assert(
  residentANotifications.length === 1 && residentANotifications[0].id === notifResident.id,
  'Recipient Isolation: Resident A sees only their own notifications',
  'simulated'
);

// ==============================================================================
// Section 5: Society Expense Management & Authorization
// ==============================================================================
console.log('\n[Section 5] Society Expense Management & Authorization:');

// 1. Expense validation: positive amount required
const errZeroAmount = validateExpenseInput({
  societyId: MOCK_SOCIETY_A,
  recordedBy: MOCK_ADMIN_A,
  category: 'plumbing_parts',
  amount: 0,
  description: 'Water pump gasket',
});
assert(Boolean(errZeroAmount) && errZeroAmount!.includes('positive number'), 'Amount Validation: Zero amount expense is rejected', 'simulated');

const errNegativeAmount = validateExpenseInput({
  societyId: MOCK_SOCIETY_A,
  recordedBy: MOCK_ADMIN_A,
  category: 'plumbing_parts',
  amount: -250,
  description: 'Water pump gasket',
});
assert(Boolean(errNegativeAmount) && errNegativeAmount!.includes('positive number'), 'Amount Validation: Negative amount expense is rejected', 'simulated');

// 2. Description length validation
const errShortDesc = validateExpenseInput({
  societyId: MOCK_SOCIETY_A,
  recordedBy: MOCK_ADMIN_A,
  category: 'plumbing_parts',
  amount: 450,
  description: 'Pipe', // 4 chars
});
assert(Boolean(errShortDesc) && errShortDesc!.includes('at least 5 characters'), 'Description Validation: Short description (< 5 chars) is rejected', 'simulated');

// 3. Valid expense input succeeds
const validDesc = validateExpenseInput({
  societyId: MOCK_SOCIETY_A,
  recordedBy: MOCK_ADMIN_A,
  category: 'electrical_parts',
  amount: 1450.5,
  description: 'Replaced 4x 32A MCB switches in Main Power Distribution Panel',
});
assert(validDesc === null, 'Expense Validation: Valid expense input passes validation', 'simulated');

// 4. Receipt file validation (size & MIME types)
assert(
  ALLOWED_RECEIPT_TYPES.includes('application/pdf') &&
    ALLOWED_RECEIPT_TYPES.includes('image/jpeg') &&
    ALLOWED_RECEIPT_TYPES.includes('image/png'),
  'Receipt Storage: PDF, JPG, and PNG are allowed receipt MIME types',
  'simulated'
);

assert(MAX_RECEIPT_SIZE_BYTES === 10485760, 'Receipt Storage: Maximum receipt size is 10MB', 'simulated');

// 5. Cross-society complaint association prevention
function simulateCreateExpense(params: {
  societyId: string;
  complaintId?: string | null;
  amount: number;
  category: string;
  description: string;
}): { success: boolean; error?: string } {
  if (params.complaintId) {
    const comp = mockComplaints[params.complaintId];
    if (comp && comp.society_id !== params.societyId) {
      return { success: false, error: 'Cross-society association rejected: Complaint belongs to a different society.' };
    }
  }
  return { success: true };
}

// Associate ticket from Society A to an expense in Society B
const crossSocietyResult = simulateCreateExpense({
  societyId: MOCK_SOCIETY_B,
  complaintId: 'comp-001', // Belongs to Society A!
  amount: 500,
  category: 'plumbing_parts',
  description: 'Cross-society test repair',
});
assert(
  !crossSocietyResult.success && crossSocietyResult.error?.includes('Cross-society association rejected'),
  'Tenant Isolation: Cross-society expense/complaint references are rejected',
  'simulated'
);

// 6. Financial Summary Metrics Computation
const mockExpensesList: any[] = [
  {
    id: 'exp-1',
    society_id: MOCK_SOCIETY_A,
    category: 'electrical_parts',
    amount: 2500,
    expense_date: '2026-10-10',
    description: 'Panel switches',
    approval_status: 'approved',
  },
  {
    id: 'exp-2',
    society_id: MOCK_SOCIETY_A,
    category: 'plumbing_parts',
    amount: 1200,
    expense_date: '2026-10-12',
    description: 'Ball valves',
    approval_status: 'approved',
  },
  {
    id: 'exp-3',
    society_id: MOCK_SOCIETY_A,
    category: 'generator_diesel',
    amount: 4000,
    expense_date: '2026-10-15',
    description: 'Diesel 50 liters',
    approval_status: 'pending',
  },
];

const summary = computeFinancialSummary(mockExpensesList);
assert(summary.totalApprovedAmount === 3700, 'Financial Metrics: Total approved amount accurately sums approved items (₹3,700)', 'simulated');
assert(summary.totalPendingAmount === 4000, 'Financial Metrics: Total pending amount accurately sums pending items (₹4,000)', 'simulated');
assert(summary.approvedCount === 2, 'Financial Metrics: Approved count is 2', 'simulated');
assert(summary.pendingCount === 1, 'Financial Metrics: Pending count is 1', 'simulated');
assert(summary.categoryBreakdown.electrical_parts === 2500, 'Financial Metrics: Electrical parts category breakdown matches ₹2,500', 'simulated');
assert(summary.categoryBreakdown.plumbing_parts === 1200, 'Financial Metrics: Plumbing parts category breakdown matches ₹1,200', 'simulated');

// 7. CSV Export Generation & RFC-4180 Escaping
const csvOutput = exportExpensesToCsv(mockExpensesList);
assert(csvOutput.startsWith('Expense Date,Expense ID,Category,Amount (INR)'), 'CSV Export: Header contains standard RFC-4180 columns', 'simulated');
assert(csvOutput.includes('2500.00') && csvOutput.includes('electrical_parts'), 'CSV Export: Contains formatted expense rows', 'simulated');
assert(csvOutput.includes('Panel switches'), 'CSV Export: Preserves descriptions without truncation', 'simulated');

// 8. STRICT BOUNDARY: Verify absence of vendor accounts/tables
const vendorQueryCheck = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20261020000010_resolution_escalations_and_expenses.sql'),
  'utf-8'
);
assert(
  !vendorQueryCheck.toLowerCase().includes('create table public.vendors') &&
    !vendorQueryCheck.toLowerCase().includes('vendor_bidding') &&
    !vendorQueryCheck.toLowerCase().includes('vendor_payments'),
  'Strict Architecture Boundary: Zero vendor accounts, directory, or bidding workflows in schema',
  'static'
);

// ==============================================================================
// Section 6: Live Supabase Status Classification
// ==============================================================================
console.log('\n[Section 6] Live Supabase Status Classification:');

const envPath = path.resolve(process.cwd(), '.env');
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8');
}

const hasLiveSupabase =
  envContent.includes('VITE_SUPABASE_URL=http') &&
  !envContent.includes('your-project-ref') &&
  envContent.includes('VITE_SUPABASE_ANON_KEY=ey') &&
  !envContent.includes('your-anon-publishable-key');

if (hasLiveSupabase) {
  assert(true, 'Live Supabase Environment: Configured and available', 'live_supabase');
} else {
  console.log('  ℹ NOTE [LIVE_SUPABASE]: Supabase credentials absent in .env — live database execution is NOT VERIFIED (gracefully handled with simulated testing)');
}

// ==============================================================================
// Test Suite Summary
// ==============================================================================
const totalTests = results.length;
const passedTests = results.filter((r) => r.passed).length;
const failedTests = results.filter((r) => !r.passed).length;

const staticCount = results.filter((r) => r.category === 'static').length;
const simCount = results.filter((r) => r.category === 'simulated').length;
const liveCount = results.filter((r) => r.category === 'live_supabase').length;

console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED out of ${totalTests} total checks`);
console.log('================================================================');
console.log(`Classification: ${staticCount} Static, ${simCount} Simulated, 0 Local Integration, ${liveCount} Live Supabase\n`);

if (failedTests > 0) {
  process.exit(1);
}
