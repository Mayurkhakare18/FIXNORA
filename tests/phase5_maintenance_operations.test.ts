// ==============================================================================
// SmartResolve Phase 5 Automated Maintenance Operations & Assignment Test Suite
// Verifies staff assignment, eligibility, duplicate prevention, routing corrections,
// job lifecycle transitions, worker isolation, and internal notes privacy
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
// In-Memory Simulation Fixtures
// ------------------------------------------------------------------------------
const MOCK_SOCIETY_A = '11111111-1111-1111-1111-111111111111';
const MOCK_SOCIETY_B = '22222222-2222-2222-2222-222222222222';

const MOCK_RESIDENT_A = 'res-aaaa-1111';
const MOCK_STAFF_A1 = 'staff-elec-1111';
const MOCK_STAFF_A2 = 'staff-plumb-2222';
const MOCK_SUPERVISOR_A = 'sup-aaaa-1111';
const MOCK_ADMIN_A = 'admin-aaaa-1111';
const MOCK_STAFF_B = 'staff-bbbb-2222';

interface MockMembership {
  user_id: string;
  society_id: string;
  role: 'resident' | 'society_admin' | 'maintenance_staff' | 'supervisor';
  status: 'pending' | 'active';
  staff_designation?: string;
}

const mockMemberships: MockMembership[] = [
  { user_id: MOCK_RESIDENT_A, society_id: MOCK_SOCIETY_A, role: 'resident', status: 'active' },
  { user_id: MOCK_STAFF_A1, society_id: MOCK_SOCIETY_A, role: 'maintenance_staff', status: 'active', staff_designation: 'Senior Electrician' },
  { user_id: MOCK_STAFF_A2, society_id: MOCK_SOCIETY_A, role: 'maintenance_staff', status: 'active', staff_designation: 'Master Plumber' },
  { user_id: MOCK_SUPERVISOR_A, society_id: MOCK_SOCIETY_A, role: 'supervisor', status: 'active', staff_designation: 'Maintenance Supervisor' },
  { user_id: MOCK_ADMIN_A, society_id: MOCK_SOCIETY_A, role: 'society_admin', status: 'active' },
  { user_id: 'pending-tech-id', society_id: MOCK_SOCIETY_A, role: 'maintenance_staff', status: 'pending' },
  { user_id: MOCK_STAFF_B, society_id: MOCK_SOCIETY_B, role: 'maintenance_staff', status: 'active', staff_designation: 'Electrician Society B' },
];

interface MockDepartment {
  id: string;
  society_id: string;
  name: string;
}

const mockDepartments: MockDepartment[] = [
  { id: 'dept-elec', society_id: MOCK_SOCIETY_A, name: 'Electrical & Power' },
  { id: 'dept-water', society_id: MOCK_SOCIETY_A, name: 'Water Supply & Plumbing' },
  { id: 'dept-b', society_id: MOCK_SOCIETY_B, name: 'Society B Department' },
];

interface MockCategory {
  id: string;
  society_id: string;
  department_id: string;
  name: string;
}

const mockCategories: MockCategory[] = [
  { id: 'cat-lights', society_id: MOCK_SOCIETY_A, department_id: 'dept-elec', name: 'Streetlight & Common Area Lighting' },
  { id: 'cat-pumps', society_id: MOCK_SOCIETY_A, department_id: 'dept-water', name: 'Water Motor Fault' },
];

interface MockAssignment {
  id: string;
  complaint_id: string;
  society_id: string;
  assigned_to_user_id: string;
  assigned_by_user_id: string;
  department_id: string;
  status: 'assigned' | 'accepted' | 'rejected' | 'in_progress' | 'completed' | 'reassigned';
  reassigned_reason?: string;
  target_deadline?: string;
}

interface MockJob {
  id: string;
  society_id: string;
  complaint_id: string;
  assigned_staff_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  labor_hours: number;
  material_cost: number;
  repair_notes?: string;
}

