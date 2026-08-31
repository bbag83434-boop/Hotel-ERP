import { prisma } from './src/config/database';
import { RestaurantService } from './src/services/restaurant.service';
import { Prisma } from '@prisma/client';

async function runPart11Tests() {
  console.log('🧪 Starting PART 11 — Kitchen Display System (KDS) & Multi-Station Routing Test Suite...');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No active company found');

  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) throw new Error('No branch found');

  const user = await prisma.user.findFirst({ where: { companyId: company.id } });
  if (!user) throw new Error('No user found');

  // ==========================================
  // TEST 1: Setup Multi-Station Menu Items
  // ==========================================
  console.log('\n--- TEST 1: Multi-Station Menu Setup ---');
  const menu = await prisma.menu.findFirst({ where: { companyId: company.id } });
  const category = await prisma.menuCategory.findFirst({ where: { menuId: menu?.id } });

  if (!menu || !category) throw new Error('Menu or Category missing');

  // 1. Dessert Station Item
  const dessertItem = await prisma.menuItem.findFirst({
    where: { companyId: company.id, kitchenStation: 'DESSERT_STATION' }
  });

  // 2. Main Kitchen Item
  const mainKitchenItem = await prisma.menuItem.upsert({
    where: { companyId_code: { companyId: company.id, code: 'MI-ROYAL-THALI' } },
    update: { kitchenStation: 'MAIN_KITCHEN', preparationMinutes: 12 },
    create: {
      companyId: company.id,
      menuId: menu.id,
      categoryId: category.id,
      name: 'Royal Heritage Grand Thali',
      code: 'MI-ROYAL-THALI',
      description: 'Traditional platter of curries, dal makhani, paneer, and tandoori breads',
      price: 450.0,
      costPrice: 150.0,
      taxRate: 5.0,
      kitchenStation: 'MAIN_KITCHEN',
      preparationMinutes: 12,
      isAvailable: true
    }
  });

  console.log(`✅ Station 1 Item: ${dessertItem?.name} (Station: ${dessertItem?.kitchenStation}, Prep: ${dessertItem?.preparationMinutes}m)`);
  console.log(`✅ Station 2 Item: ${mainKitchenItem.name} (Station: ${mainKitchenItem.kitchenStation}, Prep: ${mainKitchenItem.preparationMinutes}m)`);

  // ==========================================
  // TEST 2: Multi-Station POS Order & KOT Generation
  // ==========================================
  console.log('\n--- TEST 2: Multi-Station POS Order & Split KOT Generation ---');
  const order = await RestaurantService.createOrder(
    company.id,
    branch.id,
    {
      orderType: 'DINE_IN',
      customerName: 'KDS Test VIP Table',
      notes: 'Urgent service please',
      items: [
        { menuItemId: dessertItem!.id, quantity: 2, notes: 'Extra saffron' },
        { menuItemId: mainKitchenItem.id, quantity: 1, notes: 'Medium spicy' }
      ]
    },
    user.id
  );

  console.log(`✅ Order #${order.orderNumber} created with ${order.items.length} items.`);

  // Send to Kitchen (Should generate 2 KOT tickets: 1 for DESSERT_STATION, 1 for MAIN_KITCHEN)
  const kotDispatch = await RestaurantService.sendOrderToKitchen(
    company.id,
    order.id,
    user.id
  );

  console.log(`✅ Auto-split into ${kotDispatch.tickets.length} distinct KOT station tickets:`);
  kotDispatch.tickets.forEach((t) => {
    console.log(`   - Ticket #${t.ticketNumber} -> Station: [${t.station}] | Status: ${t.status} | Items: ${t.items.length}`);
  });

  if (kotDispatch.tickets.length !== 2) {
    throw new Error(`Expected 2 KOT tickets (1 per station), got ${kotDispatch.tickets.length}`);
  }

  const dessertTicket = kotDispatch.tickets.find((t) => t.station === 'DESSERT_STATION');
  const mainTicket = kotDispatch.tickets.find((t) => t.station === 'MAIN_KITCHEN');

  if (!dessertTicket || !mainTicket) {
    throw new Error('Station ticket routing failed');
  }

  // ==========================================
  // TEST 3: KDS Station Filtering & View
  // ==========================================
  console.log('\n--- TEST 3: KDS Station-Specific Ticket Filtering ---');
  const dessertKdsView = await RestaurantService.getKitchenTickets(company.id, {
    branchId: branch.id,
    station: 'DESSERT_STATION'
  });

  console.log(`✅ KDS Dessert Station Screen shows ${dessertKdsView.length} active ticket(s):`);
  dessertKdsView.forEach((t) => {
    console.log(`   - #${t.ticketNumber} (Order ${t.order.orderNumber}): Sent At ${t.sentAt.toISOString().slice(11, 19)}`);
  });

  const foundDessertTicket = dessertKdsView.some((t) => t.id === dessertTicket.id);
  if (!foundDessertTicket) {
    throw new Error('Dessert KDS screen missing dessert ticket');
  }

  // ==========================================
  // TEST 4: Step-by-Step Status Transitions & Order Sync
  // ==========================================
  console.log('\n--- TEST 4: KDS Progress Lifecycle & Parent Order Synchronization ---');

  // 1. Chef starts preparing Dessert Ticket
  const preparingDessert = await RestaurantService.updateKitchenTicketStatus(
    company.id,
    dessertTicket.id,
    'PREPARING',
    user.id
  );
  console.log(`✅ Dessert Ticket transitioned to: ${preparingDessert.status} (preparingAt: ${preparingDessert.preparingAt?.toISOString()})`);

  let currentOrder = await prisma.restaurantOrder.findUnique({ where: { id: order.id } });
  console.log(`   Order Status: ${currentOrder?.status} (Expected: IN_PREPARATION)`);
  if (currentOrder?.status !== 'IN_PREPARATION') {
    throw new Error('Order status should remain IN_PREPARATION while dishes are being prepared');
  }

  // 2. Dessert Ticket becomes READY, Main Ticket is still PENDING
  const readyDessert = await RestaurantService.updateKitchenTicketStatus(
    company.id,
    dessertTicket.id,
    'READY',
    user.id
  );
  console.log(`✅ Dessert Ticket transitioned to: ${readyDessert.status} (readyAt: ${readyDessert.readyAt?.toISOString()})`);

  currentOrder = await prisma.restaurantOrder.findUnique({ where: { id: order.id } });
  console.log(`   Order Status: ${currentOrder?.status} (Expected: IN_PREPARATION, since Main Kitchen is not ready yet)`);
  if (currentOrder?.status !== 'IN_PREPARATION') {
    throw new Error('Order status should remain IN_PREPARATION until ALL station tickets are ready');
  }

  // 3. Main Kitchen Ticket becomes READY
  const readyMain = await RestaurantService.updateKitchenTicketStatus(
    company.id,
    mainTicket.id,
    'READY',
    user.id
  );
  console.log(`✅ Main Kitchen Ticket transitioned to: ${readyMain.status} (readyAt: ${readyMain.readyAt?.toISOString()})`);

  // Now ALL tickets are READY -> Order should automatically transition to READY
  currentOrder = await prisma.restaurantOrder.findUnique({ where: { id: order.id } });
  console.log(`   Order Status after all tickets READY: ${currentOrder?.status} (Expected: READY)`);
  if (currentOrder?.status !== 'READY') {
    throw new Error(`Order status should transition to READY when all tickets are ready, got: ${currentOrder?.status}`);
  }

  // 4. Waiter serves both tickets
  await RestaurantService.updateKitchenTicketStatus(company.id, dessertTicket.id, 'SERVED', user.id);
  await RestaurantService.updateKitchenTicketStatus(company.id, mainTicket.id, 'SERVED', user.id);

  currentOrder = await prisma.restaurantOrder.findUnique({ where: { id: order.id } });
  console.log(`   Order Status after all tickets SERVED: ${currentOrder?.status} (Expected: SERVED)`);
  if (currentOrder?.status !== 'SERVED') {
    throw new Error(`Order status should transition to SERVED when all tickets are served, got: ${currentOrder?.status}`);
  }

  console.log('\n🎉 ALL PART 11 KITCHEN DISPLAY SYSTEM (KDS) TESTS PASSED!');
}

runPart11Tests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
