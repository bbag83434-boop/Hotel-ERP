import { prisma } from './src/config/database';
import { AuthService } from './src/services/auth.service';
import { OnlineOrderService } from './src/services/online-order.service';

async function runPart22Tests() {
  console.log('🧪 Starting PART 22 — Online / QR Ordering Test Suite...');

  // 1. Authenticate and setup context
  const loginRes = await AuthService.login('admin@hotel-erp.com', 'Admin@123456');
  const user = loginRes.user;
  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No company found');

  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) throw new Error('No branch found');

  // Find or create dining table
  let table = await prisma.diningTable.findFirst({
    where: { companyId: company.id, branchId: branch.id }
  });
  if (!table) {
    table = await prisma.diningTable.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        tableNumber: 'T-01',
        name: 'Garden Terrace 1',
        capacity: 4,
        section: 'Terrace'
      }
    });
  }

  // Find or create menu item
  let menuItem = await prisma.menuItem.findFirst({
    where: { companyId: company.id, isAvailable: true }
  });
  if (!menuItem) {
    menuItem = await prisma.menuItem.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        name: 'Paneer Butter Masala',
        code: 'CUR-PBM-001',
        sellingPrice: 280,
        kitchenStation: 'MAIN_KITCHEN',
        isAvailable: true
      }
    });
  }

  console.log(`✅ Setup complete: Branch "${branch.name}", Table "${table.name || table.tableNumber}", Menu Item "${menuItem.name}" (₹${menuItem.price})`);

  // ==========================================
  // TEST 1: Generate Table QR Session
  // ==========================================
  console.log('\n--- TEST 1: Table QR Session Generation ---');
  const qrSession = await OnlineOrderService.generateTableQR(company.id, branch.id, {
    tableId: table.id,
    guestName: 'Rahul Verma',
    guestPhone: '+919876543210'
  });
  console.log(`✅ Table QR Generated: Token = ${qrSession.sessionToken}, Table = ${qrSession.tableNumber}, Section = ${qrSession.section}`);
  if (!qrSession.sessionToken) throw new Error('QR session token generation failed');

  // ==========================================
  // TEST 2: Query Public Digital Menu
  // ==========================================
  console.log('\n--- TEST 2: Public Categorized Digital Menu Retrieval ---');
  const menuCategories = await OnlineOrderService.getPublicMenu(branch.id, qrSession.sessionToken);
  console.log(`✅ Digital Menu Loaded: ${menuCategories.length} category(ies) found`);
  const totalItems = menuCategories.reduce((sum, cat) => sum + cat.items.length, 0);
  console.log(`   - Total Available Dishes: ${totalItems}`);
  if (totalItems === 0) throw new Error('Menu items retrieval failed');

  // ==========================================
  // TEST 3: Place QR Dine-In Order
  // ==========================================
  console.log('\n--- TEST 3: Customer Places QR Dine-In Order ---');
  const orderPlacement = await OnlineOrderService.placeOnlineOrder({
    sessionToken: qrSession.sessionToken,
    customerName: 'Rahul Verma',
    customerPhone: '+919876543210',
    customerEmail: 'rahul.verma@example.com',
    orderType: 'DINE_IN',
    notes: 'Please make it medium spicy, less butter',
    items: [
      {
        menuItemId: menuItem.id,
        quantity: 2,
        notes: 'Extra coriander on top'
      }
    ]
  });

  const onlineOrder = orderPlacement.onlineOrder;
  console.log(`✅ Digital Order Created: #${onlineOrder.orderNumber}`);
  console.log(`   - Customer: ${onlineOrder.customer?.name} (${onlineOrder.customer?.phone})`);
  console.log(`   - SubTotal: ₹${onlineOrder.subTotal}, GST Tax: ₹${onlineOrder.taxAmount}, Total: ₹${onlineOrder.totalAmount}`);
  console.log(`   - POS Order Bridge: #${orderPlacement.posOrderNumber} (ID: ${orderPlacement.restaurantOrderId})`);
  console.log(`   - Kitchen KDS KOT Ticket: #${orderPlacement.ticketNumber}`);

  // Verify Table marked OCCUPIED
  const updatedTable = await prisma.diningTable.findUnique({ where: { id: table.id } });
  console.log(`✅ Table Status: ${updatedTable?.status} (Active Order ID: ${updatedTable?.activeOrderId})`);
  if (updatedTable?.status !== 'OCCUPIED') throw new Error('Table occupancy update failed');

  // ==========================================
  // TEST 4: Digital Settlement & Stock / GL Auto-Deduction
  // ==========================================
  console.log('\n--- TEST 4: Digital Payment Settlement (UPI Pay Now) ---');
  const settlement = await OnlineOrderService.settleOnlinePayment(
    company.id,
    {
      orderId: onlineOrder.id,
      paymentMethod: 'UPI',
      transactionRef: 'UPI-REF-20260817-994821'
    },
    user.id
  );

  console.log(`✅ Digital Settlement Complete: Status = ${settlement.onlineOrder.status}`);
  console.log(`   - Invoice Number: ${settlement.invoiceNumber}`);
  console.log(`   - Settled: ${settlement.isSettled}`);
  if (settlement.onlineOrder.status !== 'COMPLETED') throw new Error('Online order settlement failed');

  // ==========================================
  // TEST 5: Live Order Tracking
  // ==========================================
  console.log('\n--- TEST 5: Real-Time Order Tracking ---');
  const tracking = await OnlineOrderService.trackOrder(onlineOrder.orderNumber);
  console.log(`✅ Tracking Order #${tracking.orderNumber}:`);
  console.log(`   - Status: ${tracking.status}`);
  console.log(`   - Channel: ${tracking.channel}`);
  console.log(`   - Dishes: ${tracking.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}`);
  console.log(`   - Kitchen KOT: #${tracking.kdsTicket?.ticketNumber || 'N/A'}`);

  // ==========================================
  // TEST 6: Branch QR Table Management
  // ==========================================
  console.log('\n--- TEST 6: Branch QR Table Directory ---');
  const branchQRs = await OnlineOrderService.getBranchTablesQR(company.id, branch.id);
  console.log(`✅ Retrieved ${branchQRs.length} table QR records for branch "${branch.name}"`);

  console.log('\n🎉 ALL PART 22 ONLINE / QR ORDERING TESTS PASSED!');
}

runPart22Tests()
  .catch((err) => {
    console.error('❌ PART 22 Test Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
