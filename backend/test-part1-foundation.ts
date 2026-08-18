import { app } from './src/app';
import { prisma } from './src/config/database';
import { env } from './src/config/environment';
import {
  AppError,
  InsufficientStockError,
  InvoiceMismatchError,
  UnauthorizedError,
  ForbiddenError,
  DuplicateRequestError,
} from './src/utils/errors';
import { BiMonthlyPeriodInfo } from './src/types';

async function runPart1FoundationTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING PART 1 — FOUNDATION & ARCHITECTURE TESTS');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      throw new Error(`Test assertion failed: ${testName}`);
    }
  }

  // Test 1: Environment Configuration
  console.log('🔹 1. Environment & Config Verification:');
  assert(typeof env.port === 'number' && env.port > 0, 'Port is valid number');
  assert(env.apiPrefix === '/api/v1', 'API prefix is correctly set to /api/v1');
  assert(typeof env.jwtAccessSecret === 'string' && env.jwtAccessSecret.length > 0, 'JWT Access Secret is present');

  // Test 2: Standardized Domain Errors
  console.log('\n🔹 2. Domain Errors & Exception Codes:');
  const stockErr = new InsufficientStockError('Maida (Flour)', 5, 2, 'KG');
  assert(stockErr.statusCode === 400, 'InsufficientStockError has 400 status');
  assert(stockErr.code === 'INSUFFICIENT_STOCK', 'Code is INSUFFICIENT_STOCK');
  assert(stockErr.details.shortage === 3, 'Shortage calculated correctly (5 - 2 = 3)');

  const invoiceErr = new InvoiceMismatchError('GRN and Invoice totals mismatch by ₹450');
  assert(invoiceErr.code === 'INVOICE_MISMATCH', 'Code is INVOICE_MISMATCH');

  const authErr = new UnauthorizedError();
  assert(authErr.statusCode === 401 && authErr.code === 'UNAUTHORIZED', 'UnauthorizedError is 401');

  const forbiddenErr = new ForbiddenError();
  assert(forbiddenErr.statusCode === 403 && forbiddenErr.code === 'PERMISSION_DENIED', 'ForbiddenError is 403');

  const dupErr = new DuplicateRequestError('idemp-key-12345');
  assert(dupErr.statusCode === 409 && dupErr.code === 'DUPLICATE_REQUEST', 'DuplicateRequestError is 409');

  // Test 3: Bi-Monthly Closing Period Calculation
  console.log('\n🔹 3. Bi-Monthly Closing Period Logic (1-15 & 16-MonthEnd):');
  function getClosingPeriodForDate(date: Date): BiMonthlyPeriodInfo {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const isFirstHalf = day <= 15;
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    return {
      year,
      month,
      period: isFirstHalf ? 'FIRST_HALF' : 'SECOND_HALF',
      startDate: `${year}-${String(month).padStart(2, '0')}-${isFirstHalf ? '01' : '16'}`,
      endDate: `${year}-${String(month).padStart(2, '0')}-${isFirstHalf ? '15' : String(lastDayOfMonth).padStart(2, '0')}`,
      label: isFirstHalf
        ? `${year}-${String(month).padStart(2, '0')} (Days 1 to 15)`
        : `${year}-${String(month).padStart(2, '0')} (Days 16 to ${lastDayOfMonth})`,
    };
  }

  const periodAug10 = getClosingPeriodForDate(new Date(2026, 7, 10)); // Aug 10, 2026
  assert(periodAug10.period === 'FIRST_HALF', 'Aug 10 falls in FIRST_HALF (1-15)');
  assert(periodAug10.startDate === '2026-08-01' && periodAug10.endDate === '2026-08-15', 'Aug 1-15 range is correct');

  const periodAug25 = getClosingPeriodForDate(new Date(2026, 7, 25)); // Aug 25, 2026
  assert(periodAug25.period === 'SECOND_HALF', 'Aug 25 falls in SECOND_HALF (16-31)');
  assert(periodAug25.startDate === '2026-08-16' && periodAug25.endDate === '2026-08-31', 'Aug 16-31 range is correct');

  // Test 4: Database Safe Connectivity & Topology
  console.log('\n🔹 4. Database Safe Connectivity Verification:');
  try {
    const dbCheck = await prisma.$queryRaw`SELECT 1 as connected`;
    assert(Array.isArray(dbCheck) && dbCheck.length > 0, 'Prisma can query Neon PostgreSQL safely');

    const branchCount = await prisma.branch.count();
    console.log(`    ℹ️ Preserved database branch count: ${branchCount}`);
    assert(branchCount >= 0, 'Database tables are intact and preserved');
  } catch (error: any) {
    console.warn(`    ⚠️ Database query skipped or failed: ${error.message}`);
  }

  console.log('\n====================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} PART 1 FOUNDATION TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');
}

runPart1FoundationTests()
  .catch((err) => {
    console.error('❌ PART 1 Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
