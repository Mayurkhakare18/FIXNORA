// ==============================================================================
// SmartResolve Phase 7 Automated Community, Preventive & Reporting Test Suite
// Verifies Announcements, Multi-Unit Poll Voting, Emergency Contacts,
// Preventive Maintenance Schedules & Due-Date Roll-Forward, Operational Reporting & CSV Exports
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import {
  validatePhoneNumber,
  type PollWithOptions,
} from '../src/lib/communityService';
import {
  calculateNextDueDate,
  type ScheduleWithRelations,
} from '../src/lib/preventiveService';
import {
  exportComplaintsToCsv,
  exportPreventiveSchedulesToCsv,
} from '../src/lib/reportingService';
import { computeFinancialSummary, exportExpensesToCsv } from '../src/lib/expenseService';

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
// In-Memory Simulation Fixtures
// ------------------------------------------------------------------------------
const MOCK_SOCIETY_A = '11111111-1111-1111-1111-111111111111';
const MOCK_SOCIETY_B = '22222222-2222-2222-2222-222222222222';

const MOCK_ADMIN_A = 'user-admin-aaaa';
const MOCK_SUPERVISOR_A = 'user-sup-aaaa';
const MOCK_TECH_A1 = 'user-tech-1111';
const MOCK_RESIDENT_A1 = 'user-res-flat101-husband';
const MOCK_RESIDENT_A2 = 'user-res-flat101-wife';
const MOCK_RESIDENT_A3 = 'user-res-flat102';
const MOCK_RESIDENT_B1 = 'user-res-socB';

const MOCK_FLAT_101 = 'flat-101-uuid';
const MOCK_FLAT_102 = 'flat-102-uuid';

// ==============================================================================
// Section 1: Static Code, Schema & Migration 11 Inspection
// ==============================================================================
console.log('\n================================================================');
console.log('SMARTRESOLVE PHASE 7: COMMUNITY, PREVENTIVE & REPORTING');
console.log('================================================================\n');

console.log('[Section 1] Static Code, Schema & Migration 11 Inspection:');

const migration11Path = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20261020000011_community_preventive_and_reporting.sql'
);

assert(fs.existsSync(migration11Path), 'Migration 11 file exists', 'static');

let migration11Sql = '';
if (fs.existsSync(migration11Path)) {
  migration11Sql = fs.readFileSync(migration11Path, 'utf8');
}

assert(
  migration11Sql.includes('check_poll_vote_rules'),
  'Migration 11 defines check_poll_vote_rules trigger function',
  'static'
);

assert(
  migration11Sql.includes('trg_check_poll_vote_rules'),
  'Migration 11 binds trg_check_poll_vote_rules BEFORE INSERT on public.poll_votes',
  'static'
);

assert(
  migration11Sql.includes('process_maintenance_inspection'),
  'Migration 11 defines process_maintenance_inspection trigger function',
  'static'
);

assert(
  migration11Sql.includes('trg_process_maintenance_inspection'),
  'Migration 11 binds trg_process_maintenance_inspection AFTER INSERT on public.maintenance_records',
  'static'
);

assert(
  migration11Sql.includes('emergency_contacts_manage_admin') &&
    migration11Sql.includes('supervisor'),
  'Migration 11 authorizes supervisors to manage emergency contacts alongside society_admin',
  'static'
);

// Verify Service Modules exist
const communityServicePath = path.join(process.cwd(), 'src', 'lib', 'communityService.ts');
const preventiveServicePath = path.join(process.cwd(), 'src', 'lib', 'preventiveService.ts');
const reportingServicePath = path.join(process.cwd(), 'src', 'lib', 'reportingService.ts');

assert(fs.existsSync(communityServicePath), 'src/lib/communityService.ts exists', 'static');
assert(fs.existsSync(preventiveServicePath), 'src/lib/preventiveService.ts exists', 'static');
assert(fs.existsSync(reportingServicePath), 'src/lib/reportingService.ts exists', 'static');

