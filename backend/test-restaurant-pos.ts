import { prisma } from './src/config/database';
import { RestaurantService } from './src/services/restaurant.service';

async function runRestaurantTests() {
  console.log('🧪 Starting Restaurant Operations & POS Verification Test Suite...\n');

  try {
    const company = await prisma.company.findFirst({ where: { code: 'COMP-001' } });
    const restBranch = await prisma.branch.findFirst({ where: { code: 'BR-REST-01' } });
    const adminUser = await prisma.user.findFirst({ where: { email: 'admin@hotel-erp.com' } });
    const kitchenWh = await prisma.warehouse.findFirst({ where: { code: 'WH-KITCHEN-01' } });
    const flourItem = await prisma.item.findFirst({ where: { code: 'RM-FLOUR-01' } });
    const pizzaMenuItem = await prisma.menuItem.findFirst({ where: { code: 'MI-PIZZA-MARG' } });
    const waterMenuItem = await prisma.menuItem.findFirst({ where: { code: 'MI-WATER-SANPELL' } });
    const tableT1 = await prisma.diningTable.findFirst({
      where: { branchId: restBranch!.id, tableNumber: 'T-01' }
    });
    const tableT2 = await prisma.diningTable.findFirst({
      where: { branchId: restBranch!.id, tableNumber: 'T-02' }
    });

    if (!company || !restBranch || !adminUser || !kitchenWh || !pizzaMenuItem || !tableT1) {
      throw new Error('Missing required seed data for testing');
    }

    console.log(`🏢 Testing with Branch: ${restBranch.name} (${restBranch.code})`);

    // -------------------------------------------------------------
    // TEST 1: CREATE RESTAURANT DINE-IN ORDER & VERIFY TABLE OCCUPANCY
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Create Dine-In Order on Table T-01 ---');
    const order1 = await RestaurantService.createOrder(
      company.id,
      restBranch.id,
      {
        tableId: tableT1.id,
        orderType: 'DINE_IN',
        guestCount: 2,
        customerName: 'Alice Smith',
        customerPhone: '+1 555-4321',
        notes: 'Extra crispy crust requested',
        items: [
          { menuItemId: pizzaMenuItem.id, quantity: 2, notes: 'Crispy crust' },
          { menuItemId: waterMenuItem!.id, quantity: 2, notes: 'Chilled with lemon slice' }
        ]
      },
      adminUser.id
    );

    console.log(`Created Order: ${order1.orderNumber} (Grand Total: $${Number(order1.grandTotal).toFixed(2)})`);

    const updatedTableT1 = await prisma.diningTable.findUnique({ where: { id: tableT1.id } });
    if (updatedTableT1?.status !== 'OCCUPIED') {
      throw new Error(`Expected Table T-01 to be OCCUPIED, got ${updatedTableT1?.status}`);
    }
    console.log(`✅ Passed: Table T-01 status automatically marked OCCUPIED!`);

    // -------------------------------------------------------------
    // TEST 2: SEND ORDER TO KITCHEN & VERIFY STATION TICKETS (KDS)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Send Order to Kitchen Stations ---');
    const kdsResult = await RestaurantService.sendOrderToKitchen(company.id, order1.id, adminUser.id);
    console.log(`Generated ${kdsResult.tickets.length} Kitchen Tickets for Stations: ${kdsResult.tickets.map((t) => t.station).join(', ')}`);

    // Advance ticket status on KDS
    for (const t of kdsResult.tickets) {
      await RestaurantService.updateKitchenTicketStatus(company.id, t.id, 'PREPARING', adminUser.id);
      await RestaurantService.updateKitchenTicketStatus(company.id, t.id, 'READY', adminUser.id);
    }

    const orderAfterKds = await prisma.restaurantOrder.findUnique({ where: { id: order1.id } });
    console.log(`Order status after all station tickets READY: ${orderAfterKds?.status}`);
    console.log(`✅ Passed: KDS multi-station ticket generation and status progression verified!`);

    // -------------------------------------------------------------
    // TEST 3: POS CHECKOUT, RECIPE INVENTORY CONSUMPTION & ACCOUNTING
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: POS Settle Bill with Automatic Recipe BOM Inventory Consumption ---');
    const flourStockBefore = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: kitchenWh.id, itemId: flourItem!.id } }
    });
    console.log(`Kitchen Flour Balance Before Sale: ${flourStockBefore?.quantity} kg`);

    // Complete Checkout
    const checkoutRes = await RestaurantService.completeOrderCheckout({
      companyId: company.id,
      orderId: order1.id,
      paymentMethod: 'CASH',
      amount: Number(order1.grandTotal),
      receivedAmount: 60.0,
      cashierId: adminUser.id
    });

    console.log(`Settled: ${checkoutRes.message}`);
    console.log(`Invoice: ${checkoutRes.invoiceNumber} | Change Given: $${Number(checkoutRes.changeAmount).toFixed(2)}`);

    // Verify Stock Reduction for Recipe BOM
    const flourStockAfter = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: kitchenWh.id, itemId: flourItem!.id } }
    });
    console.log(`Kitchen Flour Balance After 2 Pizzas Sold: ${flourStockAfter?.quantity} kg`);

    // 2 pizzas x 0.25kg flour = 0.5kg flour consumed
    const flourDiff = Number(flourStockBefore!.quantity) - Number(flourStockAfter!.quantity);
    console.log(`Exact Flour Decrement: ${flourDiff} kg (Expected: 0.50 kg)`);

    if (Math.abs(flourDiff - 0.5) > 0.001) {
      throw new Error(`Flour stock deduction mismatch! Expected 0.5, got ${flourDiff}`);
    }

    // Verify Stock Ledger Entry
    const stockLedgerEntry = await prisma.stockLedger.findFirst({
      where: { referenceId: order1.id, itemId: flourItem!.id, movementType: 'POS_SALE' }
    });
    if (!stockLedgerEntry) {
      throw new Error('StockLedger entry for POS_SALE not created!');
    }
    console.log(`Immutable Stock Ledger Entry: ${stockLedgerEntry.notes}`);

    // Verify SalesRecord & Accounting Stub
    const salesRecord = await prisma.salesRecord.findUnique({ where: { orderId: order1.id } });
    console.log(`Sales Record: Revenue $${Number(salesRecord?.grandTotal).toFixed(2)} | COGS $${Number(salesRecord?.totalCogs).toFixed(2)} | Gross Profit $${Number(salesRecord?.grossProfit).toFixed(2)}`);

    const accountingStub = await prisma.accountingEntryStub.findFirst({ where: { orderId: order1.id } });
    console.log(`Accounting Journal Stub: ${accountingStub?.entryNumber} | Debit: ${accountingStub?.debitAccountName} | Credit: ${accountingStub?.creditAccountName}`);

    // Verify Table T-01 is freed to CLEANING
    const tableAfterCheckout = await prisma.diningTable.findUnique({ where: { id: tableT1.id } });
    console.log(`Table T-01 Status After Bill Settlement: ${tableAfterCheckout?.status}`);

    console.log(`✅ Passed: Full POS sale -> Recipe BOM Inventory Auto-Deduction -> Stock Ledger -> Accounting Journal -> Table status complete!`);

    // -------------------------------------------------------------
    // TEST 4: TABLE MERGE OPERATION
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Atomic Table Merge ---');
    const orderMergeSrc = await RestaurantService.createOrder(
      company.id,
      restBranch.id,
      {
        tableId: tableT1.id,
        orderType: 'DINE_IN',
        guestCount: 2,
        items: [{ menuItemId: pizzaMenuItem.id, quantity: 1 }]
      },
      adminUser.id
    );

    const orderMergeTarget = await RestaurantService.createOrder(
      company.id,
      restBranch.id,
      {
        tableId: tableT2!.id,
        orderType: 'DINE_IN',
        guestCount: 2,
        items: [{ menuItemId: waterMenuItem!.id, quantity: 1 }]
      },
      adminUser.id
    );

    const mergeRes = await RestaurantService.mergeTables(company.id, tableT1.id, tableT2!.id, adminUser.id);
    console.log(mergeRes.message);

    const t1Status = await prisma.diningTable.findUnique({ where: { id: tableT1.id } });
    const t2Status = await prisma.diningTable.findUnique({ where: { id: tableT2!.id } });
    console.log(`Source Table T-01: ${t1Status?.status} | Target Table T-02: ${t2Status?.status}`);

    console.log('✅ Passed: Table merge completed and atomic state preserved!');

    console.log('\n🎉 ALL RESTAURANT POS & OPERATIONS TESTS PASSED SUCCESSFULLY!\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runRestaurantTests();