async function runPhase5Tests() {
  console.log('================================================================');
  console.log('SMARTRESOLVE PHASE 5: MAINTENANCE OPERATIONS & ASSIGNMENT TESTS');
  console.log('================================================================\n');

  const rootDir = process.cwd();

  // ----------------------------------------------------------------------------
  // SECTION 1: Static Code, Schema & Migration 9 Inspection
  // ----------------------------------------------------------------------------
  console.log('[Section 1] Static Code, Schema & Migration 9 Inspection:');

  const mig9Path = path.join(rootDir, 'supabase', 'migrations', '20261020000009_maintenance_operations_and_assignments.sql');
  assert(fs.existsSync(mig9Path), 'Migration 9 (maintenance operations & assignments) exists', 'static');

  const mig9Content = fs.readFileSync(mig9Path, 'utf8');
  assert(
    mig9Content.includes('uq_active_complaint_assignment'),
    'Migration 9 defines partial unique index uq_active_complaint_assignment',
    'static'
  );
  assert(
    mig9Content.includes('WHERE status IN (\'assigned\', \'accepted\', \'in_progress\')'),
    'Partial unique index restricts duplicate active assignments on a single complaint',
    'static'
  );
  assert(
    mig9Content.includes('assignments_select'),
    'Migration 9 enhances assignments_select policy with resident visibility',
    'static'
  );
  assert(
    mig9Content.includes('maintenance_jobs_update') && mig9Content.includes('WITH CHECK'),
    'Migration 9 hardens maintenance_jobs_update with explicit WITH CHECK policy',
    'static'
  );
  assert(
    mig9Content.includes('get_eligible_society_staff'),
    'Migration 9 defines get_eligible_society_staff helper function',
    'static'
  );

  // Service inspection
  const servicePath = path.join(rootDir, 'src', 'lib', 'maintenanceService.ts');
  assert(fs.existsSync(servicePath), 'src/lib/maintenanceService.ts exists', 'static');

  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  assert(serviceContent.includes('fetchEligibleSocietyStaff'), 'maintenanceService exports fetchEligibleSocietyStaff', 'static');
  assert(serviceContent.includes('assignComplaintToStaff'), 'maintenanceService exports assignComplaintToStaff', 'static');
  assert(serviceContent.includes('reassignComplaint'), 'maintenanceService exports reassignComplaint', 'static');
  assert(serviceContent.includes('correctComplaintRouting'), 'maintenanceService exports correctComplaintRouting', 'static');
  assert(serviceContent.includes('fetchStaffAssignedQueue'), 'maintenanceService exports fetchStaffAssignedQueue', 'static');
  assert(serviceContent.includes('acknowledgeAssignment'), 'maintenanceService exports acknowledgeAssignment', 'static');
  assert(serviceContent.includes('startJobWork'), 'maintenanceService exports startJobWork', 'static');
  assert(serviceContent.includes('completeJobWork'), 'maintenanceService exports completeJobWork', 'static');
  assert(serviceContent.includes('addComplaintComment'), 'maintenanceService exports addComplaintComment', 'static');

  // UI inspection
  const officerPath = path.join(rootDir, 'src', 'pages', 'officer', 'OfficerDashboard.tsx');
  assert(fs.existsSync(officerPath), 'OfficerDashboard.tsx exists', 'static');
  const officerContent = fs.readFileSync(officerPath, 'utf8');
  assert(officerContent.includes('handleAcknowledge'), 'OfficerDashboard provides task acceptance action', 'static');
  assert(officerContent.includes('handleStartWork'), 'OfficerDashboard provides work commencement action', 'static');
  assert(officerContent.includes('handleCompleteSubmit'), 'OfficerDashboard provides completion & notes recording modal', 'static');

  const deptPath = path.join(rootDir, 'src', 'pages', 'department', 'DepartmentDashboard.tsx');
  assert(fs.existsSync(deptPath), 'DepartmentDashboard.tsx exists', 'static');
  const deptContent = fs.readFileSync(deptPath, 'utf8');
  assert(deptContent.includes('handleAssignSubmit'), 'DepartmentDashboard provides staff assignment action', 'static');
  assert(deptContent.includes('handleReassignSubmit'), 'DepartmentDashboard provides reassignment modal with justification', 'static');
  assert(deptContent.includes('handleRoutingSubmit'), 'DepartmentDashboard provides department routing correction action', 'static');

  const adminPath = path.join(rootDir, 'src', 'pages', 'admin', 'AdminDashboard.tsx');
  assert(fs.existsSync(adminPath), 'AdminDashboard.tsx exists', 'static');
  const adminContent = fs.readFileSync(adminPath, 'utf8');
  assert(adminContent.includes('handleAssignSubmit'), 'AdminDashboard provides technician assignment modal', 'static');

  // ----------------------------------------------------------------------------
  // SECTION 2: Simulating Staff Eligibility & Society Membership
  // ----------------------------------------------------------------------------
  console.log('\n[Section 2] Simulating Staff Eligibility & Society Membership:');

  function isStaffEligible(societyId: string, userId: string): boolean {
    const mem = mockMemberships.find(m => m.society_id === societyId && m.user_id === userId);
    if (!mem) return false;
    return mem.status === 'active' && (mem.role === 'maintenance_staff' || mem.role === 'supervisor');
  }

  assert(isStaffEligible(MOCK_SOCIETY_A, MOCK_STAFF_A1), 'Active technician in Society A is eligible for assignment', 'simulated');
  assert(isStaffEligible(MOCK_SOCIETY_A, MOCK_SUPERVISOR_A), 'Active supervisor in Society A is eligible for assignment', 'simulated');
  assert(!isStaffEligible(MOCK_SOCIETY_A, MOCK_RESIDENT_A), 'Resident in Society A is NOT eligible for staff assignment', 'simulated');
  assert(!isStaffEligible(MOCK_SOCIETY_A, 'pending-tech-id'), 'Pending technician is NOT eligible for staff assignment', 'simulated');
  assert(
    !isStaffEligible(MOCK_SOCIETY_A, MOCK_STAFF_B),
    'Cross-society assignment denied: Staff in Society B cannot be assigned in Society A',
    'simulated'
  );

  // ----------------------------------------------------------------------------
  // SECTION 3: Simulating Staff Assignment & Duplicate Prevention
  // ----------------------------------------------------------------------------
  console.log('\n[Section 3] Simulating Staff Assignment & Duplicate Prevention:');

  const mockAssignmentsTable: MockAssignment[] = [];
  const mockJobsTable: MockJob[] = [];

  function simulateAssign(
    societyId: string,
    complaintId: string,
    staffId: string,
    assignedById: string,
    deptId: string
  ): { success: boolean; error?: string } {
    if (!isStaffEligible(societyId, staffId)) {
      return { success: false, error: 'Staff member is not eligible or not active in this society' };
    }

    // Check duplicate active assignment (simulating partial unique index)
    const existingActive = mockAssignmentsTable.find(
      a => a.complaint_id === complaintId && ['assigned', 'accepted', 'in_progress'].includes(a.status)
    );
    if (existingActive) {
      return { success: false, error: 'Complaint already has an active assignment' };
    }

    mockAssignmentsTable.push({
      id: `assign-${Date.now()}`,
      complaint_id: complaintId,
      society_id: societyId,
      assigned_to_user_id: staffId,
      assigned_by_user_id: assignedById,
      department_id: deptId,
      status: 'assigned',
    });

    mockJobsTable.push({
      id: `job-${Date.now()}`,
      society_id: societyId,
      complaint_id: complaintId,
      assigned_staff_id: staffId,
      status: 'pending',
      labor_hours: 0,
      material_cost: 0,
    });

    return { success: true };
  }

  // 1. Initial valid assignment
  const assign1 = simulateAssign(MOCK_SOCIETY_A, 'complaint-101', MOCK_STAFF_A1, MOCK_ADMIN_A, 'dept-elec');
  assert(assign1.success, 'Valid initial assignment to eligible technician succeeds', 'simulated');

  // 2. Duplicate assignment attempt
  const assignDuplicate = simulateAssign(MOCK_SOCIETY_A, 'complaint-101', MOCK_STAFF_A2, MOCK_ADMIN_A, 'dept-elec');
  assert(
    !assignDuplicate.success && assignDuplicate.error!.includes('already has an active assignment'),
    'Duplicate active assignment on same complaint is rejected by partial unique index',
    'simulated'
  );

  // 3. Reassignment simulation
  function simulateReassign(
    complaintId: string,
    newStaffId: string,
    reason: string
  ): { success: boolean; error?: string } {
    if (!reason || reason.trim().length < 5) {
      return { success: false, error: 'Reassignment reason must be at least 5 characters' };
    }

    const current = mockAssignmentsTable.find(
      a => a.complaint_id === complaintId && ['assigned', 'accepted', 'in_progress'].includes(a.status)
    );
    if (!current) {
      return { success: false, error: 'No active assignment found' };
    }

    // Mark previous as reassigned
    current.status = 'reassigned';
    current.reassigned_reason = reason;

    // Create new assignment
    mockAssignmentsTable.push({
      id: `assign-re-${Date.now()}`,
      complaint_id: complaintId,
      society_id: current.society_id,
      assigned_to_user_id: newStaffId,
      assigned_by_user_id: MOCK_ADMIN_A,
      department_id: current.department_id,
      status: 'assigned',
    });

    return { success: true };
  }

  const shortReasonReassign = simulateReassign('complaint-101', MOCK_STAFF_A2, 'No');
  assert(
    !shortReasonReassign.success && shortReasonReassign.error!.includes('at least 5 characters'),
    'Reassignment without adequate justification (>= 5 chars) is rejected',
    'simulated'
  );

  const validReassign = simulateReassign(
    'complaint-101',
    MOCK_STAFF_A2,
    'Prior technician on emergency leave; reallocating to plumbing specialist'
  );
  assert(validReassign.success, 'Valid reassignment with justification successfully updates records', 'simulated');

  // ----------------------------------------------------------------------------
  // SECTION 4: Simulating Department Routing & Correction
  // ----------------------------------------------------------------------------
  console.log('\n[Section 4] Simulating Department Routing & Correction:');

  function validateRouting(societyId: string, deptId: string, catId: string): boolean {
    const cat = mockCategories.find(c => c.id === catId && c.society_id === societyId);
    if (!cat) return false;
    return cat.department_id === deptId;
  }

  assert(
    validateRouting(MOCK_SOCIETY_A, 'dept-elec', 'cat-lights'),
    'Valid category and department combination in Society A is accepted',
    'simulated'
  );
  assert(
    !validateRouting(MOCK_SOCIETY_A, 'dept-elec', 'cat-pumps'),
    'Mismatched category/department combination is rejected by relational constraint',
    'simulated'
  );
  assert(
    !validateRouting(MOCK_SOCIETY_A, 'dept-b', 'cat-lights'),
    'Cross-society department routing is rejected',
    'simulated'
  );

  // ----------------------------------------------------------------------------
  // SECTION 5: Simulating Maintenance Job Lifecycle & Worker Isolation
  // ----------------------------------------------------------------------------
  console.log('\n[Section 5] Simulating Maintenance Job Lifecycle & Worker Isolation:');

  // Technician A2's active job
  const activeJob: MockJob = {
    id: 'job-active-101',
    society_id: MOCK_SOCIETY_A,
    complaint_id: 'complaint-101',
    assigned_staff_id: MOCK_STAFF_A2,
    status: 'pending',
    labor_hours: 0,
    material_cost: 0,
  };

  // Staff A2 (assigned technician) starts work
  function simulateJobUpdate(userId: string, job: MockJob, newStatus: 'in_progress' | 'completed', notes?: string) {
    // RLS: assigned_staff_id = auth_user_id() OR society_admin/supervisor
    const isOwner = job.assigned_staff_id === userId;
    const isSupervisor = mockMemberships.some(
      m => m.user_id === userId && m.society_id === job.society_id && ['society_admin', 'supervisor'].includes(m.role)
    );

    if (!isOwner && !isSupervisor) {
      return { success: false, error: 'Unauthorized: worker cannot mutate another technician\'s job' };
    }

    job.status = newStatus;
    if (notes) job.repair_notes = notes;
    return { success: true };
  }

  // 1. Another technician (Staff A1) attempts to modify Staff A2's job
  const unauthorizedWorkerUpdate = simulateJobUpdate(MOCK_STAFF_A1, activeJob, 'in_progress');
  assert(
    !unauthorizedWorkerUpdate.success,
    'Worker isolation: Technician A1 cannot modify jobs assigned to Technician A2',
    'simulated'
  );

  // 2. Assigned technician (Staff A2) acknowledges & starts work
  const authorizedWorkerStart = simulateJobUpdate(MOCK_STAFF_A2, activeJob, 'in_progress');
  assert(
    authorizedWorkerStart.success && activeJob.status === 'in_progress',
    'Assigned technician A2 successfully transitions job to in_progress',
    'simulated'
  );

  // 3. Assigned technician completes work with repair notes
  const completionNotes = 'Replaced 2-inch PVC valve joint, tested water flow at 4.2 bar pressure, confirmed no seepage.';
  const authorizedWorkerComplete = simulateJobUpdate(MOCK_STAFF_A2, activeJob, 'completed', completionNotes);
  assert(
    authorizedWorkerComplete.success && activeJob.status === 'completed' && activeJob.repair_notes === completionNotes,
    'Assigned technician A2 completes work with verified repair notes',
    'simulated'
  );

  // ----------------------------------------------------------------------------
  // SECTION 6: Simulating Privacy & Role Isolation
  // ----------------------------------------------------------------------------
  console.log('\n[Section 6] Simulating Privacy & Role Isolation:');

  interface MockNote {
    id: string;
    complaint_id: string;
    text: string;
    is_internal: boolean;
  }

  const notesList: MockNote[] = [
    { id: 'n1', complaint_id: 'complaint-101', text: 'Technician on-site. Tools deployed.', is_internal: false },
    { id: 'n2', complaint_id: 'complaint-101', text: 'Internal note: Substation breaker calibration required.', is_internal: true },
  ];

  function getVisibleNotes(userId: string, complaintId: string) {
    const mem = mockMemberships.find(m => m.user_id === userId);
    const isStaffOrAdmin = mem && ['maintenance_staff', 'supervisor', 'society_admin'].includes(mem.role);

    return notesList.filter(n => {
      if (n.complaint_id !== complaintId) return false;
      if (n.is_internal) return isStaffOrAdmin;
      return true;
    });
  }

  const residentView = getVisibleNotes(MOCK_RESIDENT_A, 'complaint-101');
  assert(
    residentView.length === 1 && !residentView[0].is_internal,
    'Resident tracking interface strictly excludes internal staff notes',
    'simulated'
  );

  const staffView = getVisibleNotes(MOCK_STAFF_A2, 'complaint-101');
  assert(
    staffView.length === 2 && staffView.some(n => n.is_internal),
    'Authorized maintenance staff can inspect internal technical notes',
    'simulated'
  );

  // ----------------------------------------------------------------------------
  // TEST SUMMARY & REPORTING
  // ----------------------------------------------------------------------------
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED out of ${total} total checks`);
  console.log('================================================================');

  const categories = {
    static: results.filter(r => r.category === 'static').length,
    simulated: results.filter(r => r.category === 'simulated').length,
    local_integration: results.filter(r => r.category === 'local_integration').length,
    live_supabase: results.filter(r => r.category === 'live_supabase').length,
  };

  console.log(
    `Classification: ${categories.static} Static, ${categories.simulated} Simulated, ${categories.local_integration} Local Integration, ${categories.live_supabase} Live Supabase\n`
  );

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase5Tests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
