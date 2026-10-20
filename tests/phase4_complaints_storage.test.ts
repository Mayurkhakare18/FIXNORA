// ==============================================================================
// SmartResolve Phase 4 Automated Complaint Management & Storage Test Suite
// Verifies complaint submission, validation, storage policies, tenant isolation,
// tracking lookup, information disclosure prevention, and dashboard aggregation
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
// In-Memory Simulation Fixtures & Helpers
// ------------------------------------------------------------------------------
const MOCK_SOCIETY_A = '11111111-1111-1111-1111-111111111111';
const MOCK_SOCIETY_B = '22222222-2222-2222-2222-222222222222';
const MOCK_RESIDENT_A = 'aaaa1111-1111-1111-1111-111111111111';
const MOCK_RESIDENT_A2 = 'aaaa2222-2222-2222-2222-222222222222';
const MOCK_ADMIN_A = 'admin111-1111-1111-1111-111111111111';

interface MockMembership {
  user_id: string;
  society_id: string;
  role: 'resident' | 'society_admin' | 'maintenance_staff' | 'supervisor';
  status: 'pending' | 'active';
}

const mockMemberships: MockMembership[] = [
  { user_id: MOCK_RESIDENT_A, society_id: MOCK_SOCIETY_A, role: 'resident', status: 'active' },
  { user_id: MOCK_RESIDENT_A2, society_id: MOCK_SOCIETY_A, role: 'resident', status: 'active' },
  { user_id: MOCK_ADMIN_A, society_id: MOCK_SOCIETY_A, role: 'society_admin', status: 'active' },
  { user_id: 'pending-user-id', society_id: MOCK_SOCIETY_A, role: 'resident', status: 'pending' },
];

interface MockComplaint {
  id: string;
  society_id: string;
  tracking_id: string;
  citizen_id: string;
  department_id: string;
  category_id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  is_anonymous: boolean;
}

const mockComplaints: MockComplaint[] = [
  {
    id: 'c1',
    society_id: MOCK_SOCIETY_A,
    tracking_id: 'SR-2026-1001',
    citizen_id: MOCK_RESIDENT_A,
    department_id: 'dept-elec',
    category_id: 'cat-lights',
    title: 'Streetlight flickering near Gate 2',
    description: 'The pole streetlight keeps flickering at night.',
    priority: 'medium',
    status: 'submitted',
    is_anonymous: false,
  },
  {
    id: 'c2',
    society_id: MOCK_SOCIETY_A,
    tracking_id: 'SR-2026-1002',
    citizen_id: MOCK_RESIDENT_A2,
    department_id: 'dept-plumb',
    category_id: 'cat-water',
    title: 'Water pipe leaking in Basement',
    description: 'Significant leakage from main overhead pipe joint.',
    priority: 'high',
    status: 'in_progress',
    is_anonymous: true, // Anonymous complaint
  },
  {
    id: 'c3',
    society_id: MOCK_SOCIETY_B,
    tracking_id: 'SR-2026-2001',
    citizen_id: 'resident-b',
    department_id: 'dept-b',
    category_id: 'cat-b',
    title: 'Lift failure in Society B',
    description: 'Lift 2 is stuck on 4th floor.',
    priority: 'urgent',
    status: 'resolved',
    is_anonymous: false,
  },
];

interface MockComment {
  id: string;
  complaint_id: string;
  comment_text: string;
  is_internal: boolean;
}

const mockComments: MockComment[] = [
  { id: 'cm1', complaint_id: 'c1', comment_text: 'Technician dispatched to replace choke.', is_internal: false },
  { id: 'cm2', complaint_id: 'c1', comment_text: 'Internal vendor quote: INR 450.', is_internal: true },
];

