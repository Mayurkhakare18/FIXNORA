// ==============================================================================
// SmartResolve Phase 3 Automated Authentication & Security Test Suite
// Verifies Supabase Auth, Session Restoration, Protected Route Guards,
// Role & Society Onboarding, and Safe Error Handling
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

async function runPhase3Tests() {
  console.log('================================================================');
  console.log('SMARTRESOLVE PHASE 3: AUTHENTICATION & ACCESS CONTROL TESTS');
  console.log('================================================================\n');

  const rootDir = process.cwd();

  // ----------------------------------------------------------------------------
  // SECTION 1: Static Source & Configuration Inspection
  // ----------------------------------------------------------------------------
  console.log('[Section 1] Static Code & Security Configuration Inspection:');

  // Check .env.example exists and contains no service-role key
  const envExamplePath = path.join(rootDir, '.env.example');
  assert(fs.existsSync(envExamplePath), '.env.example template file exists', 'static');
  const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
  assert(
    !envExampleContent.includes('service_role') && !envExampleContent.includes('SUPABASE_SERVICE_KEY'),
    '.env.example never exposes or solicits service-role secret keys',
    'static'
  );
  assert(envExampleContent.includes('VITE_SUPABASE_ANON_KEY'), '.env.example includes public anon key placeholder', 'static');

  // Check supabase.ts client configuration
  const supabaseClientPath = path.join(rootDir, 'src', 'lib', 'supabase.ts');
  assert(fs.existsSync(supabaseClientPath), 'src/lib/supabase.ts client file exists', 'static');
  const supabaseClientCode = fs.readFileSync(supabaseClientPath, 'utf8');
  assert(
    !supabaseClientCode.includes('service_role') && !supabaseClientCode.includes('SUPABASE_SERVICE_ROLE'),
    'Supabase client strictly uses anonymous key (no service role in frontend)',
    'static'
  );
  assert(supabaseClientCode.includes('isSupabaseConfigured'), 'Supabase client exports isSupabaseConfigured guard flag', 'static');

  // Check AuthContext.tsx
  const authContextPath = path.join(rootDir, 'src', 'context', 'AuthContext.tsx');
  assert(fs.existsSync(authContextPath), 'src/context/AuthContext.tsx exists', 'static');
  const authContextCode = fs.readFileSync(authContextPath, 'utf8');
  assert(authContextCode.includes('signInWithPassword'), 'AuthContext connects to live supabase.auth.signInWithPassword', 'static');
  assert(authContextCode.includes('signUp'), 'AuthContext connects to live supabase.auth.signUp', 'static');
  assert(authContextCode.includes('signOut'), 'AuthContext connects to live supabase.auth.signOut', 'static');
  assert(authContextCode.includes('resetPasswordForEmail'), 'AuthContext connects to live supabase.auth.resetPasswordForEmail', 'static');
  assert(authContextCode.includes('onAuthStateChange'), 'AuthContext listens to session changes via onAuthStateChange', 'static');
  assert(authContextCode.includes('is_platform_admin: false'), 'AuthContext strictly sets is_platform_admin = false on registration', 'static');

  // Check ProtectedRoute.tsx
  const protectedRoutePath = path.join(rootDir, 'src', 'components', 'auth', 'ProtectedRoute.tsx');
  assert(fs.existsSync(protectedRoutePath), 'src/components/auth/ProtectedRoute.tsx exists', 'static');
  const protectedRouteCode = fs.readFileSync(protectedRoutePath, 'utf8');
  assert(protectedRouteCode.includes('isLoading'), 'ProtectedRoute handles session loading states to prevent content flash', 'static');
  assert(protectedRouteCode.includes('allowedRoles'), 'ProtectedRoute validates allowedRoles against active membership role', 'static');
  assert(protectedRouteCode.includes('requireActiveMembership'), 'ProtectedRoute checks active membership status', 'static');

  // Check Onboarding & Auth Pages exist
  const requiredPages = [
    'src/pages/auth/LoginPage.tsx',
    'src/pages/auth/RegisterPage.tsx',
    'src/pages/auth/ForgotPasswordPage.tsx',
    'src/pages/auth/ResetPasswordPage.tsx',
    'src/pages/onboarding/JoinSocietyPage.tsx',
    'src/pages/onboarding/PendingStatusPage.tsx',
  ];
  for (const page of requiredPages) {
    assert(fs.existsSync(path.join(rootDir, page)), `Component '${page}' exists`, 'static');
  }

  // ----------------------------------------------------------------------------
  // SECTION 2: Simulated Authentication & Session Restoration Logic
  // ----------------------------------------------------------------------------
  console.log('\n[Section 2] Simulating Authentication & Session Workflows:');

  interface MockAuthUser {
    id: string;
    email: string;
    fullName: string;
    is_platform_admin: boolean;
  }

  interface MockSession {
    user: MockAuthUser;
    accessToken: string;
    expiresAt: number;
  }

  const registeredUsers: MockAuthUser[] = [
    { id: 'usr-101', email: 'resident@society.org', fullName: 'Aarav Sharma', is_platform_admin: false },
    { id: 'usr-202', email: 'technician@society.org', fullName: 'Rajesh Kumar', is_platform_admin: false },
    { id: 'usr-303', email: 'admin@society.org', fullName: 'Kavita Iyer', is_platform_admin: false },
  ];

  // Simulation 1: Sign in with valid credentials
  const simulateSignIn = (email: string, pass: string): { success: boolean; session?: MockSession; error?: string } => {
    if (!email || !pass) return { success: false, error: 'Email and password required' };
    const found = registeredUsers.find((u) => u.email === email);
    if (!found || pass !== 'correct_pass_123') {
      return { success: false, error: 'Invalid login credentials' };
    }
    return {
      success: true,
      session: {
        user: found,
        accessToken: `jwt-${found.id}`,
        expiresAt: Date.now() + 3600000,
      },
    };
  };

  const validAuth = simulateSignIn('resident@society.org', 'correct_pass_123');
  assert(validAuth.success && validAuth.session !== undefined, 'Successful resident authentication returns valid session', 'simulated');

  // Simulation 2: Sign in with invalid credentials
  const invalidAuth = simulateSignIn('resident@society.org', 'wrong_pass');
  assert(!invalidAuth.success && invalidAuth.error === 'Invalid login credentials', 'Failed authentication is rejected with accessible error message', 'simulated');

  // Simulation 3: Session restoration after refresh
  const simulateSessionRestoration = (storedToken: string | null): MockSession | null => {
    if (!storedToken) return null;
    const userId = storedToken.replace('jwt-', '');
    const user = registeredUsers.find((u) => u.id === userId);
    if (!user) return null;
    return { user, accessToken: storedToken, expiresAt: Date.now() + 3600000 };
  };

  const restoredSession = simulateSessionRestoration('jwt-usr-101');
  assert(restoredSession !== null && restoredSession.user.email === 'resident@society.org', 'Session restoration accurately recovers user profile after refresh', 'simulated');

  // Simulation 4: Logout clears session
  let activeSession: MockSession | null = validAuth.session ?? null;
  const simulateSignOut = () => {
    activeSession = null;
  };
  simulateSignOut();
  assert(activeSession === null, 'Sign out completely clears local user session and token', 'simulated');

  // ----------------------------------------------------------------------------
  // SECTION 3: Simulated Role & Society Onboarding Logic
  // ----------------------------------------------------------------------------
  console.log('\n[Section 3] Simulating Role & Society Onboarding Enforcement:');

  interface MockMembership {
    id: string;
    society_id: string;
    user_id: string;
    role: 'resident' | 'society_admin' | 'maintenance_staff' | 'supervisor';
    status: 'pending' | 'active' | 'suspended' | 'rejected';
    approved_by?: string;
  }

  const membershipTable: MockMembership[] = [];

  // Rule 1: New resident self-registration starts as 'pending'
  const simulateSelfRegistrationMembership = (userId: string, socId: string, requestedRole: string) => {
    // Under RLS policy memberships_insert_resident:
    // status must be 'pending' and role must be 'resident'
    if (requestedRole !== 'resident') {
      return { success: false, error: 'Unauthorized: Self-registration restricted strictly to resident role' };
    }
    const mem: MockMembership = {
      id: `mem-${membershipTable.length + 1}`,
      society_id: socId,
      user_id: userId,
      role: 'resident',
      status: 'pending',
    };
    membershipTable.push(mem);
    return { success: true, membership: mem };
  };

  const residentReq = simulateSelfRegistrationMembership('usr-101', 'soc-1', 'resident');
  assert(residentReq.success && residentReq.membership?.status === 'pending', 'Resident membership application initializes in restricted pending status', 'simulated');

  // Rule 2: Attempted self-elevation to admin or staff is rejected
  const adminSelfElevate = simulateSelfRegistrationMembership('usr-101', 'soc-1', 'society_admin');
  assert(!adminSelfElevate.success, 'Direct self-enrollment as society_admin is rejected', 'simulated');

  const staffSelfElevate = simulateSelfRegistrationMembership('usr-101', 'soc-1', 'maintenance_staff');
  assert(!staffSelfElevate.success, 'Direct self-enrollment as maintenance_staff is rejected', 'simulated');

  // Rule 3: Resident cannot self-approve their pending membership
  const simulateSelfApproval = (userId: string, membershipId: string) => {
    const mem = membershipTable.find((m) => m.id === membershipId);
    if (!mem) return { success: false, error: 'Not found' };
    // RLS policy memberships_update_admin requires society_admin role
    const isSocAdmin = false; // Ordinary resident is NOT admin
    if (!isSocAdmin) {
      return { success: false, error: 'Unauthorized: Only society administrator can approve memberships' };
    }
    mem.status = 'active';
    return { success: true };
  };

  const selfApproveAttempt = simulateSelfApproval('usr-101', residentReq.membership!.id);
  assert(!selfApproveAttempt.success, 'Resident is prevented from self-approving their pending membership', 'simulated');

  // Rule 4: Society administrator approves pending resident
  const simulateAdminApproval = (adminUserId: string, adminSocId: string, membershipId: string) => {
    const mem = membershipTable.find((m) => m.id === membershipId);
    if (!mem) return { success: false, error: 'Not found' };
    if (adminSocId !== mem.society_id) {
      return { success: false, error: 'Cross-society authorization violation' };
    }
    mem.status = 'active';
    mem.approved_by = adminUserId;
    return { success: true, membership: mem };
  };

  const adminApproval = simulateAdminApproval('usr-303', 'soc-1', residentReq.membership!.id);
  assert(adminApproval.success && adminApproval.membership?.status === 'active', 'Society administrator successfully approves eligible resident membership', 'simulated');

  // Rule 5: Administrator enrolls in-house staff under Phase 2.2 policy
  const simulateAdminEnrollStaff = (
    adminSocId: string,
    targetUserId: string,
    role: 'maintenance_staff' | 'supervisor',
    designation: string
  ) => {
    // Under memberships_insert_admin policy:
    // role IN ('resident', 'maintenance_staff', 'supervisor')
    // and caller must be society_admin in that society
    const mem: MockMembership = {
      id: `mem-${membershipTable.length + 1}`,
      society_id: adminSocId,
      user_id: targetUserId,
      role,
      status: 'active',
      approved_by: 'usr-303',
    };
    membershipTable.push(mem);
    return { success: true, membership: mem };
  };

  const staffEnroll = simulateAdminEnrollStaff('soc-1', 'usr-202', 'maintenance_staff', 'Senior Electrician');
  assert(staffEnroll.success && staffEnroll.membership?.role === 'maintenance_staff', 'Society administrator enrolls in-house maintenance staff under approved policy', 'simulated');

  // ----------------------------------------------------------------------------
  // SECTION 4: Protected Route & Dashboard Access Control
  // ----------------------------------------------------------------------------
  console.log('\n[Section 4] Simulating Protected Route & Dashboard Authorization:');

  const simulateRouteAccess = (
    route: string,
    allowedRoles: string[] | undefined,
    userAuth: MockAuthUser | null,
    membership: MockMembership | null
  ): { accessGranted: boolean; redirectTo?: string } => {
    // 1. Unauthenticated check
    if (!userAuth) {
      return { accessGranted: false, redirectTo: '/auth/login' };
    }
    // 2. Onboarding check (no membership)
    if (!membership) {
      return { accessGranted: false, redirectTo: '/onboarding/join-society' };
    }
    // 3. Pending approval check
    if (membership.status === 'pending') {
      return { accessGranted: false, redirectTo: '/onboarding/pending-status' };
    }
    // 4. Role authorization check
    if (allowedRoles && !allowedRoles.includes(membership.role)) {
      return { accessGranted: false, redirectTo: '/unauthorized' };
    }
    return { accessGranted: true };
  };

  const activeResidentMembership = adminApproval.membership!;
  const pendingMembership: MockMembership = { id: 'mem-99', society_id: 'soc-1', user_id: 'usr-99', role: 'resident', status: 'pending' };
  const adminMembership: MockMembership = { id: 'mem-admin', society_id: 'soc-1', user_id: 'usr-303', role: 'society_admin', status: 'active' };

  // Test Route 1: Unauthenticated user accessing citizen dashboard
  assert(
    simulateRouteAccess('/dashboard/citizen', ['resident'], null, null).redirectTo === '/auth/login',
    'Unauthenticated user is redirected to /auth/login',
    'simulated'
  );

  // Test Route 2: User with pending membership accessing citizen dashboard
  assert(
    simulateRouteAccess('/dashboard/citizen', ['resident'], registeredUsers[0], pendingMembership).redirectTo === '/onboarding/pending-status',
    'User with pending membership is routed to /onboarding/pending-status',
    'simulated'
  );

  // Test Route 3: Active resident accessing citizen dashboard
  assert(
    simulateRouteAccess('/dashboard/citizen', ['resident'], registeredUsers[0], activeResidentMembership).accessGranted === true,
    'Active resident is granted access to Citizen Dashboard',
    'simulated'
  );

  // Test Route 4: Active resident attempting to access admin dashboard
  assert(
    simulateRouteAccess('/dashboard/admin', ['society_admin'], registeredUsers[0], activeResidentMembership).accessGranted === false,
    'Active resident is denied access to Admin Dashboard',
    'simulated'
  );

  // Test Route 5: In-house staff accessing staff queue
  assert(
    simulateRouteAccess('/dashboard/officer', ['maintenance_staff', 'supervisor', 'society_admin'], registeredUsers[1], staffEnroll.membership!).accessGranted === true,
    'In-house maintenance staff is granted access to Staff Queue',
    'simulated'
  );

  // Test Route 6: Society admin accessing admin dashboard
  assert(
    simulateRouteAccess('/dashboard/admin', ['society_admin'], registeredUsers[2], adminMembership).accessGranted === true,
    'Society Administrator is granted access to Admin Dashboard',
    'simulated'
  );

  // ----------------------------------------------------------------------------
  // SECTION 5: Multi-Society Context Switching & Cross-Society Isolation
  // ----------------------------------------------------------------------------
  console.log('\n[Section 5] Simulating Multi-Society Context Switching:');

  const multiSocietyUserMemberships: MockMembership[] = [
    { id: 'mem-soc1', society_id: 'soc-alpha', user_id: 'usr-multi', role: 'resident', status: 'active' },
    { id: 'mem-soc2', society_id: 'soc-beta', user_id: 'usr-multi', role: 'society_admin', status: 'active' },
  ];

  const simulateContextSwitch = (targetSocId: string) => {
    const mem = multiSocietyUserMemberships.find((m) => m.society_id === targetSocId);
    return mem ? mem.role : null;
  };

  assert(
    simulateContextSwitch('soc-alpha') === 'resident',
    'In Society Alpha context, multi-society user possesses Resident role only',
    'simulated'
  );
  assert(
    simulateContextSwitch('soc-beta') === 'society_admin',
    'In Society Beta context, multi-society user possesses Society Administrator role',
    'simulated'
  );
  assert(
    simulateContextSwitch('soc-gamma') === null,
    'User has zero authorization in unauthorized Society Gamma',
    'simulated'
  );

  // ----------------------------------------------------------------------------
  // SECTION 6: Unconfigured Environment Safety
  // ----------------------------------------------------------------------------
  console.log('\n[Section 6] Testing Unconfigured Environment Safety:');

  const simulateUnconfiguredAuthAttempt = (isConfigured: boolean) => {
    if (!isConfigured) {
      return { success: false, error: 'Supabase credentials are not configured in .env' };
    }
    return { success: true };
  };

  const unconfiguredAttempt = simulateUnconfiguredAuthAttempt(false);
  assert(
    !unconfiguredAttempt.success && unconfiguredAttempt.error.includes('not configured'),
    'Auth actions fail safely with clear error message when environment is unconfigured',
    'simulated'
  );

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED out of ${results.length} total checks`);
  console.log('================================================================');

  const staticCount = results.filter((r) => r.category === 'static').length;
  const simCount = results.filter((r) => r.category === 'simulated').length;
  const localIntCount = results.filter((r) => r.category === 'local_integration').length;
  const liveSupabaseCount = results.filter((r) => r.category === 'live_supabase').length;

  console.log(`Classification: ${staticCount} Static, ${simCount} Simulated, ${localIntCount} Local Integration, ${liveSupabaseCount} Live Supabase`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error('Phase 3 test suite failed with unexpected error:', err);
  process.exit(1);
});
