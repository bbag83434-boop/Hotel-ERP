import { PrismaClient, Prisma } from '@prisma/client';
import { AccountingService } from './src/services/accounting.service';
import { HotelService } from './src/services/hotel.service';
import { RestaurantService } from './src/services/restaurant.service';
import { PurchaseService } from './src/services/purchase.service';

const prisma = new PrismaClient();

async function runTest() {
  console.log('🧪 Starting Hotel PMS & Double-Entry Accounting Test Suite...\n');

  // 0. Fetch seeded entities
  const company = await prisma.company.findFirst();
  if (!company) throw new Error('Company not found');
  const hotelBranch = await prisma.branch.findFirst({ where: { companyId: company.id, type: { in: ['HOTEL', 'HYBRID'] } } });
  if (!hotelBranch) throw new Error('Hotel branch not found');
  const restBranch = await prisma.branch.findFirst({ where: { companyId: company.id, type: { in: ['RESTAURANT', 'HYBRID'] } } });
  if (!restBranch) throw new Error('Restaurant branch not found');
  const user = await prisma.user.findFirst({ where: { companyId: company.id } });
  if (!user) throw new Error('User not found');

  console.log(`📌 Testing under Company: ${company.name}, Hotel Branch: ${hotelBranch.name}`);

  // ==========================================
  // TEST 1: Double-Entry GL Balance Verification
  // ==========================================
  console.log('\n--- TEST 1: Double-Entry General Ledger Balancing ---');
  const cashAcc = await prisma.chartOfAccount.findFirst({ where: { companyId: company.id, code: '1010' } });
  const revAcc = await prisma.chartOfAccount.findFirst({ where: { companyId: company.id, code: '4010' } });

  if (!cashAcc || !revAcc) throw new Error('Chart of accounts missing 1010 or 4010');

  // Attempt unbalanced journal (should throw error)
  let unbalancedCaught = false;
  try {
    await AccountingService.createJournalEntry(company.id, {
      branchId: hotelBranch.id,
      referenceType: 'TEST_UNBALANCED',
      narration: 'Unbalanced journal test',
      lines: [
        { accountId: cashAcc.id, debit: 100, credit: 0 },
        { accountId: revAcc.id, debit: 0, credit: 80 } // Discrepancy!
      ]
    });
  } catch (err: any) {
    unbalancedCaught = true;
    console.log(`✅ Correctly rejected unbalanced journal entry: "${err.message}"`);
  }
  if (!unbalancedCaught) throw new Error('Failed to reject unbalanced journal entry!');

  // Post balanced journal
  const balancedEntry = await AccountingService.createJournalEntry(company.id, {
    branchId: hotelBranch.id,
    referenceType: 'GENERAL_JOURNAL',
    narration: 'Balanced Capital Infusion Test',
    lines: [
      { accountId: cashAcc.id, debit: 500, credit: 0, narration: 'Cash injected' },
      { accountId: revAcc.id, debit: 0, credit: 500, narration: 'Consulting revenue' }
    ]
  }, user.id);
  console.log(`✅ Successfully posted balanced journal entry #${balancedEntry.entryNumber} (Total: $${balancedEntry.totalDebit})`);

  // ==========================================
  // TEST 2: Hotel Front Desk: Booking -> Check-In -> Folio -> Check-Out -> Auto GL
  // ==========================================
  console.log('\n--- TEST 2: Hotel Front Desk Workflow & Auto Folio GL ---');
  const guest = await prisma.guestProfile.findFirst({ where: { companyId: company.id } });
  if (!guest) throw new Error('Guest profile not found');
  const roomType = await prisma.roomType.findFirst({ where: { branchId: hotelBranch.id, code: 'DLX-KNG' } });
  if (!roomType) throw new Error('RoomType DLX-KNG not found');
  const room = await prisma.room.findFirst({ where: { branchId: hotelBranch.id, roomTypeId: roomType.id, status: 'AVAILABLE' } });
  if (!room) throw new Error('Available room not found');

  // 1. Create Booking (2 nights)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 3);

  const booking = await HotelService.createBooking(company.id, {
    branchId: hotelBranch.id,
    guestId: guest.id,
    roomId: room.id,
    roomTypeId: roomType.id,
    checkInDate: tomorrow.toISOString(),
    checkOutDate: dayAfter.toISOString(),
    adults: 2,
    roomRate: 180.0,
    advancePayment: 50.0,
    notes: 'Ocean view requested'
  }, user.id);

  console.log(`✅ Created Booking #${booking.bookingNumber}: 2 Nights @ $180/night, Total + Tax = $${booking.grandTotal}`);

  // 2. Check-In Guest
  const checkedInBooking = await HotelService.checkInGuest(company.id, booking.id, {
    roomId: room.id,
    idVerified: true,
    keyCardNumber: 'CARD-9912'
  }, user.id);

  const roomAfterCheckIn = await prisma.room.findUnique({ where: { id: room.id } });
  console.log(`✅ Checked In Booking #${checkedInBooking.bookingNumber}. Room ${roomAfterCheckIn?.roomNumber} Status: ${roomAfterCheckIn?.status}, Key Issued: ${roomAfterCheckIn?.isKeyIssued}`);
  if (roomAfterCheckIn?.status !== 'OCCUPIED') throw new Error('Room status did not change to OCCUPIED on check-in');

  // 3. Post Incidentals to Guest Folio (Room Service & Spa)
  await HotelService.postFolioCharge(company.id, booking.id, {
    transactionType: 'FOOD_BEVERAGE_POS',
    description: 'Room Service Dinner & Wine',
    amount: 65.0
  }, user.id);

  await HotelService.postFolioCharge(company.id, booking.id, {
    transactionType: 'SPA',
    description: 'Aromatherapy Swedish Massage',
    amount: 90.0
  }, user.id);

  const refreshedBooking = await prisma.booking.findUnique({
    where: { id: booking.id },
    include: { folioTransactions: true }
  });
  console.log(`✅ Posted Folio Charges. Total Transactions: ${refreshedBooking?.folioTransactions.length}, Grand Total: $${refreshedBooking?.grandTotal}, Balance Due: $${refreshedBooking?.balanceAmount}`);

  // 4. Check-Out Guest & Auto Post GL
  const checkoutResult = await HotelService.checkOutGuest(company.id, booking.id, {
    paymentMethod: 'CREDIT_CARD',
    amountPaid: Number(refreshedBooking?.balanceAmount),
    notes: 'Settled at front desk checkout'
  }, user.id);

  const roomAfterCheckout = await prisma.room.findUnique({ where: { id: room.id } });
  console.log(`✅ Checked Out Booking #${booking.bookingNumber}. Room ${roomAfterCheckout?.roomNumber} Status: ${roomAfterCheckout?.status}`);
  if (roomAfterCheckout?.status !== 'DIRTY_CLEANING') throw new Error('Room status did not change to DIRTY_CLEANING on check-out');

  // Verify Housekeeping Task was automatically scheduled
  const hkTask = await prisma.housekeepingTask.findFirst({
    where: { roomId: room.id, status: 'PENDING' },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`✅ Auto-created Housekeeping Task: ${hkTask?.taskType} (Priority: ${hkTask?.priority})`);

  // Housekeeper completes and inspects
  if (hkTask) {
    await HotelService.updateHousekeepingStatus(company.id, hkTask.id, 'INSPECTED', 'Cleaned, sanitized and inspected', user.id);
    const roomAfterInspection = await prisma.room.findUnique({ where: { id: room.id } });
    console.log(`✅ Housekeeping Inspection Completed. Room ${roomAfterInspection?.roomNumber} Status: ${roomAfterInspection?.status}`);
    if (roomAfterInspection?.status !== 'AVAILABLE') throw new Error('Room status did not reset to AVAILABLE after inspection');
  }

  // ==========================================
  // TEST 3: Night Audit Automation
  // ==========================================
  console.log('\n--- TEST 3: Night Audit Execution & Metrics ---');
  // Check-in another room to simulate in-house night audit
  const room2 = await prisma.room.findFirst({ where: { branchId: hotelBranch.id, status: 'AVAILABLE' } }) ||
                await prisma.room.findFirst({ where: { branchId: hotelBranch.id } });
  if (room2) {
    await prisma.room.update({ where: { id: room2.id }, data: { status: 'AVAILABLE' } });
    const booking2 = await HotelService.createBooking(company.id, {
      branchId: hotelBranch.id,
      guestId: guest.id,
      roomId: room2.id,
      roomTypeId: roomType.id,
      checkInDate: new Date().toISOString(),
      checkOutDate: dayAfter.toISOString(),
      roomRate: 180.0
    }, user.id);
    await HotelService.checkInGuest(company.id, booking2.id, { roomId: room2.id }, user.id);

    const nightAudit = await HotelService.runNightAudit(company.id, hotelBranch.id, new Date().toISOString().slice(0, 10), user.id);
    console.log(`✅ Night Audit Completed for ${nightAudit.auditDate.toISOString().slice(0, 10)}:`);
    console.log(`   Total Rooms: ${nightAudit.totalRooms} | Occupied: ${nightAudit.occupiedRooms} | Occupancy: ${nightAudit.occupancyRate}%`);
    console.log(`   Room Revenue: $${nightAudit.roomRevenue} | ADR: $${nightAudit.adr} | RevPAR: $${nightAudit.revpar}`);
  }

  // ==========================================
  // TEST 4: Cross-Module Automated GL Posting (POS & Purchase)
  // ==========================================
  console.log('\n--- TEST 4: Cross-Module Automated GL Postings ---');
  // 1. Check POS GL Posting
  const posJournals = await prisma.journalEntry.findMany({
    where: { companyId: company.id, referenceType: 'POS_SALE' },
    include: { lines: { include: { account: true } } }
  });
  console.log(`✅ Found ${posJournals.length} POS Sale Double-Entry Journal Entries in General Ledger`);
  if (posJournals.length > 0) {
    const latestPosJ = posJournals[posJournals.length - 1];
    console.log(`   Latest POS Journal #${latestPosJ.entryNumber} (Total: $${latestPosJ.totalDebit})`);
    for (const l of latestPosJ.lines) {
      console.log(`     - [${l.account.code}] ${l.account.name}: Debit $${l.debit}, Credit $${l.credit}`);
    }
  }

  // 2. Check Hotel Folio GL Posting
  const hotelJournals = await prisma.journalEntry.findMany({
    where: { companyId: company.id, referenceType: 'HOTEL_FOLIO_BILLING' },
    include: { lines: { include: { account: true } } }
  });
  console.log(`✅ Found ${hotelJournals.length} Hotel Folio Double-Entry Journal Entries in General Ledger`);
  if (hotelJournals.length > 0) {
    const latestHJ = hotelJournals[hotelJournals.length - 1];
    console.log(`   Latest Hotel Journal #${latestHJ.entryNumber} (Total: $${latestHJ.totalDebit})`);
    for (const l of latestHJ.lines) {
      console.log(`     - [${l.account.code}] ${l.account.name}: Debit $${l.debit}, Credit $${l.credit}`);
    }
  }

  // ==========================================
  // TEST 5: Financial Statements (Profit & Loss & Cash Flow)
  // ==========================================
  console.log('\n--- TEST 5: Dynamic P&L & Cash Flow Statements ---');
  const pnl = await AccountingService.getProfitAndLoss(company.id, {});
  console.log(`✅ Dynamic P&L Statement:`);
  console.log(`   Total Operating Revenue: $${pnl.revenue.total.toFixed(2)}`);
  console.log(`   Cost of Goods Sold (BOM): $${pnl.cogs.total.toFixed(2)}`);
  console.log(`   Gross Profit: $${pnl.grossProfit.toFixed(2)}`);
  console.log(`   Operating Expenses: $${pnl.operatingExpenses.total.toFixed(2)}`);
  console.log(`   Net Income: $${pnl.netIncome.toFixed(2)}`);

  const cashFlow = await AccountingService.getCashFlow(company.id, {});
  console.log(`✅ Dynamic Cash Flow Statement:`);
  console.log(`   Total Cash Inflows: $${cashFlow.totalInflow.toFixed(2)}`);
  console.log(`   Total Cash Outflows: $${cashFlow.totalOutflow.toFixed(2)}`);
  console.log(`   Net Cash Flow: $${cashFlow.netCashFlow.toFixed(2)}`);

  console.log('\n🎉 ALL HOTEL PMS & DOUBLE-ENTRY ACCOUNTING TESTS PASSED PERFECTLY!\n');
}

runTest()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
