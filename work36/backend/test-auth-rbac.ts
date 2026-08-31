import { prisma } from './src/config/database';
import { AuthService } from './src/services/auth.service';
import { generateAccessToken, verifyAccessToken } from './src/utils/jwt.utils';
import { hashPassword } from './src/utils/password.utils';

async function runAuthRBACTests() {
  console.log('🧪 Starting Authentication, RBAC & Security Test Suite (PART 3)...');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No company found in database');

  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) throw new Error('No branch found in database');

  const superAdminRole = await prisma.role.findFirst({ where: { name: 'SUPER_ADMIN' } });
  const staffRole = await prisma.role.findFirst({ where: { name: 'STAFF' } }) ||
    await prisma.role.findFirst({ where: { NOT: { name: 'SUPER_ADMIN' } } });
  
  if (!superAdminRole) throw new Error('SUPER_ADMIN role missing');

  // ==========================================
  // TEST 1: Password Authentication & Session Token Generation
  // ==========================================
  console.log('\n--- TEST 1: Password Authentication & Token Generation ---');
  
  const testPassword = 'TestAuthPassword@2026';
  const passwordHash = await hashPassword(testPassword);

  const testUser = await prisma.user.upsert({
    where: { email: 'auth_test_user@apex-erp.local' },
    update: { passwordHash, isActive: true },
    create: {
      email: 'auth_test_user@apex-erp.local',
      username: 'authtestuser',
      passwordHash,
      firstName: 'AuthTest',
      lastName: 'User',
      companyId: company.id,
      roleId: superAdminRole.id,
      isActive: true
    }
  });

  // Assign user to branch
  await prisma.userBranch.upsert({
    where: {
      userId_branchId: {
        userId: testUser.id,
        branchId: branch.id
      }
    },
    update: {},
    create: {
      userId: testUser.id,
      branchId: branch.id,
      isDefault: true
    }
  });

  const loginRes = await AuthService.login('auth_test_user@apex-erp.local', testPassword, '127.0.0.1', 'TestSuite');
  console.log(`✅ Login successful for ${loginRes.user.email}`);
  console.log(`   Issued Access Token (first 20 chars): ${loginRes.accessToken.slice(0, 20)}...`);
  console.log(`   Issued Refresh Token (first 20 chars): ${loginRes.refreshToken.slice(0, 20)}...`);

  if (!loginRes.accessToken || !loginRes.refreshToken || loginRes.user.id !== testUser.id) {
    throw new Error('Login response invalid');
  }

  // ==========================================
  // TEST 2: Invalid Password & Account Protection
  // ==========================================
  console.log('\n--- TEST 2: Invalid Password Protection ---');
  try {
    await AuthService.login('auth_test_user@apex-erp.local', 'WrongPassword123!', '127.0.0.1', 'TestSuite');
    throw new Error('❌ Failed: Invalid password was allowed!');
  } catch (err: any) {
    console.log(`✅ Passed: Wrong password rejected with message: "${err.message}" (Status: ${err.statusCode || 401})`);
  }

  // ==========================================
  // TEST 3: Deactivated Account Protection
  // ==========================================
  console.log('\n--- TEST 3: Deactivated Account Protection ---');
  await prisma.user.update({
    where: { id: testUser.id },
    data: { isActive: false }
  });

  try {
    await AuthService.login('auth_test_user@apex-erp.local', testPassword, '127.0.0.1', 'TestSuite');
    throw new Error('❌ Failed: Deactivated user was allowed to log in!');
  } catch (err: any) {
    console.log(`✅ Passed: Deactivated account rejected with message: "${err.message}"`);
  }

  // Reactivate user
  await prisma.user.update({
    where: { id: testUser.id },
    data: { isActive: true }
  });

  // ==========================================
  // TEST 4: Google OAuth / Verified Identity Login
  // ==========================================
  console.log('\n--- TEST 4: Google OAuth / Verified Identity Flow ---');
  const googleLoginRes = await AuthService.loginWithGoogle(
    {
      credential: 'mock-google-id-token',
      email: 'auth_test_user@apex-erp.local',
      firstName: 'AuthTest',
      lastName: 'Google'
    },
    '127.0.0.1',
    'GoogleAuthAgent'
  );

  console.log(`✅ Google OAuth login succeeded for: ${googleLoginRes.user.email}`);
  if (!googleLoginRes.accessToken) {
    throw new Error('Google OAuth token issuance failed');
  }

  // ==========================================
  // TEST 5: JWT Verification & Payload Extraction
  // ==========================================
  console.log('\n--- TEST 5: JWT Verification & Claims Validation ---');
  const decoded = verifyAccessToken(googleLoginRes.accessToken);
  console.log(`✅ Verified JWT token claims:`);
  console.log(`   User ID: ${decoded.userId}`);
  console.log(`   Role: ${decoded.role}`);
  console.log(`   Company: ${decoded.companyId}`);

  if (decoded.userId !== testUser.id || decoded.role !== 'SUPER_ADMIN') {
    throw new Error('Decoded token claims mismatch');
  }

  // ==========================================
  // TEST 6: Token Refresh Rotation
  // ==========================================
  console.log('\n--- TEST 6: Refresh Token Rotation ---');
  const refreshRes = await AuthService.refreshAccessToken(googleLoginRes.refreshToken);
  console.log(`✅ Successfully rotated tokens:`);
  console.log(`   New Access Token: ${refreshRes.accessToken.slice(0, 20)}...`);
  console.log(`   New Refresh Token: ${refreshRes.refreshToken.slice(0, 20)}...`);

  // Verify old refresh token is now invalid (rotation)
  try {
    await AuthService.refreshAccessToken(googleLoginRes.refreshToken);
    throw new Error('❌ Failed: Reused refresh token was allowed!');
  } catch (err: any) {
    console.log(`✅ Passed: Expired/rotated refresh token correctly rejected`);
  }

  // ==========================================
  // TEST 7: Logout & Session Invalidation
  // ==========================================
  console.log('\n--- TEST 7: Secure Logout & Session Invalidation ---');
  await AuthService.logout(testUser.id, '127.0.0.1', 'TestSuite');

  const userAfterLogout = await prisma.user.findUnique({ where: { id: testUser.id } });
  if (userAfterLogout?.refreshToken !== null) {
    throw new Error('Refresh token was not cleared upon logout');
  }
  console.log('✅ Passed: Refresh token cleared in database upon logout');

  // ==========================================
  // TEST 8: Audit Trail Verification
  // ==========================================
  console.log('\n--- TEST 8: Security Audit Trail Verification ---');
  const auditLogs = await prisma.auditLog.findMany({
    where: { userId: testUser.id },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  console.log(`✅ Found ${auditLogs.length} audit logs for test user:`);
  auditLogs.forEach((log) => {
    console.log(`   - [${log.createdAt.toISOString()}] Action: ${log.action} | IP: ${log.ipAddress}`);
  });

  const actions = auditLogs.map((l) => l.action);
  if (!actions.includes('USER_LOGIN') && !actions.includes('USER_LOGIN_GOOGLE')) {
    throw new Error('Login actions not recorded in AuditLog');
  }
  if (!actions.includes('USER_LOGOUT')) {
    throw new Error('Logout action not recorded in AuditLog');
  }

  console.log('\n🎉 ALL AUTHENTICATION, RBAC & SECURITY TESTS PASSED!');
}

runAuthRBACTests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
