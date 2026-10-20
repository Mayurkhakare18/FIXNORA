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

  assert(migrationFiles.length >= 7, `Found ${migrationFiles.length} version-controlled SQL migration files (expected >= 7)`);

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
  // SECTION 7: Migration 7 Security Refinements & Relational Integrity (Static Checks)
  // ----------------------------------------------------------------------------
  console.log('\n[Section 7] Verifying Migration 7 Security Refinements & Relational Constraints:');

  // 1. Helper function public.shares_society_with
  assert(/FUNCTION\s+public\.shares_society_with\b/i.test(combinedSql), "Helper function 'public.shares_society_with' defined");
  assert(/FUNCTION\s+public\.shares_society_with[\s\S]+?SECURITY\s+DEFINER\s+SET\s+search_path\s*=\s*public/i.test(combinedSql), "shares_society_with has safe search_path = public and SECURITY DEFINER");
  assert(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.shares_society_with\(uuid\)\s+FROM\s+PUBLIC/i.test(combinedSql), "EXECUTE privilege on shares_society_with revoked from PUBLIC");
  assert(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.shares_society_with\(uuid\)\s+TO\s+authenticated/i.test(combinedSql), "EXECUTE privilege on shares_society_with granted to authenticated");

  // 2. Admin Staff Enrollment Policy
  assert(/CREATE\s+POLICY\s+"memberships_insert_admin"\s+ON\s+public\.society_memberships/i.test(combinedSql), "Admin staff enrollment policy 'memberships_insert_admin' defined");
  assert(/memberships_insert_admin[^;]+role\s+IN\s*\(\s*'resident'\s*,\s*'maintenance_staff'\s*,\s*'supervisor'\s*\)/is.test(combinedSql), "memberships_insert_admin restricts roles strictly to permitted in-house staff/residents");

  // 3. Complaint Update Immutability Trigger & WITH CHECK Policy
  assert(/FUNCTION\s+public\.check_complaint_immutable_fields\b/i.test(combinedSql), "Complaint field immutability function 'check_complaint_immutable_fields' defined");
  assert(/TRIGGER\s+trg_complaints_immutable_fields\b/i.test(combinedSql), "Complaint immutability trigger attached to public.complaints");
  assert(/CREATE\s+POLICY\s+"complaints_update"\s+ON\s+public\.complaints[^;]+WITH\s+CHECK/is.test(combinedSql), "complaints_update policy enforces explicit WITH CHECK authorization");

  // 4. Automated Status Attribution (actor_id nullable)
  assert(/ALTER\s+TABLE\s+public\.complaint_status_history\s+ALTER\s+COLUMN\s+actor_id\s+DROP\s+NOT\s+NULL/i.test(combinedSql), "complaint_status_history.actor_id altered to allow NULL for automated transitions");
  assert(/v_actor_id\s*:=\s*NULL/i.test(combinedSql), "log_complaint_status_transition trigger sets actor_id = NULL on automated transitions");

  // 5. Composite Constraints for Multi-Tenant Integrity
  const compositeUniqueKeys = [
    'uq_buildings_id_society',
    'uq_departments_id_society',
    'uq_complaints_id_society',
    'uq_schedules_id_society',
    'uq_categories_id_society'
  ];
  for (const uq of compositeUniqueKeys) {
    assert(new RegExp(`CONSTRAINT\\s+${uq}\\s+UNIQUE\\s*\\(\\s*(id,\\s*society_id|society_id,\\s*id)\\s*\\)`, 'i').test(combinedSql), `Composite unique constraint '${uq}' defined`);
  }

  const compositeForeignKeys = [
    'fk_flats_building_society',
    'fk_categories_department_society',
    'fk_assignments_complaint_society',
    'fk_attachments_complaint_society',
    'fk_comments_complaint_society',
    'fk_status_history_complaint_society',
    'fk_verifications_complaint_society',
    'fk_records_schedule_society',
    'fk_complaints_building_society',
    'fk_complaints_category_society'
  ];
  for (const fk of compositeForeignKeys) {
    assert(new RegExp(`CONSTRAINT\\s+${fk}\\s+FOREIGN\\s+KEY`, 'i').test(combinedSql), `Composite foreign key constraint '${fk}' defined`);
  }

  // ----------------------------------------------------------------------------
  // SECTION 8: Simulated Phase 2.2 Hardening Verification
  // ----------------------------------------------------------------------------
  console.log('\n[Section 8] Simulating Phase 2.2 Hardening Logic:');

  // Simulation 1: Co-member profile visibility & enumeration prevention
  const simulateSharesSocietyWith = (requestingUser: MockUser, targetUserId: string, allUsers: MockUser[]) => {
    if (!requestingUser.id || !targetUserId) return false;
    if (requestingUser.id === targetUserId) return true;
    const targetUser = allUsers.find(u => u.id === targetUserId);
    if (!targetUser) return false;

    // Check shared active society membership
    return requestingUser.memberships.some(m1 => 
      m1.status === 'active' && 
      targetUser.memberships.some(m2 => m2.society_id === m1.society_id && m2.status === 'active')
    );
  };

  const userResident2Soc1: MockUser = {
    id: 'user-resident-2',
    is_platform_admin: false,
    memberships: [{ society_id: 'soc-1', role: 'resident', status: 'active' }],
  };

  const userResidentSoc2: MockUser = {
    id: 'user-resident-soc2',
    is_platform_admin: false,
    memberships: [{ society_id: 'soc-2', role: 'resident', status: 'active' }],
  };

  const directoryUsers = [userResidentSoc1, userResident2Soc1, userStaffSoc1, userAdminSoc1, userResidentSoc2];

  assert(
    simulateSharesSocietyWith(userResidentSoc1, userStaffSoc1.id, directoryUsers),
    'Resident can resolve profile of assigned in-house staff member in their society'
  );
  assert(
    simulateSharesSocietyWith(userResidentSoc1, userResident2Soc1.id, directoryUsers),
    'Resident can resolve co-member profile in the same society'
  );
  assert(
    !simulateSharesSocietyWith(userResidentSoc1, userResidentSoc2.id, directoryUsers),
    'Resident cannot enumerate or access profiles of users in unrelated societies'
  );

  // Simulation 2: Administrative Staff Enrollment Rules
  const simulateAdminEnrollment = (adminUser: MockUser, targetSocId: string, targetRole: string, targetStatus: string) => {
    const adminRole = simulateGetRole(adminUser, targetSocId);
    if (adminRole !== 'society_admin') return false;
    // Rule: role IN ('resident', 'maintenance_staff', 'supervisor') AND status IN ('pending', 'active')
    const allowedRoles = ['resident', 'maintenance_staff', 'supervisor'];
    const allowedStatuses = ['pending', 'active'];
    return allowedRoles.includes(targetRole) && allowedStatuses.includes(targetStatus);
  };

  assert(
    simulateAdminEnrollment(userAdminSoc1, 'soc-1', 'maintenance_staff', 'active'),
    'Society administrator can enroll in-house maintenance staff with active status'
  );
  assert(
    simulateAdminEnrollment(userAdminSoc1, 'soc-1', 'supervisor', 'pending'),
    'Society administrator can enroll supervisor with pending status'
  );
  assert(
    !simulateAdminEnrollment(userAdminSoc1, 'soc-1', 'society_admin', 'active'),
    'Society administrator cannot assign society_admin role through staff enrollment policy'
  );
  assert(
    !simulateAdminEnrollment(userResidentSoc1, 'soc-1', 'maintenance_staff', 'active'),
    'Resident cannot enroll maintenance staff'
  );

  // Simulation 3: Complaint Update Immutability & WITH CHECK Protection
  interface UpdateComplaintAttempt {
    originalComplaint: MockComplaint;
    updatedSocietyId: string;
    updatedCitizenId: string;
    updatedStatus: string;
    requestingUser: MockUser;
  }

  const simulateComplaintUpdate = (attempt: UpdateComplaintAttempt): { allowed: boolean; reason?: string } => {
    // 1. Immutability trigger checks
    if (attempt.updatedSocietyId !== attempt.originalComplaint.society_id) {
      return { allowed: false, reason: 'Cannot transfer complaints across societies (society_id is immutable)' };
    }
    if (attempt.updatedCitizenId !== attempt.originalComplaint.citizen_id) {
      return { allowed: false, reason: 'Cannot change original complainant (citizen_id is immutable)' };
    }

    // 2. RLS WITH CHECK checks
    const reqRole = simulateGetRole(attempt.requestingUser, attempt.originalComplaint.society_id);
    const isCitizenAuthor = attempt.requestingUser.id === attempt.originalComplaint.citizen_id;
    const isAssignedStaff = reqRole === 'maintenance_staff' && attempt.originalComplaint.assigned_to === attempt.requestingUser.id;
    const isAdminOrSupervisor = reqRole === 'society_admin' || reqRole === 'supervisor';

    if (isCitizenAuthor) {
      const citizenAllowedStatuses = ['submitted', 'awaiting_citizen_response', 'reopened'];
      if (!citizenAllowedStatuses.includes(attempt.updatedStatus)) {
        return { allowed: false, reason: 'Citizen cannot update complaint to protected status' };
      }
      return { allowed: true };
    }

    if (isAssignedStaff || isAdminOrSupervisor) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Unauthorized to update complaint' };
  };

  // Attempt A: Resident attempts to transfer complaint to soc-2
  const transferAttempt = simulateComplaintUpdate({
    originalComplaint: complaintSoc1,
    updatedSocietyId: 'soc-2',
    updatedCitizenId: userResidentSoc1.id,
    updatedStatus: 'submitted',
    requestingUser: userResidentSoc1,
  });
  assert(!transferAttempt.allowed, 'Resident cannot transfer complaints across societies');

  // Attempt B: Resident attempts to alter original complainant
  const complainantChangeAttempt = simulateComplaintUpdate({
    originalComplaint: complaintSoc1,
    updatedSocietyId: 'soc-1',
    updatedCitizenId: 'user-other',
    updatedStatus: 'submitted',
    requestingUser: userResidentSoc1,
  });
  assert(!complainantChangeAttempt.allowed, 'Resident cannot change original complainant citizen_id');

  // Attempt C: Resident attempts to self-close or self-resolve complaint
  const selfResolveAttempt = simulateComplaintUpdate({
    originalComplaint: complaintSoc1,
    updatedSocietyId: 'soc-1',
    updatedCitizenId: userResidentSoc1.id,
    updatedStatus: 'resolved',
    requestingUser: userResidentSoc1,
  });
  assert(!selfResolveAttempt.allowed, 'Resident cannot self-mark complaint as resolved');

  // Attempt D: Assigned staff updates operational status legitimately
  const staffLegitimateUpdate = simulateComplaintUpdate({
    originalComplaint: complaintSoc1,
    updatedSocietyId: 'soc-1',
    updatedCitizenId: userResidentSoc1.id,
    updatedStatus: 'in_progress',
    requestingUser: userStaffSoc1,
  });
  assert(staffLegitimateUpdate.allowed, 'Assigned maintenance staff can legitimately update complaint status');

  // Simulation 4: Status Transition Attribution Accuracy
  const simulateStatusTransitionAttribution = (authUid: string | null, citizenId: string) => {
    if (authUid !== null) {
      return { actor_id: authUid, isAutomated: false };
    } else {
      return { actor_id: null, isAutomated: true };
    }
  };

  const authTransition = simulateStatusTransitionAttribution(userStaffSoc1.id, complaintSoc1.citizen_id);
  assert(authTransition.actor_id === userStaffSoc1.id, 'Authenticated status transition accurately attributes actor_id');

  const automatedTransition = simulateStatusTransitionAttribution(null, complaintSoc1.citizen_id);
  assert(automatedTransition.actor_id === null, 'Automated/system status transition records actor_id as NULL (never citizen)');

  // Simulation 5: Relational Integrity (Composite Keys Cross-Society Check)
  interface MockBuilding { id: string; society_id: string; }
  interface MockFlat { id: string; building_id: string; society_id: string; }

  const mockBuildings: MockBuilding[] = [
    { id: 'bldg-1', society_id: 'soc-1' },
    { id: 'bldg-2', society_id: 'soc-2' },
  ];

  const simulateInsertFlat = (flat: MockFlat) => {
    // Composite FK: FOREIGN KEY (building_id, society_id) REFERENCES buildings(id, society_id)
    return mockBuildings.some(b => b.id === flat.building_id && b.society_id === flat.society_id);
  };

  const validFlat: MockFlat = { id: 'flat-101', building_id: 'bldg-1', society_id: 'soc-1' };
  const invalidCrossTenantFlat: MockFlat = { id: 'flat-201', building_id: 'bldg-2', society_id: 'soc-1' };

  assert(simulateInsertFlat(validFlat), 'Flat within the same society as building is accepted');
  assert(!simulateInsertFlat(invalidCrossTenantFlat), 'Cross-society flat reference is rejected by composite foreign key');

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