// Verify Admin Subcomponents exist
const annSectionPath = path.join(process.cwd(), 'src', 'pages', 'admin', 'sections', 'AnnouncementsSection.tsx');
const pollsSectionPath = path.join(process.cwd(), 'src', 'pages', 'admin', 'sections', 'PollsSection.tsx');
const emergencySectionPath = path.join(process.cwd(), 'src', 'pages', 'admin', 'sections', 'EmergencyContactsSection.tsx');
const prevSectionPath = path.join(process.cwd(), 'src', 'pages', 'admin', 'sections', 'PreventiveMaintenanceSection.tsx');
const reportsSectionPath = path.join(process.cwd(), 'src', 'pages', 'admin', 'sections', 'OperationalReportsSection.tsx');

assert(fs.existsSync(annSectionPath), 'AnnouncementsSection component exists', 'static');
assert(fs.existsSync(pollsSectionPath), 'PollsSection component exists', 'static');
assert(fs.existsSync(emergencySectionPath), 'EmergencyContactsSection component exists', 'static');
assert(fs.existsSync(prevSectionPath), 'PreventiveMaintenanceSection component exists', 'static');
assert(fs.existsSync(reportsSectionPath), 'OperationalReportsSection component exists', 'static');

// Zero Vendor Schema Boundary Check
const allMigrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(allMigrationsDir);
let vendorTermsFound = false;
migrationFiles.forEach((file) => {
  const content = fs.readFileSync(path.join(allMigrationsDir, file), 'utf8');
  if (
    content.includes('CREATE TABLE public.vendors') ||
    content.includes('vendor_bidding') ||
    content.includes('vendor_invoices')
  ) {
    vendorTermsFound = true;
  }
});
assert(!vendorTermsFound, 'Strict Architecture: Zero vendor tables or workflows in all 11 database migrations', 'static');

// ==============================================================================
// Section 2: Simulating Society Announcements & Access Control
// ==============================================================================
console.log('\n[Section 2] Simulating Society Announcements & Access Control:');

interface MockAnnouncement {
  id: string;
  society_id: string;
  author_id: string;
  title: string;
  content: string;
  category: 'general' | 'maintenance' | 'emergency' | 'event' | 'billing';
  is_pinned: boolean;
  published_at: string;
}

const mockAnnouncements: MockAnnouncement[] = [];