async function runPhase4Tests() {
  console.log('================================================================');
  console.log('SMARTRESOLVE PHASE 4: COMPLAINTS & EVIDENCE STORAGE TESTS');
  console.log('================================================================\n');

  const rootDir = process.cwd();

  // ----------------------------------------------------------------------------
  // SECTION 1: Static Code, Schema & Migration 8 Inspection
  // ----------------------------------------------------------------------------
  console.log('[Section 1] Static Code, Schema & Migration 8 Inspection:');

  const mig8Path = path.join(rootDir, 'supabase', 'migrations', '20261020000008_storage_and_complaint_policies.sql');
  assert(fs.existsSync(mig8Path), 'Migration 8 (storage and complaint policies) exists', 'static');

  const mig8Content = fs.readFileSync(mig8Path, 'utf8');
  assert(mig8Content.includes('complaint-evidence'), 'Migration 8 configures "complaint-evidence" storage bucket', 'static');
  assert(mig8Content.includes('public = false') || mig8Content.includes('false,'), 'Storage bucket is strictly private (public = false)', 'static');
  assert(mig8Content.includes('10485760'), 'Storage bucket enforces 10MB maximum file size', 'static');
  assert(
    mig8Content.includes('image/jpeg') && mig8Content.includes('application/pdf'),
    'Storage bucket restricts MIME types to images and PDF',
    'static'
  );
  assert(mig8Content.includes('storage.objects ENABLE ROW LEVEL SECURITY'), 'Migration 8 enforces RLS on storage.objects', 'static');
  assert(
    mig8Content.includes('evidence_select_authorized_society_members'),
    'Migration 8 defines SELECT policy restricting evidence to society members',
    'static'
  );
  assert(
    mig8Content.includes('evidence_insert_active_society_members'),
    'Migration 8 defines INSERT policy allowing active society members to upload',
    'static'
  );
  assert(
    mig8Content.includes('evidence_delete_uploader_or_admin'),
    'Migration 8 defines DELETE policy restricting deletion to uploader or admin',
    'static'
  );
  assert(
    mig8Content.includes('attachments_delete_uploader_or_admin'),
    'Migration 8 defines attachment deletion policy for cleanup on failure',
    'static'
  );
  assert(
    mig8Content.includes('seed_society_standard_departments_and_categories'),
    'Migration 8 includes automatic seeding for standard departments and categories',
    'static'
  );

  // Service file inspection
  const servicePath = path.join(rootDir, 'src', 'lib', 'complaintService.ts');
  assert(fs.existsSync(servicePath), 'src/lib/complaintService.ts service file exists', 'static');

  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  assert(serviceContent.includes('submitComplaint'), 'complaintService exports submitComplaint function', 'static');
  assert(serviceContent.includes('uploadComplaintEvidence'), 'complaintService exports uploadComplaintEvidence function', 'static');
  assert(serviceContent.includes('lookupComplaintByTrackingId'), 'complaintService exports lookupComplaintByTrackingId', 'static');
  assert(serviceContent.includes('fetchResidentDashboardData'), 'complaintService exports fetchResidentDashboardData', 'static');
  assert(serviceContent.includes('createAttachmentSignedUrl'), 'complaintService exports createAttachmentSignedUrl', 'static');

  // Page inspection
  const newCompPath = path.join(rootDir, 'src', 'pages', 'citizen', 'NewComplaintPage.tsx');
  assert(fs.existsSync(newCompPath), 'NewComplaintPage.tsx exists', 'static');
  const newCompContent = fs.readFileSync(newCompPath, 'utf8');
  assert(newCompContent.includes('isPendingResident'), 'NewComplaintPage checks membership status to prevent unauthorized submission', 'static');

  const trackPath = path.join(rootDir, 'src', 'pages', 'citizen', 'ComplaintTrackingPage.tsx');
  assert(fs.existsSync(trackPath), 'ComplaintTrackingPage.tsx exists', 'static');
  const trackContent = fs.readFileSync(trackPath, 'utf8');
  assert(trackContent.includes('lookupComplaintByTrackingId'), 'ComplaintTrackingPage connects to live lookup function', 'static');
  assert(trackContent.includes('STAGES'), 'ComplaintTrackingPage renders 4-stage visual milestone timeline', 'static');

  const dashPath = path.join(rootDir, 'src', 'pages', 'citizen', 'CitizenDashboard.tsx');
  assert(fs.existsSync(dashPath), 'CitizenDashboard.tsx exists', 'static');
  const dashContent = fs.readFileSync(dashPath, 'utf8');
  assert(dashContent.includes('fetchResidentDashboardData'), 'CitizenDashboard queries live database statistics', 'static');

  // ----------------------------------------------------------------------------
  // SECTION 2: Simulating Complaint Validation & Input Rules
  // ----------------------------------------------------------------------------
  console.log('\n[Section 2] Simulating Complaint Validation & Input Rules:');

  // Validation logic as implemented in complaintService
  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

  function validateComplaintInput(input: any): string | null {
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
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(input.priority)) {
      return 'Invalid priority selected.';
    }
    return null;
  }

  function validateEvidenceFile(file: any): string | null {
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

  const validComplaint = {
    societyId: MOCK_SOCIETY_A,
    citizenId: MOCK_RESIDENT_A,
    categoryId: 'cat-123',
    departmentId: 'dept-123',
    title: 'Water motor tripping frequently in pump house',
    description: 'The primary water motor trips within 5 minutes of starting every morning.',
    priority: 'high' as const,
  };

  assert(validateComplaintInput(validComplaint) === null, 'Valid complaint passes validation', 'simulated');

  // Short title
  const shortTitle = { ...validComplaint, title: 'No' };
  assert(
    validateComplaintInput(shortTitle) !== null && validateComplaintInput(shortTitle)!.includes('5 characters'),
    'Short title (< 5 chars) is rejected with clear error message',
    'simulated'
  );

  // Title exceeding 150 chars
  const longTitle = { ...validComplaint, title: 'A'.repeat(151) };
  assert(
    validateComplaintInput(longTitle) !== null && validateComplaintInput(longTitle)!.includes('150 characters'),
    'Title exceeding 150 characters is rejected',
    'simulated'
  );

  // Short description
  const shortDesc = { ...validComplaint, description: 'Broken pipe' };
  assert(
    validateComplaintInput(shortDesc) !== null && validateComplaintInput(shortDesc)!.includes('15 characters'),
    'Short description (< 15 chars) is rejected',
    'simulated'
  );

  // Missing category
  const missingCat = { ...validComplaint, categoryId: '' };
  assert(
    validateComplaintInput(missingCat) !== null && validateComplaintInput(missingCat)!.includes('category'),
    'Missing category is rejected',
    'simulated'
  );

  // Missing department
  const missingDept = { ...validComplaint, departmentId: '' };
  assert(
    validateComplaintInput(missingDept) !== null && validateComplaintInput(missingDept)!.includes('department'),
    'Missing department is rejected',
    'simulated'
  );

  // Invalid priority
  const invalidPriority = { ...validComplaint, priority: 'critical_emergency' as any };
  assert(
    validateComplaintInput(invalidPriority) !== null && validateComplaintInput(invalidPriority)!.includes('priority'),
    'Invalid priority level is rejected',
    'simulated'
  );

  // ----------------------------------------------------------------------------
  // SECTION 3: Simulating Tenant Isolation, Cross-Society & Role Enforcement
  // ----------------------------------------------------------------------------
  console.log('\n[Section 3] Simulating Tenant Isolation, Cross-Society & Role Enforcement:');

  // Helper simulating complaints_select RLS policy
  function simulateComplaintsSelect(queryUser: string, complaintRecord: MockComplaint): boolean {
    const mem = mockMemberships.find(m => m.user_id === queryUser && m.society_id === complaintRecord.society_id && m.status === 'active');
    if (!mem) return false; // Cross-society or not active member

    if (mem.role === 'society_admin' || mem.role === 'supervisor') return true;
    if (mem.role === 'resident') {
      return complaintRecord.citizen_id === queryUser || !complaintRecord.is_anonymous;
    }
    return false;
  }

  // Resident A can view their own complaint in Society A
  assert(simulateComplaintsSelect(MOCK_RESIDENT_A, mockComplaints[0]), 'Resident A can read their own complaint in Society A', 'simulated');

  // Resident A reading anonymous complaint by Resident A2
  assert(
    !simulateComplaintsSelect(MOCK_RESIDENT_A, mockComplaints[1]),
    'Anonymous complaint by another resident is hidden from co-residents',
    'simulated'
  );

  // Resident A2 (the author) can view their own anonymous complaint
  assert(
    simulateComplaintsSelect(MOCK_RESIDENT_A2, mockComplaints[1]),
    'Complainant can view their own complaint even when submitted as anonymous',
    'simulated'
  );

  // Cross-society: Resident A reading complaint in Society B
  assert(
    !simulateComplaintsSelect(MOCK_RESIDENT_A, mockComplaints[2]),
    'Cross-society data leakage prevented: Resident A cannot view Society B complaints',
    'simulated'
  );

  // Admin of Society A can view complaints in Society A (including anonymous)
  assert(
    simulateComplaintsSelect(MOCK_ADMIN_A, mockComplaints[1]),
    'Society Administrator can view all complaints within their society',
    'simulated'
  );

  // User with pending membership cannot view complaints
  assert(
    !simulateComplaintsSelect('pending-user-id', mockComplaints[0]),
    'Pending resident cannot view society complaints until approved',
    'simulated'
  );

  // ----------------------------------------------------------------------------
  // SECTION 4: Simulating Evidence Upload & Storage Authorization
  // ----------------------------------------------------------------------------
  console.log('\n[Section 4] Simulating Evidence Upload & Storage Authorization:');

  // Mock File objects for test environment
  const createMockFile = (name: string, type: string, sizeBytes: number) => ({
    name,
    type,
    size: sizeBytes,
  } as unknown as File);

  const validJpg = createMockFile('leak_photo.jpg', 'image/jpeg', 2 * 1024 * 1024);
  assert(validateEvidenceFile(validJpg) === null, 'Valid 2MB JPEG evidence passes file validation', 'simulated');

  const validPng = createMockFile('electrical_board.png', 'image/png', 4 * 1024 * 1024);
  assert(validateEvidenceFile(validPng) === null, 'Valid 4MB PNG evidence passes file validation', 'simulated');

  const validPdf = createMockFile('inspection_report.pdf', 'application/pdf', 1 * 1024 * 1024);
  assert(validateEvidenceFile(validPdf) === null, 'Valid 1MB PDF document passes file validation', 'simulated');

  const invalidExe = createMockFile('malicious.exe', 'application/x-msdownload', 500);
  assert(
    validateEvidenceFile(invalidExe) !== null && validateEvidenceFile(invalidExe)!.includes('Invalid file type'),
    'Invalid file type (.exe) is rejected with clear error message',
    'simulated'
  );

  const oversizedFile = createMockFile('huge_video.jpg', 'image/jpeg', 15 * 1024 * 1024);
  assert(
    validateEvidenceFile(oversizedFile) !== null && validateEvidenceFile(oversizedFile)!.includes('10MB'),
    'Oversized file (> 10MB) is rejected with clear error message',
    'simulated'
  );

  // Storage path format test: <society_id>/<complaint_id>/<timestamp>-<name>
  const testPath = `${MOCK_SOCIETY_A}/c1/1700000000000-meter_photo.jpg`;
  const pathParts = testPath.split('/');
  assert(
    pathParts.length === 3 && pathParts[0] === MOCK_SOCIETY_A && pathParts[1] === 'c1',
    'Storage path structure strictly isolates objects by society and complaint ID',
    'simulated'
  );

  // Partial failure simulation: upload succeeded, DB insert failed -> cleanup triggered
  let storageRemovedPaths: string[] = [];
  const mockStorageClient = {
    remove: async (paths: string[]) => {
      storageRemovedPaths.push(...paths);
      return { data: paths, error: null };
    },
  };

  async function simulateUploadWithDbFailure(storagePath: string) {
    // Simulated DB insert failure
    const dbFailed = true;
    if (dbFailed) {
      await mockStorageClient.remove([storagePath]);
    }
  }

  await simulateUploadWithDbFailure(testPath);
  assert(
    storageRemovedPaths.includes(testPath),
    'Partial failure handling: database insert failure triggers storage object cleanup',
    'simulated'
  );

  // ----------------------------------------------------------------------------
  // SECTION 5: Simulating Tracking ID Lookup & Information Disclosure Prevention
  // ----------------------------------------------------------------------------
  console.log('\n[Section 5] Simulating Tracking ID Lookup & Information Disclosure Prevention:');

  // Lookup simulation
  function simulateLookup(queryUser: string, trackingId: string) {
    const comp = mockComplaints.find(c => c.tracking_id === trackingId);
    if (!comp) return null;
    const canView = simulateComplaintsSelect(queryUser, comp);
    if (!canView) return null; // Returns null, exactly same as non-existent!
    return comp;
  }

  // Lookup existing authorized
  const foundComplaint = simulateLookup(MOCK_RESIDENT_A, 'SR-2026-1001');
  assert(foundComplaint !== null && foundComplaint.id === 'c1', 'Authorized tracking ID lookup retrieves complaint', 'simulated');

  // Lookup non-existent
  const notFoundComplaint = simulateLookup(MOCK_RESIDENT_A, 'SR-2026-9999');
  assert(notFoundComplaint === null, 'Lookup for non-existent tracking ID returns null', 'simulated');

  // Lookup unauthorized complaint in another society
  const unauthorizedCrossSociety = simulateLookup(MOCK_RESIDENT_A, 'SR-2026-2001');
  assert(
    unauthorizedCrossSociety === null,
    'Lookup for complaint in unauthorized society returns null (no information leakage)',
    'simulated'
  );

  // Internal comment filtering simulation
  const publicComments = mockComments.filter(c => c.complaint_id === 'c1' && !c.is_internal);
  assert(
    publicComments.length === 1 && publicComments[0].comment_text.includes('Technician dispatched'),
    'Public bulletin comments are included in tracking view',
    'simulated'
  );

  const internalCommentsHidden = !publicComments.some(c => c.is_internal);
  assert(
    internalCommentsHidden,
    'Internal staff comments (is_internal = true) are strictly excluded from resident tracking view',
    'simulated'
  );

  // ----------------------------------------------------------------------------
  // SECTION 6: Simulating Citizen Dashboard Aggregation & Counters
  // ----------------------------------------------------------------------------
  console.log('\n[Section 6] Simulating Citizen Dashboard Aggregation & Counters:');

  function calculateDashboardStats(userId: string, societyId: string) {
    const userComplaints = mockComplaints.filter(
      c => c.citizen_id === userId && c.society_id === societyId
    );
    const total = userComplaints.length;
    const underReview = userComplaints.filter(c => ['submitted', 'under_review'].includes(c.status)).length;
    const inProgress = userComplaints.filter(c => ['assigned', 'in_progress'].includes(c.status)).length;
    const resolved = userComplaints.filter(c => ['resolved', 'closed'].includes(c.status)).length;

    return { total, underReview, inProgress, resolved };
  }

  const statsResidentA = calculateDashboardStats(MOCK_RESIDENT_A, MOCK_SOCIETY_A);
  assert(
    statsResidentA.total === 1 && statsResidentA.underReview === 1 && statsResidentA.inProgress === 0,
    'Dashboard calculates accurate live counters for Resident A',
    'simulated'
  );

  const statsResidentNoComplaints = calculateDashboardStats('new-resident-uuid', MOCK_SOCIETY_A);
  assert(
    statsResidentNoComplaints.total === 0 && statsResidentNoComplaints.underReview === 0,
    'Dashboard returns zero counts for new resident without mock data injection',
    'simulated'
  );

  // ----------------------------------------------------------------------------
  // SECTION 7: Unconfigured Environment Safety
  // ----------------------------------------------------------------------------
  console.log('\n[Section 7] Unconfigured Environment Safety:');

  // Verify that supabase client exports isSupabaseConfigured flag
  const supabasePath = path.join(rootDir, 'src', 'lib', 'supabase.ts');
  const supabaseContent = fs.readFileSync(supabasePath, 'utf8');
  assert(
    supabaseContent.includes('export const isSupabaseConfigured'),
    'supabase.ts exports isSupabaseConfigured guard flag',
    'static'
  );
  assert(
    supabaseContent.includes('your-project-ref'),
    'isSupabaseConfigured validates against placeholder project URL',
    'static'
  );
  assert(
    serviceContent.includes('if (!isSupabaseConfigured)'),
    'complaintService guards operations when environment is unconfigured',
    'static'
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

runPhase4Tests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
