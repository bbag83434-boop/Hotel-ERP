import { prisma } from './src/config/database';
import { RestaurantService } from './src/services/restaurant.service';
import { InventoryService } from './src/services/inventory.service';
import { Prisma } from '@prisma/client';

async function runPart10Tests() {
  console.log('🧪 Starting PART 10 — Advanced Restaurant POS & KDS Test Suite...');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No active company found');

  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) throw new Error('No branch found');

  const kitchenWh = await prisma.warehouse.findFirst({
    where: { branchId: branch.id, isActive: true }
  }) || await prisma.warehouse.findFirst({ where: { companyId: company.id } });
  if (!kitchenWh) throw new Error('Kitchen warehouse missing');

  const user = await prisma.user.findFirst({ where: { companyId: company.id } });
  if (!user) throw new Error('No user found');

  const menuItem = await prisma.menuItem.findFirst({
    where: { companyId: company.id, code: 'MI-GULAB-JAMUN' },
    include: {
      recipe: {
        include: { ingredients: { include: { rawItem: true } } }
      }
    }
  });
  if (!menuItem || !menuItem.recipe) throw new Error('Menu item with recipe missing');

  // Ensure raw ingredients are stocked in kitchen warehouse
  for (const ing of menuItem.recipe.ingredients) {
    await InventoryService.adjustStock({
      companyId: company.id,
      warehouseId: kitchenWh.id,
      itemId: ing.rawItemId,
      newQuantity: 50.0,
      reason: 'POS Test Initial Stocking',
      actorId: user.id
    });
  }

  // ==========================================
  // TEST 1: Dining Tables Management & Status
  // ==========================================
  console.log('\n--- TEST 1: Dining Table Floor Plan & Status Lifecycle ---');
  const table101 = await prisma.diningTable.upsert({
    where: {
      branchId_tableNumber: { branchId: branch.id, tableNumber: 'T-101' }
    },
    update: { status: 'AVAILABLE' },
    create: {
      companyId: company.id,
      branchId: branch.id,
      tableNumber: 'T-101',
      name: 'Royal Window Booth 101',
      capacity: 4,
      section: 'Main Courtyard',
      status: 'AVAILABLE'
    }
  });

  const table102 = await prisma.diningTable.upsert({
    where: {
      branchId_tableNumber: { branchId: branch.id, tableNumber: 'T-102' }
    },
    update: { status: 'AVAILABLE' },
    create: {
      companyId: company.id,
      branchId: branch.id,
      tableNumber: 'T-102',
      name: 'Royal Window Booth 102',
      capacity: 4,
      section: 'Main Courtyard',
      status: 'AVAILABLE'
    }
  });
  console.log(`✅ Table 101: ${table101.name} (${table101.status}) in ${table101.section}`);
  console.log(`✅ Table 102: ${table102.name} (${table102.status}) in ${table102.section}`);

  // ==========================================
  // TEST 2: POS Order Creation & Table Occupation
  // ==========================================
  console.log('\n--- TEST 2: POS Dine-In Order Creation ---');
  const order = await RestaurantService.createOrder(
    company.id,
    branch.id,
    {
      tableId: table101.id,
      orderType: 'DINE_IN',
      guestCount: 2,
      customerName: 'Maharaja Guest',
      notes: 'Serve warm with extra rose syrup',
      items: [
        {
          menuItemId: menuItem.id,
          quantity: 2, // 2 portions of Gulab Jamun
          notes: 'No ice cream'
        }
      ]
    },
    user.id
  );

  console.log(`✅ POS Order Created: #${order.orderNumber}`);
  console.log(`   Subtotal:   $${order.subtotal}`);
  console.log(`   Tax (5%):   $${order.taxAmount}`);
  console.log(`   Grand Total: $${order.grandTotal}`);

  const occupiedTable = await prisma.diningTable.findUnique({ where: { id: table101.id } });
  console.log(`✅ Table 101 status updated: ${occupiedTable?.status} (activeOrderId: ${occupiedTable?.activeOrderId})`);
  if (occupiedTable?.status !== 'OCCUPIED') {
    throw new Error('Table status was not updated to OCCUPIED');
  }

  // ==========================================
  // TEST 3: Kitchen Order Ticket (KOT) Routing
  // ==========================================
  console.log('\n--- TEST 3: KOT Generation & Kitchen Station Routing ---');
  const kotResult = await RestaurantService.sendOrderToKitchen(
    company.id,
    order.id,
    user.id
  );

  console.log(`✅ Generated ${kotResult.tickets.length} KOT tickets for Order #${order.orderNumber}:`);
  kotResult.tickets.forEach((t) => {
    console.log(`   - [${t.ticketNumber}] Station: ${t.station} | Status: ${t.status}`);
  });

  const updatedOrder = await prisma.restaurantOrder.findUnique({ where: { id: order.id } });
  if (updatedOrder?.status !== 'IN_PREPARATION') {
    throw new Error('Order status should be IN_PREPARATION after sending to kitchen');
  }

  // ==========================================
  // TEST 4: Kitchen Ticket Status Lifecycle
  // ==========================================
  console.log('\n--- TEST 4: KDS Ticket Progress ---');
  const ticket = kotResult.tickets[0];
  const readyTicket = await RestaurantService.updateKitchenTicketStatus(
    company.id,
    ticket.id,
    'READY',
    user.id
  );
  console.log(`✅ KDS Ticket Status Updated: ${readyTicket.status}`);

  // ==========================================
  // TEST 5: Apply Discount & Promotions
  // ==========================================
  console.log('\n--- TEST 5: Order Discount & Promotions ---');
  const discountRes = await RestaurantService.applyDiscount(
    company.id,
    order.id,
    {
      discountType: 'PERCENTAGE',
      rateOrAmount: 10, // 10% discount
      reason: 'VIP Heritage Club Member'
    },
    user.id
  );

  console.log(`✅ Discount Applied: $${discountRes.discount.amount} (Approval Required: ${discountRes.approvalRequired})`);
  const discountedOrder = await prisma.restaurantOrder.findUnique({ where: { id: order.id } });
  console.log(`   New Grand Total after 10% discount: $${discountedOrder?.grandTotal}`);

  // ==========================================
  // TEST 6: Fast POS Checkout & Recipe BOM Consumption
  // ==========================================
  console.log('\n--- TEST 6: POS Checkout & Automated Recipe De-stocking ---');
  
  const initialStock = await prisma.stockBalance.findUnique({
    where: {
      warehouseId_itemId: {
        warehouseId: kitchenWh.id,
        itemId: menuItem.recipe.ingredients[0].rawItemId
      }
    }
  });
  const beforeQty = initialStock ? initialStock.quantity : new Prisma.Decimal(50.0);

  const settlement = await RestaurantService.completeOrderCheckout({
    companyId: company.id,
    orderId: order.id,
    paymentMethod: 'CASH',
    amount: Number(discountedOrder?.grandTotal),
    receivedAmount: 500.0, // Guest gave $500 cash
    cashierId: user.id
  });

  console.log(`✅ Order Settle Completed: Payment Status: ${settlement.status}`);
  console.log(`   Tendered: $${settlement.payment.receivedAmount} | Change Due: $${settlement.payment.changeAmount}`);

  // Verify Table 101 status is transitioned to CLEANING/AVAILABLE and activeOrderId is cleared
  const freedTable = await prisma.diningTable.findUnique({ where: { id: table101.id } });
  console.log(`✅ Table 101 status after settlement: ${freedTable?.status} (activeOrderId: ${freedTable?.activeOrderId})`);
  if (freedTable?.status !== 'CLEANING' && freedTable?.status !== 'AVAILABLE') {
    throw new Error('Table status should be CLEANING or AVAILABLE after settlement');
  }
  if (freedTable?.activeOrderId !== null) {
    throw new Error('Table activeOrderId was not cleared after settlement');
  }

  // ==========================================
  // TEST 7: Recipe BOM Auto-Depletion Ledger Verification
  // ==========================================
  console.log('\n--- TEST 7: Recipe BOM Inventory Ledger Verification ---');
  
  const posLedgers = await prisma.stockLedger.findMany({
    where: {
      referenceId: order.id,
      movementType: 'POS_SALE'
    }
  });

  console.log(`✅ Found ${posLedgers.length} POS_SALE inventory ledger movements triggered by Order #${order.orderNumber}:`);
  posLedgers.forEach((pl) => {
    console.log(`   - Wh: ${pl.warehouseId.slice(0, 8)}... | Item: ${pl.itemId.slice(0, 8)}... | Deducted: ${pl.changeQty} | Notes: ${pl.notes}`);
  });

  if (posLedgers.length === 0) {
    throw new Error('Recipe ingredients were not automatically deducted on POS settlement');
  }

  console.log('\n🎉 ALL PART 10 RESTAURANT POS & KDS TESTS PASSED!');
}

runPart10Tests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
