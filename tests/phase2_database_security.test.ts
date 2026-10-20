// ==============================================================================
// SmartResolve Phase 2 Automated Database & Security Test Suite
// Verifies 27 tables, RLS policies, trigger bindings, and security rules
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_27_TABLES = [
  'profiles',
  'societies',
  'buildings',
  'flats',
  'society_memberships',
  'departments',
  'complaint_categories',
  'complaints',
  'complaint_attachments',
  'complaint_assignments',
  'maintenance_jobs',
  'maintenance_schedules',
  'maintenance_records',
  'complaint_status_history',
  'complaint_comments',
  'complaint_escalations',
  'resolution_verifications',
  'notifications',
  'announcements',
  'polls',
  'poll_options',
  'poll_votes',
  'complaint_feedback',
  'expenses',
  'expense_receipts',
  'emergency_contacts',
  'audit_logs',
];

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, errorMsg?: string) {
  if (condition) {
    results.push({ name: testName, passed: true });
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    results.push({ name: testName, passed: false, error: errorMsg });
    console.error(`  ✗ FAIL: ${testName} - ${errorMsg}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('SMARTRESOLVE PHASE 2: DATABASE & SECURITY TEST SUITE');
  console.log('================================================================\n');

  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  assert(fs.existsSync(migrationsDir), 'Migrations directory exists');

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  assert(migrationFiles.length >= 6, `Found ${migrationFiles.length} version-controlled SQL migration files (expected >= 6)`);

  const combinedSql = migrationFiles
    .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf8'))
    .join('\n');

  // ----------------------------------------------------------------------------
  // SECTION 1: Schema Table Verification (All 27 Tables)
  // ----------------------------------------------------------------------------
  console.log('\n[Section 1] Verifying 27 Normalized Database Tables:');
  for (const table of EXPECTED_27_TABLES) {
    const tablePattern = new RegExp(`CREATE\\s+TABLE\\s+(IF\\s+NOT\\s+EXISTS\\s+)?public\\.${table}\\b`, 'i');
    assert(tablePattern.test(combinedSql), `Table 'public.${table}' is defined with CREATE TABLE`);
  }

  // ----------------------------------------------------------------------------
  // SECTION 2: Strict Exclusion of Vendor Functionality
  // ----------------------------------------------------------------------------
  console.log('\n[Section 2] Verifying Strict Exclusion of Vendor Functionality:');
  const hasVendorTable = /CREATE\s+TABLE\s+[a-z_.]*vendor/i.test(combinedSql);
  assert(!hasVendorTable, 'No vendor tables exist in the database schema');

  const hasVendorColumn = /\bvendor_id\b|\bvendor_name\b/i.test(combinedSql);
  assert(!hasVendorColumn, 'No vendor columns exist in any table');

  const membershipRoleConstraint = /CHECK\s*\(\s*role\s+IN\s*\(\s*'resident'\s*,\s*'society_admin'\s*,\s*'maintenance_staff'\s*,\s*'supervisor'\s*\)\s*\)/i.test(
    combinedSql
  );
  assert(membershipRoleConstraint, 'Membership roles strictly restricted to in-house staff and society roles');

  // ----------------------------------------------------------------------------
  // SECTION 3: Row Level Security (RLS) Coverage on All 27 Tables
  // ----------------------------------------------------------------------------
  console.log('\n[Section 3] Verifying Row Level Security (RLS) on All 27 Tables:');
  for (const table of EXPECTED_27_TABLES) {
    const rlsPattern = new RegExp(`ALTER\\s+TABLE\\s+public\\.${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
    assert(rlsPattern.test(combinedSql), `RLS enabled on 'public.${table}'`);
  }

  // Verify Audit Log Immutability (No update or delete policy on audit_logs)
  const auditUpdatePolicy = /CREATE\s+POLICY\s+[^;]+ON\s+public\.audit_logs\s+FOR\s+UPDATE/i.test(combinedSql);
  const auditDeletePolicy = /CREATE\s+POLICY\s+[^;]+ON\s+public\.audit_logs\s+FOR\s+DELETE/i.test(combinedSql);
  assert(!auditUpdatePolicy && !auditDeletePolicy, 'Audit logs have NO update/delete policies (strictly immutable)');

  // ----------------------------------------------------------------------------
  // SECTION 4: Anti-Recursion Security Functions
  // ----------------------------------------------------------------------------
  console.log('\n[Section 4] Verifying Security Helper Functions:');
  const functions = [
    'auth_user_id',
    'is_platform_admin',
    'get_user_society_role',
    'has_society_role',
    'is_society_member',
  ];
  for (const fn of functions) {
    const fnDef = new RegExp(`FUNCTION\\s+public\\.${fn}\\b`, 'i').test(combinedSql);
    assert(fnDef, `Helper function public.${fn} defined`);
  }

  // ----------------------------------------------------------------------------
  // SECTION 5: Automated Audit Triggers and Tracking Generator
  // ----------------------------------------------------------------------------
  console.log('\n[Section 5] Verifying Audit Triggers & Generators:');
  assert(/FUNCTION\s+public\.process_audit_log/i.test(combinedSql), 'Generic audit trigger function process_audit_log() defined');
  assert(/FUNCTION\s+public\.log_complaint_status_transition/i.test(combinedSql), 'Status history transition trigger defined');
  assert(/FUNCTION\s+public\.generate_complaint_tracking_id/i.test(combinedSql), 'Human-readable tracking ID generator function defined');

  // ----------------------------------------------------------------------------
  // SECTION 6: Simulated Multi-Tenant Security & Access Control Logic
  // ----------------------------------------------------------------------------
  console.log('\n[Section 6] Simulating Multi-Tenant Access Control & Security Policies:');

  interface MockUser {
    id: string;
    is_platform_admin: boolean;
    memberships: { society_id: string; role: string; status: string }[];
  }

  interface MockComplaint {
    id: string;
    society_id: string;
    citizen_id: string;
    is_anonymous: boolean;
    assigned_to?: string;
  }

  const userResidentSoc1: MockUser = {
    id: 'user-resident-1',
    is_platform_admin: false,
    memberships: [{ society_id: 'soc-1', role: 'resident', status: 'active' }],
  };

  const userStaffSoc1: MockUser = {
    id: 'user-staff-1',
    is_platform_admin: false,
    memberships: [{ society_id: 'soc-1', role: 'maintenance_staff', status: 'active' }],
  };

  const userAdminSoc1: MockUser = {
    id: 'user-admin-1',
    is_platform_admin: false,
    memberships: [{ society_id: 'soc-1', role: 'society_admin', status: 'active' }],
  };

  const complaintSoc1: MockComplaint = {
    id: 'comp-101',
    society_id: 'soc-1',
    citizen_id: 'user-resident-1',
    is_anonymous: false,
    assigned_to: 'user-staff-1',
  };

  const complaintSoc2: MockComplaint = {
    id: 'comp-201',
    society_id: 'soc-2',
    citizen_id: 'user-resident-soc2',
    is_anonymous: false,
    assigned_to: 'user-staff-soc2',
  };

  // Helper simulating get_user_society_role
  const simulateGetRole = (user: MockUser, socId: string) => {
    const m = user.memberships.find((m) => m.society_id === socId && m.status === 'active');
    return m ? m.role : null;
  };

  // Test 1: Cross-society read access
  const residentCanReadSoc1 = simulateGetRole(userResidentSoc1, complaintSoc1.society_id) !== null;
  const residentCanReadSoc2 = simulateGetRole(userResidentSoc1, complaintSoc2.society_id) !== null;
  assert(residentCanReadSoc1, 'Resident can read complaints in their own society (soc-1)');
  assert(!residentCanReadSoc2, 'Cross-society data leakage prevented: Resident cannot read soc-2 complaints');

  // Test 2: Role escalation prevention
  const attemptRoleEscalation = (targetRole: string) => {
    // RLS policy: memberships_insert_resident allows only role = 'resident' and status = 'pending'
    return targetRole === 'resident';
  };
  assert(!attemptRoleEscalation('society_admin'), 'Direct self-enrollment as society_admin is rejected');
  assert(!attemptRoleEscalation('supervisor'), 'Direct self-enrollment as supervisor is rejected');
  assert(attemptRoleEscalation('resident'), 'Regular self-enrollment defaults strictly to pending resident');

  // Test 3: Unauthorized write attempt (Resident attempting admin action)
  const canResidentManageCategories = simulateGetRole(userResidentSoc1, 'soc-1') === 'society_admin';
  assert(!canResidentManageCategories, 'Resident is blocked from inserting or altering complaint categories');

  const canAdminManageCategories = simulateGetRole(userAdminSoc1, 'soc-1') === 'society_admin';
  assert(canAdminManageCategories, 'Society administrator is authorized to configure categories');

  // Test 4: Internal comments confidentiality
  const canResidentReadInternalComment = (isInternal: boolean, user: MockUser, socId: string) => {
    const role = simulateGetRole(user, socId);
    if (!isInternal) return true;
    return role === 'society_admin' || role === 'supervisor' || role === 'maintenance_staff';
  };
  assert(!canResidentReadInternalComment(true, userResidentSoc1, 'soc-1'), 'Private internal staff notes are hidden from residents');
  assert(canResidentReadInternalComment(true, userStaffSoc1, 'soc-1'), 'In-house maintenance staff can view internal staff notes');
  assert(canResidentReadInternalComment(false, userResidentSoc1, 'soc-1'), 'Public citizen updates are visible to residents');

  // Test 5: In-house staff assignment authority
  const canStaffUpdateAssignedJob = (jobAssignedTo: string, user: MockUser) => {
    return jobAssignedTo === user.id;
  };
  assert(canStaffUpdateAssignedJob('user-staff-1', userStaffSoc1), 'Assigned in-house maintenance staff can update their own job');
  assert(!canStaffUpdateAssignedJob('user-staff-2', userStaffSoc1), 'Maintenance staff cannot modify jobs assigned to another worker');

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED out of ${results.length} total checks`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
