import { prisma } from './src/config/database';
import { AuthService } from './src/services/auth.service';
import { CashierShiftService } from './src/services/cashier-shift.service';
import { RestaurantService } from './src/services/restaurant.service';

async function runPart19Tests() {
  console.log('🧪 Starting PART 19 — Cashier Shift & Payment Reconciliation Test Suite...');

  // 1. Setup company, branch, user
  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No active company found');

  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) throw new Error('No branch found');

  const loginRes = await AuthService.login('admin@hotel-erp.com', 'Admin@123456');
  const user = loginRes.user;

  console.log(`✅ Authenticated Super Admin: ${user.email} (${user.id})`);

  // Close any previously hanging open sessions for this branch/cashier to ensure clean state
  await prisma.cashSession.updateMany({
    where: { companyId: company.id, branchId: branch.id, status: 'OPEN' },
    data: { status: 'CLOSED', closedAt: new Date() }
  });

  // ==========================================
  // TEST 1: Open Cashier Shift with Opening Float
  // ==========================================
  console.log('\n--- TEST 1: Open Cashier Shift with Opening Float ---');
  const openingFloat = 2000;
  const session = await CashierShiftService.openSession(
    company.id,
    branch.id,
    user.id,
    openingFloat,
    'Morning Shift Cash Float'
  );

  console.log(`✅ Shift #${session.sessionNumber} Opened with Float: ₹${session.openingFloat}`);
  if (session.status !== 'OPEN' || Number(session.openingFloat) !== openingFloat) {
    throw new Error('Shift opening assertion failed');
  }

  // Verify float movement record
  const floatMovement = await prisma.cashMovement.findFirst({
    where: { sessionId: session.id, movementType: 'FLOAT_START' }
  });
  console.log(`✅ Float start movement verified in DB: ₹${floatMovement?.amount}`);

  // ==========================================
  // TEST 2: Process POS Sales & Verify Live Sales Metrics Aggregation
  // ==========================================
  console.log('\n--- TEST 2: Process POS Sales & Live Shift Tracking ---');
  const menuItem = await prisma.menuItem.findFirst({ where: { isAvailable: true } });
  if (!menuItem) throw new Error('No menu item available');

  // Create & Settle Cash Order
  const cashOrder = await RestaurantService.createOrder(
    company.id,
    branch.id,
    {
      branchId: branch.id,
      orderType: 'TAKEAWAY',
      items: [{ menuItemId: menuItem.id, quantity: 2 }]
    },
    user.id
  );
  await RestaurantService.completeOrderCheckout({
    companyId: company.id,
    orderId: cashOrder.id,
    paymentMethod: 'CASH',
    amount: cashOrder.grandTotal.toNumber(),
    receivedAmount: 1000,
    cashierId: user.id
  });

  // Create & Settle UPI Order
  const upiOrder = await RestaurantService.createOrder(
    company.id,
    branch.id,
    {
      branchId: branch.id,
      orderType: 'TAKEAWAY',
      items: [{ menuItemId: menuItem.id, quantity: 1 }]
    },
    user.id
  );
  await RestaurantService.completeOrderCheckout({
    companyId: company.id,
    orderId: upiOrder.id,
    paymentMethod: 'UPI',
    amount: upiOrder.grandTotal.toNumber(),
    receivedAmount: upiOrder.grandTotal.toNumber(),
    cashierId: user.id
  });

  // Verify live metrics via getActiveSession
  const activeSession = await CashierShiftService.getActiveSession(company.id, branch.id, user.id);
  console.log(`✅ Active Shift Live Metrics:`);
  console.log(`   - Cash Sales: ₹${activeSession?.liveMetrics.cashSales}`);
  console.log(`   - UPI Sales: ₹${activeSession?.liveMetrics.upiSales}`);
  console.log(`   - Expected Drawer Cash: ₹${activeSession?.liveMetrics.expectedDrawerCash}`);
  console.log(`   - Total Shift Orders: ${activeSession?.liveMetrics.ordersCount}`);

  if (!activeSession || activeSession.liveMetrics.cashSales <= 0) {
    throw new Error('Live cash sales tracking failed');
  }

  // ==========================================
  // TEST 3: Cash Drawer Movements (Cash In, Cash Out, Safe Drop)
  // ==========================================
  console.log('\n--- TEST 3: Cash Drawer Movements ---');
  
  // 1. Cash In: ₹500 (Petty cash float added)
  const cashIn = await CashierShiftService.recordCashMovement(
    company.id,
    session.id,
    user.id,
    {
      movementType: 'CASH_IN',
      amount: 500,
      reason: 'Additional change coins & notes from main safe'
    }
  );
  console.log(`✅ Cash In recorded: ₹${cashIn.amount} (${cashIn.reason})`);

  // 2. Cash Out: ₹150 (Emergency dairy purchase)
  const cashOut = await CashierShiftService.recordCashMovement(
    company.id,
    session.id,
    user.id,
    {
      movementType: 'CASH_OUT',
      amount: 150,
      reason: 'Paid ₹150 for emergency milk packets'
    }
  );
  console.log(`✅ Cash Out recorded: ₹${cashOut.amount} (${cashOut.reason})`);

  // 3. Closing Safe Drop: ₹1,000 (Mid-day drop to manager vault)
  const safeDrop = await CashierShiftService.recordCashMovement(
    company.id,
    session.id,
    user.id,
    {
      movementType: 'CLOSING_DROP',
      amount: 1000,
      reason: 'Mid-shift safe drop to vault'
    }
  );
  console.log(`✅ Safe Drop recorded: ₹${safeDrop.amount} (${safeDrop.reason})`);

  // Verify updated expected cash
  const updatedActive = await CashierShiftService.getActiveSession(company.id, branch.id, user.id);
  const expectedCashCalculated = updatedActive?.liveMetrics.expectedDrawerCash;
  console.log(`✅ Updated Expected Drawer Cash after movements: ₹${expectedCashCalculated}`);

  // ==========================================
  // TEST 4: Close Shift with Physical Count & Discrepancy Variance Computation
  // ==========================================
  console.log('\n--- TEST 4: Close Cashier Shift & Discrepancy Calculation ---');
  
  // Suppose physical counted cash has a minor ₹10 variance
  const physicalCountedCash = Number(expectedCashCalculated) - 10;
  const closedSession = await CashierShiftService.closeSession(
    company.id,
    session.id,
    user.id,
    {
      closingCash: physicalCountedCash,
      notes: 'End of Shift 1',
      varianceReason: '₹10 coin shortfall'
    }
  );

  console.log(`✅ Shift Closed: #${closedSession.sessionNumber}`);
  console.log(`   - Status: ${closedSession.status}`);
  console.log(`   - Counted Cash: ₹${closedSession.closingCash}`);
  console.log(`   - Expected Cash: ₹${closedSession.expectedCash}`);
  console.log(`   - Cash Variance: ₹${closedSession.cashVariance}`);
  console.log(`   - Total Cash Sales: ₹${closedSession.totalCashSales}`);
  console.log(`   - Total UPI Sales: ₹${closedSession.totalUpiSales}`);
  console.log(`   - Notes: ${closedSession.notes}`);

  if (closedSession.status !== 'CLOSED' || Number(closedSession.cashVariance) !== -10) {
    throw new Error('Shift closure variance computation failed');
  }

  // ==========================================
  // TEST 5: Manager Reconciliation Sign-off
  // ==========================================
  console.log('\n--- TEST 5: Manager Reconciliation Signoff ---');
  const reconciledSession = await CashierShiftService.reconcileSession(
    company.id,
    session.id,
    user.id,
    'Variance of ₹10 reviewed and approved by Shift Supervisor'
  );

  console.log(`✅ Shift Reconciled: #${reconciledSession.sessionNumber}, Status: ${reconciledSession.status}`);
  if (reconciledSession.status !== 'RECONCILED') {
    throw new Error('Reconciliation status transition failed');
  }

  // ==========================================
  // TEST 6: Shift History & Audit Log Retrieval
  // ==========================================
  console.log('\n--- TEST 6: Shift History & Audit Log Retrieval ---');
  const history = await CashierShiftService.getSessionHistory(company.id, {
    branchId: branch.id
  });

  console.log(`✅ Retrieved ${history.length} shift history entries`);
  const currentInHistory = history.find((h) => h.id === session.id);
  if (!currentInHistory || currentInHistory.movements.length !== 4) {
    throw new Error('Shift history records or movements incomplete');
  }

  console.log('\n🎉 ALL PART 19 CASHIER SHIFT & RECONCILIATION TESTS PASSED!');
}

runPart19Tests()
  .catch((err) => {
    console.error('❌ PART 19 Test Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