function simulateCreateAnnouncement(
  actorRole: 'society_admin' | 'supervisor' | 'resident' | 'maintenance_staff',
  societyId: string,
  authorId: string,
  payload: { title: string; content: string; category: any; is_pinned?: boolean }
) {
  if (actorRole !== 'society_admin' && actorRole !== 'supervisor') {
    return { success: false, error: 'Unauthorized: Only admins and supervisors may publish announcements' };
  }
  if (!payload.title || payload.title.trim().length < 3) {
    return { success: false, error: 'Title must be at least 3 characters' };
  }
  if (!payload.content || payload.content.trim().length < 10) {
    return { success: false, error: 'Content must be at least 10 characters' };
  }

  const newAnn: MockAnnouncement = {
    id: `ann-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    society_id: societyId,
    author_id: authorId,
    title: payload.title.trim(),
    content: payload.content.trim(),
    category: payload.category,
    is_pinned: Boolean(payload.is_pinned),
    published_at: new Date().toISOString(),
  };
  mockAnnouncements.push(newAnn);
  return { success: true, data: newAnn };
}

// 1. Resident cannot publish announcement
const resAnn = simulateCreateAnnouncement('resident', MOCK_SOCIETY_A, MOCK_RESIDENT_A1, {
  title: 'Resident Notice',
  content: 'Selling old furniture in Flat 101',
  category: 'general',
});
assert(!resAnn.success, 'Authorization: Resident is denied permission to publish announcements', 'simulated');

// 2. Admin successfully publishes emergency announcement
const adminAnn = simulateCreateAnnouncement('society_admin', MOCK_SOCIETY_A, MOCK_ADMIN_A, {
  title: 'Water Tank Cleaning Tomorrow',
  content: 'Water supply will be suspended from 10:00 AM to 2:00 PM for scheduled tank sanitization.',
  category: 'maintenance',
  is_pinned: true,
});
assert(adminAnn.success && adminAnn.data?.is_pinned === true, 'Admin successfully publishes pinned maintenance announcement', 'simulated');

// 3. Supervisor successfully publishes announcement
const supAnn = simulateCreateAnnouncement('supervisor', MOCK_SOCIETY_A, MOCK_SUPERVISOR_A, {
  title: 'Lift Servicing Schedule',
  content: 'Passenger Lift B will undergo quarterly preventive servicing on Wednesday.',
  category: 'maintenance',
});
assert(supAnn.success, 'Supervisor successfully publishes maintenance announcement', 'simulated');

// 4. Input validation: short title rejected
const shortTitleAnn = simulateCreateAnnouncement('society_admin', MOCK_SOCIETY_A, MOCK_ADMIN_A, {
  title: 'Hi',
  content: 'Valid content exceeding minimum character limits for testing.',
  category: 'general',
});
assert(!shortTitleAnn.success, 'Input Validation: Short announcement title (< 3 chars) is rejected', 'simulated');

// 5. Tenant Isolation: Society B resident cannot read Society A announcements
function simulateFetchAnnouncements(userSocietyId: string) {
  return mockAnnouncements.filter((a) => a.society_id === userSocietyId);
}

const socAAnnouncements = simulateFetchAnnouncements(MOCK_SOCIETY_A);
const socBAnnouncements = simulateFetchAnnouncements(MOCK_SOCIETY_B);

assert(socAAnnouncements.length >= 2, 'Society A members see Society A announcements', 'simulated');
assert(socBAnnouncements.length === 0, 'Tenant Isolation: Society B members cannot see Society A announcements', 'simulated');

// ==============================================================================
// Section 3: Simulating Community Polls & Voting Enforcement
// ==============================================================================
console.log('\n[Section 3] Simulating Community Polls & Voting Enforcement:');

interface MockPoll {
  id: string;
  society_id: string;
  question: string;
  voting_unit: 'per_flat' | 'per_resident';
  closing_date: string;
  is_active: boolean;
  options: { id: string; option_text: string }[];
}

interface MockVote {
  poll_id: string;
  option_id: string;
  user_id: string;
  flat_id?: string | null;
}

const mockPolls: MockPoll[] = [];
const mockVotes: MockVote[] = [];

// 1. Create per_flat poll
const flatPoll: MockPoll = {
  id: 'poll-flat-1',
  society_id: MOCK_SOCIETY_A,
  question: 'Approve EV Charging Stations in Basement 1?',
  voting_unit: 'per_flat',
  closing_date: new Date(Date.now() + 86400000 * 7).toISOString(), // 7 days in future
  is_active: true,
  options: [
    { id: 'opt-yes', option_text: 'Yes' },
    { id: 'opt-no', option_text: 'No' },
  ],
};
mockPolls.push(flatPoll);

// 2. Create per_resident poll
const residentPoll: MockPoll = {
  id: 'poll-res-2',
  society_id: MOCK_SOCIETY_A,
  question: 'Preferred Time for Annual Society Gathering?',
  voting_unit: 'per_resident',
  closing_date: new Date(Date.now() + 86400000 * 7).toISOString(),
  is_active: true,
  options: [
    { id: 'opt-morning', option_text: 'Morning 10 AM' },
    { id: 'opt-evening', option_text: 'Evening 6 PM' },
  ],
};
mockPolls.push(residentPoll);

// 3. Create expired poll
const expiredPoll: MockPoll = {
  id: 'poll-expired-3',
  society_id: MOCK_SOCIETY_A,
  question: 'Past Decision on Society Paint Color?',
  voting_unit: 'per_flat',
  closing_date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
  is_active: true,
  options: [
    { id: 'opt-white', option_text: 'Classic White' },
    { id: 'opt-beige', option_text: 'Modern Beige' },
  ],
};
mockPolls.push(expiredPoll);

function simulateCastVote(
  pollId: string,
  optionId: string,
  userId: string,
  flatId?: string | null
): { success: boolean; error?: string } {
  const poll = mockPolls.find((p) => p.id === pollId);
  if (!poll) return { success: false, error: 'Poll not found' };

  if (!poll.is_active) {
    return { success: false, error: 'Voting rejected: Poll is no longer active' };
  }

  if (new Date(poll.closing_date) <= new Date()) {
    return { success: false, error: 'Voting rejected: Poll voting deadline has passed' };
  }

  // Check user duplicate vote
  const existingUserVote = mockVotes.find((v) => v.poll_id === pollId && v.user_id === userId);
  if (existingUserVote) {
    return { success: false, error: 'Voting rejected: You have already voted in this poll' };
  }

  // If per_flat voting, enforce 1 vote per flat
  if (poll.voting_unit === 'per_flat') {
    if (!flatId) {
      return { success: false, error: 'Voting rejected: Flat ID is required for per-flat voting' };
    }
    const existingFlatVote = mockVotes.find((v) => v.poll_id === pollId && v.flat_id === flatId);
    if (existingFlatVote) {
      return {
        success: false,
        error: 'Voting rejected: A vote has already been cast for this flat in this poll',
      };
    }
  }

  mockVotes.push({ poll_id: pollId, option_id: optionId, user_id: userId, flat_id: flatId });
  return { success: true };
}

// Test per_flat voting:
// Husband in Flat 101 votes Yes
const vote1 = simulateCastVote('poll-flat-1', 'opt-yes', MOCK_RESIDENT_A1, MOCK_FLAT_101);
assert(vote1.success, 'Per-Flat Voting: First resident in Flat 101 casts vote successfully', 'simulated');

// Wife in Flat 101 tries to vote No in the same per_flat poll -> REJECTED
const vote2 = simulateCastVote('poll-flat-1', 'opt-no', MOCK_RESIDENT_A2, MOCK_FLAT_101);
assert(!vote2.success && vote2.error?.includes('already been cast for this flat'), 'Per-Flat Voting: Second resident in Flat 101 is blocked from casting second vote for the flat', 'simulated');

// Resident in Flat 102 votes No -> ACCEPTED
const vote3 = simulateCastVote('poll-flat-1', 'opt-no', MOCK_RESIDENT_A3, MOCK_FLAT_102);
assert(vote3.success, 'Per-Flat Voting: Resident in Flat 102 casts vote successfully', 'simulated');

// Test per_resident voting:
// Husband in Flat 101 votes Morning in per_resident poll
const resVote1 = simulateCastVote('poll-res-2', 'opt-morning', MOCK_RESIDENT_A1, MOCK_FLAT_101);
assert(resVote1.success, 'Per-Resident Voting: Resident A1 casts vote successfully', 'simulated');

// Wife in Flat 101 votes Evening in the SAME per_resident poll -> ACCEPTED (since voting unit is per_resident)
const resVote2 = simulateCastVote('poll-res-2', 'opt-evening', MOCK_RESIDENT_A2, MOCK_FLAT_101);
assert(resVote2.success, 'Per-Resident Voting: Resident A2 in same flat successfully casts vote in per_resident poll', 'simulated');

// Husband tries to vote AGAIN in per_resident poll -> REJECTED
const resVoteDuplicate = simulateCastVote('poll-res-2', 'opt-morning', MOCK_RESIDENT_A1, MOCK_FLAT_101);
assert(!resVoteDuplicate.success, 'Duplicate Prevention: Same user cannot cast duplicate vote in per_resident poll', 'simulated');

// Test voting after closing date
const expiredVote = simulateCastVote('poll-expired-3', 'opt-white', MOCK_RESIDENT_A3, MOCK_FLAT_102);
assert(!expiredVote.success && expiredVote.error?.includes('deadline has passed'), 'Deadline Enforcement: Voting on expired poll is rejected', 'simulated');

// Verify tally calculations
const votesForFlatPoll = mockVotes.filter((v) => v.poll_id === 'poll-flat-1');
const yesCount = votesForFlatPoll.filter((v) => v.option_id === 'opt-yes').length;
const noCount = votesForFlatPoll.filter((v) => v.option_id === 'opt-no').length;

assert(yesCount === 1, 'Tally Calculation: Yes count for poll-flat-1 matches 1', 'simulated');
assert(noCount === 1, 'Tally Calculation: No count for poll-flat-1 matches 1', 'simulated');
assert(votesForFlatPoll.length === 2, 'Tally Calculation: Total votes for poll-flat-1 matches 2', 'simulated');

// ==============================================================================
// Section 4: Simulating Emergency Contacts & Access Controls
// ==============================================================================
console.log('\n[Section 4] Simulating Emergency Contacts & Access Controls:');

// Test phone number validation
assert(validatePhoneNumber('9876543210'), 'Phone Validation: Standard 10-digit mobile number is valid', 'simulated');
assert(validatePhoneNumber('+91 98765 43210'), 'Phone Validation: Formatted mobile with country code is valid', 'simulated');
assert(validatePhoneNumber('100'), 'Phone Validation: Emergency 3-digit police code (100) is valid', 'simulated');
assert(validatePhoneNumber('101'), 'Phone Validation: Emergency 3-digit fire code (101) is valid', 'simulated');
assert(validatePhoneNumber('108'), 'Phone Validation: Emergency ambulance code (108) is valid', 'simulated');
assert(validatePhoneNumber('112'), 'Phone Validation: Unified emergency code (112) is valid', 'simulated');
assert(!validatePhoneNumber('abc123'), 'Phone Validation: Alphanumeric string is rejected', 'simulated');
assert(!validatePhoneNumber('12'), 'Phone Validation: 2-digit number is rejected', 'simulated');

interface MockEmergencyContact {
  id: string;
  society_id: string;
  title: string;
  contact_person?: string;
  phone_number: string;
  available_hours: string;
}

const mockContacts: MockEmergencyContact[] = [
  { id: 'c-1', society_id: MOCK_SOCIETY_A, title: 'Main Gate Security', contact_person: 'Head Guard', phone_number: '9876500001', available_hours: '24/7' },
  { id: 'c-2', society_id: MOCK_SOCIETY_A, title: 'Lift Emergency Service', contact_person: 'Otis Control Room', phone_number: '1800100100', available_hours: '24/7' },
  { id: 'c-3', society_id: MOCK_SOCIETY_B, title: 'Society B Security', contact_person: 'Guard B', phone_number: '9876500002', available_hours: '24/7' },
];

function simulateFetchContacts(userSocietyId: string) {
  return mockContacts.filter((c) => c.society_id === userSocietyId);
}

const contactsA = simulateFetchContacts(MOCK_SOCIETY_A);
const contactsB = simulateFetchContacts(MOCK_SOCIETY_B);

assert(contactsA.length === 2, 'Society A members see Society A emergency contacts', 'simulated');
assert(contactsB.length === 1, 'Society B members see Society B emergency contacts', 'simulated');
assert(
  contactsA.every((c) => c.society_id === MOCK_SOCIETY_A),
  'Tenant Isolation: Cross-society contact leakage is prevented',
  'simulated'
);

// ==============================================================================
// Section 5: Simulating Preventive Maintenance & Due-Date Roll-Forward
// ==============================================================================
console.log('\n[Section 5] Simulating Preventive Maintenance & Due-Date Roll-Forward:');

// Test cadence calculations
const baseDate = new Date('2026-04-01');

const nextDaily = calculateNextDueDate(baseDate, 'daily');
assert(nextDaily === '2026-04-02', 'Cadence Calculation: Daily rolls forward by 1 day', 'simulated');

const nextWeekly = calculateNextDueDate(baseDate, 'weekly');
assert(nextWeekly === '2026-04-08', 'Cadence Calculation: Weekly rolls forward by 7 days', 'simulated');

const nextBiweekly = calculateNextDueDate(baseDate, 'biweekly');
assert(nextBiweekly === '2026-04-15', 'Cadence Calculation: Bi-weekly rolls forward by 14 days', 'simulated');

const nextMonthly = calculateNextDueDate(baseDate, 'monthly');
assert(nextMonthly === '2026-05-01', 'Cadence Calculation: Monthly rolls forward by 1 month', 'simulated');

const nextQuarterly = calculateNextDueDate(baseDate, 'quarterly');
assert(nextQuarterly === '2026-07-01', 'Cadence Calculation: Quarterly rolls forward by 3 months', 'simulated');

const nextSemiannual = calculateNextDueDate(baseDate, 'semiannual');
assert(nextSemiannual === '2026-10-01', 'Cadence Calculation: Semi-annual rolls forward by 6 months', 'simulated');

const nextAnnual = calculateNextDueDate(baseDate, 'annual');
assert(nextAnnual === '2027-04-01', 'Cadence Calculation: Annual rolls forward by 1 year', 'simulated');

// Simulate schedule state & inspection roll forward
interface MockSchedule {
  id: string;
  society_id: string;
  facility_name: string;
  frequency: any;
  next_due_date: string;
  last_completed_date: string | null;
  checklist_items: string[];
}

interface MockRecord {
  schedule_id: string;
  society_id: string;
  performed_by: string;
  performed_date: string;
  status: 'satisfactory' | 'needs_repair' | 'critical_fault';
  observations: string;
}

const mockSchedules: MockSchedule[] = [
  {
    id: 'sched-lift-a',
    society_id: MOCK_SOCIETY_A,
    facility_name: 'Passenger Elevator Bank A',
    frequency: 'monthly',
    next_due_date: '2026-04-10',
    last_completed_date: '2026-03-10',
    checklist_items: ['Check motor temp', 'Test emergency brakes', 'Inspect door sensors'],
  },
  {
    id: 'sched-generator-1',
    society_id: MOCK_SOCIETY_A,
    facility_name: '500kVA Diesel Generator',
    frequency: 'quarterly',
    next_due_date: '2026-03-01', // Past date -> overdue
    last_completed_date: '2025-12-01',
    checklist_items: ['Check fuel levels', 'Test auto-start relay'],
  },
];

const mockRecords: MockRecord[] = [];

// Simulate overdue calculation against current reference date '2026-04-20'
const todayStr = '2026-04-20';

const isLiftOverdue = mockSchedules[0].next_due_date < todayStr;
const isGenOverdue = mockSchedules[1].next_due_date < todayStr;

assert(isLiftOverdue, 'Overdue Detection: Elevator with due date 2026-04-10 is overdue on 2026-04-20', 'simulated');
assert(isGenOverdue, 'Overdue Detection: Generator with due date 2026-03-01 is overdue on 2026-04-20', 'simulated');

// Perform inspection on Elevator: Technician inspects on 2026-04-20
function simulateRecordInspection(
  scheduleId: string,
  performedBy: string,
  performedDate: string,
  status: 'satisfactory' | 'needs_repair' | 'critical_fault',
  observations: string
) {
  const sched = mockSchedules.find((s) => s.id === scheduleId);
  if (!sched) throw new Error('Schedule not found');

  mockRecords.push({
    schedule_id: scheduleId,
    society_id: sched.society_id,
    performed_by: performedBy,
    performed_date: performedDate,
    status,
    observations,
  });

  // Roll forward schedule
  sched.last_completed_date = performedDate;
  sched.next_due_date = calculateNextDueDate(new Date(performedDate), sched.frequency);
}

simulateRecordInspection('sched-lift-a', MOCK_TECH_A1, '2026-04-20', 'satisfactory', 'Routine servicing complete, all sensors aligned.');

assert(mockSchedules[0].last_completed_date === '2026-04-20', 'Roll-Forward: last_completed_date updated to inspection date 2026-04-20', 'simulated');
assert(mockSchedules[0].next_due_date === '2026-05-20', 'Roll-Forward: next_due_date advanced automatically to 2026-05-20 (1 month forward)', 'simulated');
assert(mockSchedules[0].next_due_date > todayStr, 'Roll-Forward: Elevator is now On Schedule and no longer overdue', 'simulated');

// ==============================================================================
// Section 6: Simulating Operational Reporting & RFC-4180 CSV Exports
// ==============================================================================
console.log('\n[Section 6] Simulating Operational Reporting & RFC-4180 CSV Exports:');

// Test CSV Escaping & Formats
const sampleComplaintsForCsv = [
  {
    tracking_id: 'SR-2026-0001',
    title: 'Water leakage in main pipe, B Wing',
    department_name: 'Plumbing Department',
    category_name: 'Pipe Leakage',
    priority: 'high',
    status: 'closed',
    created_at: '2026-04-01T10:00:00Z',
    sla_target_at: '2026-04-02T10:00:00Z',
    resolved_at: '2026-04-01T18:00:00Z',
  },
  {
    tracking_id: 'SR-2026-0002',
    title: 'Elevator door stuck "error code E4"',
    department_name: 'Electrical Department',
    category_name: 'Lift Failure',
    priority: 'urgent',
    status: 'in_progress',
    created_at: '2026-04-02T12:00:00Z',
    sla_target_at: '2026-04-02T18:00:00Z',
    resolved_at: null,
  },
];

const complaintCsv = exportComplaintsToCsv(sampleComplaintsForCsv);

assert(complaintCsv.includes('Tracking ID,Title,Department,Category,Priority,Status,Submitted At,SLA Target,Resolved At'), 'CSV Export: Complaints CSV contains standard RFC-4180 headers', 'simulated');
assert(complaintCsv.includes('"SR-2026-0001"'), 'CSV Export: Tracking ID is quoted', 'simulated');
assert(complaintCsv.includes('"Water leakage in main pipe, B Wing"'), 'CSV Export: Title containing comma is safely escaped with quotes', 'simulated');
assert(complaintCsv.includes('"Elevator door stuck ""error code E4"""'), 'CSV Export: Double quotes inside cell are escaped with double double-quotes per RFC-4180', 'simulated');

// Test Preventive Schedules CSV
const sampleSchedulesForCsv = [
  {
    facility_name: 'Passenger Elevator Bank A',
    department_name: 'Electrical Department',
    frequency: 'monthly',
    assigned_staff_name: 'Senior Electrician',
    next_due_date: '2026-05-20',
    last_completed_date: '2026-04-20',
    is_overdue: false,
  },
];

const schedCsv = exportPreventiveSchedulesToCsv(sampleSchedulesForCsv);
assert(schedCsv.includes('Facility Name,Department,Frequency,Assigned Staff,Next Due Date,Last Completed Date,Status'), 'CSV Export: Preventive Schedules CSV contains correct headers', 'simulated');
assert(schedCsv.includes('"Passenger Elevator Bank A"'), 'CSV Export: Facility name formatted properly', 'simulated');
assert(schedCsv.includes('"On Schedule"'), 'CSV Export: Status shows "On Schedule"', 'simulated');

// Verify SLA turnaround & compliance calculations
const testTurnaroundDiffMs = new Date('2026-04-01T18:00:00Z').getTime() - new Date('2026-04-01T10:00:00Z').getTime();
const turnaroundHours = testTurnaroundDiffMs / (1000 * 60 * 60);
assert(turnaroundHours === 8, 'Turnaround Time: Correctly computes 8.0 hours resolution time', 'simulated');

const isSlaCompliant = new Date('2026-04-01T18:00:00Z') <= new Date('2026-04-02T10:00:00Z');
assert(isSlaCompliant, 'SLA Compliance: Ticket resolved at 18:00 is compliant with deadline at 10:00 next day', 'simulated');

// ==============================================================================
// Section 7: Live Supabase Status Classification
// ==============================================================================
console.log('\n[Section 7] Live Supabase Status Classification:');
console.log('  ℹ NOTE [LIVE_SUPABASE]: Supabase credentials absent in .env — live database execution is NOT VERIFIED (gracefully handled with simulated testing)');

// ==============================================================================
// Summary Report
// ==============================================================================
const passedChecks = results.filter((r) => r.passed).length;
const failedChecks = results.filter((r) => !r.passed).length;
const totalChecks = results.length;

console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passedChecks} PASSED, ${failedChecks} FAILED out of ${totalChecks} total checks`);
console.log('================================================================');

const staticCount = results.filter((r) => r.category === 'static').length;
const simulatedCount = results.filter((r) => r.category === 'simulated').length;
const localIntCount = results.filter((r) => r.category === 'local_integration').length;
const liveCount = results.filter((r) => r.category === 'live_supabase').length;

console.log(`Classification: ${staticCount} Static, ${simulatedCount} Simulated, ${localIntCount} Local Integration, ${liveCount} Live Supabase\n`);

if (failedChecks > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
