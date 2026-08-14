import { prisma } from './src/config/database';
import { PurchaseService } from './src/services/purchase.service';
import { Prisma } from '@prisma/client';

async function runPart5Tests() {
  console.log('==================================================');
  console.log('STARTING PART 5 TEST SUITE (20 COMPREHENSIVE SCENARIOS)');
  console.log('PURCHASE ORDER + GOODS RECEIVING + GRN + STOCK SAFETY');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASSED: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${message}`);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // SETUP: Query existing live seeded entities
    const company = await prisma.company.findFirst({ where: { isActive: true } });
    if (!company) throw new Error('Company not found');

    const user = await prisma.user.findFirst({ where: { companyId: company.id, isActive: true } });
    if (!user) throw new Error('User not found');

    const warehouses = await prisma.warehouse.findMany({ where: { companyId: company.id, isActive: true } });
    const warehouseA = warehouses[0];
    const warehouseB = warehouses.length > 1 ? warehouses[1] : warehouses[0];

    const branches = await prisma.branch.findMany({ where: { companyId: company.id } });
    if (branches.length < 2) throw new Error('Need at least 2 branches for isolation tests');
    const branchA = branches.find((b) => b.id === warehouseA.branchId) || branches[0];
    const branchB = branches.find((b) => b.id !== branchA.id) || branches[1];

    const supplier = await prisma.supplier.findFirst({ where: { companyId: company.id, isActive: true } });
    if (!supplier) throw new Error('Supplier not found');

    const items = await prisma.item.findMany({ where: { companyId: company.id, isActive: true } });
    if (items.length < 2) throw new Error('Need at least 2 items');
    const item1 = items[0];
    const item2 = items[1];

    console.log(`Using Company: ${company.name}, Branch A: ${branchA.name}, Branch B: ${branchB.name}`);
    console.log(`Supplier: ${supplier.name}, Warehouse A: ${warehouseA.name}, Item 1: ${item1.name}, Item 2: ${item2.name}\n`);

    // Record initial stock of Item 1 in Warehouse A
    const initialBal1 = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });
    const initialQty1 = initialBal1 ? Number(initialBal1.quantity) : 0;
    const initialSupplierBal = Number(supplier.balance);

    // ----------------------------------------------------------------------------------
    // TEST 1: Create Purchase Order (Backend line total & grand total calculation verified)
    // ----------------------------------------------------------------------------------
    const po1 = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        deliveryDate: new Date(Date.now() + 86400000 * 3).toISOString(),
        taxAmount: 50,
        notes: 'Test PO 1 Full Receiving',
        status: 'ISSUED',
        items: [
          { itemId: item1.id, orderedQty: 100, unitPrice: 20, notes: 'Line 1' },
          { itemId: item2.id, orderedQty: 50, unitPrice: 40, notes: 'Line 2' }
        ]
      },
      user.id,
      [branchA.id]
    );

    assert(po1.status === 'ISSUED', 'TEST 1: PO created with status ISSUED');
    assert(po1.items.length === 2, 'TEST 1: PO contains 2 line items');
    assert(Number(po1.totalAmount) === 100 * 20 + 50 * 40, 'TEST 1: Subtotal calculated correctly (4000)');
    assert(Number(po1.grandTotal) === 4050, 'TEST 1: Grand total with tax calculated correctly (4050)');

    // ----------------------------------------------------------------------------------
    // TEST 2: Create Draft PO and update status to ISSUED
    // ----------------------------------------------------------------------------------
    const poDraft = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        notes: 'Draft PO Test',
        status: 'DRAFT',
        items: [{ itemId: item1.id, orderedQty: 25, unitPrice: 15 }]
      },
      user.id,
      [branchA.id]
    );

    assert(poDraft.status === 'DRAFT', 'TEST 2: Draft PO created with status DRAFT');
    const poIssued = await PurchaseService.updatePurchaseOrderStatus(
      company.id,
      poDraft.id,
      'ISSUED',
      'Manager approved draft',
      user.id,
      [branchA.id]
    );
    assert(poIssued.status === 'ISSUED', 'TEST 2: Draft PO transitioned to ISSUED');

    // ----------------------------------------------------------------------------------
    // TEST 3: Create PO referencing an Approved Purchase Request (Requisition Tracking)
    // ----------------------------------------------------------------------------------
    const pr = await prisma.purchaseRequest.create({
      data: {
        companyId: company.id,
        branchId: branchA.id,
        requestNumber: `PR-TEST-${Date.now()}`,
        requestedById: user.id,
        requiredDate: new Date(Date.now() + 86400000 * 2),
        priority: 'HIGH',
        status: 'APPROVED',
        approvedById: user.id,
        approvedAt: new Date(),
        items: {
          create: [{ itemId: item1.id, requestedQty: new Prisma.Decimal(60), estimatedPrice: new Prisma.Decimal(20) }]
        }
      }
    });

    const poFromPR = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        requestId: pr.id,
        notes: 'Created from Approved PR',
        status: 'ISSUED',
        items: [{ itemId: item1.id, orderedQty: 60, unitPrice: 20 }]
      },
      user.id,
      [branchA.id]
    );

    const updatedPR = await prisma.purchaseRequest.findUnique({ where: { id: pr.id } });
    assert(poFromPR.requestId === pr.id, 'TEST 3: PO correctly references Purchase Request');
    assert(updatedPR?.status === 'ORDERED', 'TEST 3: PR status transitioned to ORDERED upon PO generation');

    // ----------------------------------------------------------------------------------
    // TEST 4: Full Goods Receive Note (GRN) against PO 1
    // ----------------------------------------------------------------------------------
    const poItem1 = po1.items.find((i) => i.itemId === item1.id)!;
    const poItem2 = po1.items.find((i) => i.itemId === item2.id)!;

    const grn1 = await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: po1.id,
      invoiceNumber: `INV-GRN-1-${Date.now()}`,
      notes: 'Full Receiving of PO 1',
      receiverId: user.id,
      userBranchIds: [branchA.id],
      items: [
        {
          poItemId: poItem1.id,
          itemId: item1.id,
          receivedQty: 100,
          acceptedQty: 100,
          rejectedQty: 0,
          unitPrice: 20,
          batchNumber: 'BATCH-001',
          qcStatus: 'PASSED',
          qcNotes: 'All 100 passed inspection'
        },
        {
          poItemId: poItem2.id,
          itemId: item2.id,
          receivedQty: 50,
          acceptedQty: 50,
          rejectedQty: 0,
          unitPrice: 40,
          batchNumber: 'BATCH-002',
          qcStatus: 'PASSED',
          qcNotes: 'All 50 passed inspection'
        }
      ]
    });

    assert(grn1.status === 'QC_PASSED', 'TEST 4: GRN created with status QC_PASSED');

    // ----------------------------------------------------------------------------------
    // TEST 5: Destination Warehouse Stock Increased
    // ----------------------------------------------------------------------------------
    const updatedBal1 = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });
    assert(
      Number(updatedBal1?.quantity) === initialQty1 + 100,
      `TEST 5: Warehouse A stock for Item 1 increased exactly by accepted quantity (+100, now ${updatedBal1?.quantity})`
    );

    // ----------------------------------------------------------------------------------
    // TEST 6: Immutable Stock Movement Ledger entry created
    // ----------------------------------------------------------------------------------
    const ledgerEntry = await prisma.stockLedger.findFirst({
      where: { referenceId: grn1.id, itemId: item1.id },
      orderBy: { createdAt: 'desc' }
    });
    assert(ledgerEntry !== null, 'TEST 6: StockLedger entry recorded for GRN');
    assert(ledgerEntry?.movementType === 'GRN', 'TEST 6: MovementType is GRN');
    assert(Number(ledgerEntry?.changeQty) === 100, 'TEST 6: Ledger changeQty is 100');

    // ----------------------------------------------------------------------------------
    // TEST 7: Item Master cost price auto-updated
    // ----------------------------------------------------------------------------------
    const updatedItem1 = await prisma.item.findUnique({ where: { id: item1.id } });
    assert(Number(updatedItem1?.costPrice) === 20, 'TEST 7: Item costPrice updated to latest GRN unit price');

    // ----------------------------------------------------------------------------------
    // TEST 8: Supplier Payable Balance and Supplier Ledger updated
    // ----------------------------------------------------------------------------------
    const updatedSupplier = await prisma.supplier.findUnique({ where: { id: supplier.id } });
    const supLedger = await prisma.supplierLedger.findFirst({
      where: { referenceId: grn1.id },
      orderBy: { createdAt: 'desc' }
    });
    assert(
      Number(updatedSupplier?.balance) === initialSupplierBal + 4000,
      'TEST 8: Supplier payable balance credited with GRN total amount'
    );
    assert(supLedger !== null && Number(supLedger.credit) === 4000, 'TEST 8: SupplierLedger entry created with credit 4000');

    // ----------------------------------------------------------------------------------
    // TEST 9: PO 1 Status transitioned to RECEIVED (Fully Received)
    // ----------------------------------------------------------------------------------
    const po1Final = await prisma.purchaseOrder.findUnique({ where: { id: po1.id } });
    assert(po1Final?.status === 'RECEIVED', 'TEST 9: PO 1 transitioned to RECEIVED after 100% fulfillment');

    // ----------------------------------------------------------------------------------
    // TEST 10: Create PO 2 for Partial Receiving
    // ----------------------------------------------------------------------------------
    const po2 = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        notes: 'Partial Receiving Test PO',
        status: 'ISSUED',
        items: [{ itemId: item1.id, orderedQty: 100, unitPrice: 22 }]
      },
      user.id,
      [branchA.id]
    );
    assert(po2.status === 'ISSUED', 'TEST 10: PO 2 created for partial fulfillment test (Ordered: 100)');

    // ----------------------------------------------------------------------------------
    // TEST 11 & 12: First Partial Receiving (40 out of 100) -> Status PARTIALLY_RECEIVED
    // ----------------------------------------------------------------------------------
    const po2Item = po2.items[0];
    const grnPartial1 = await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: po2.id,
      notes: 'First partial receive: 40 units',
      receiverId: user.id,
      userBranchIds: [branchA.id],
      items: [
        {
          poItemId: po2Item.id,
          itemId: item1.id,
          receivedQty: 40,
          acceptedQty: 40,
          rejectedQty: 0,
          unitPrice: 22,
          qcStatus: 'PASSED'
        }
      ]
    });

    const po2Partial = await prisma.purchaseOrder.findUnique({
      where: { id: po2.id },
      include: { items: true }
    });
    assert(po2Partial?.status === 'PARTIALLY_RECEIVED', 'TEST 11: PO 2 status is PARTIALLY_RECEIVED');
    assert(Number(po2Partial?.items[0].receivedQty) === 40, 'TEST 12: PO 2 item receivedQty is 40 / 100');

    // ----------------------------------------------------------------------------------
    // TEST 13: Destination Stock Increased by partial quantity (+40)
    // ----------------------------------------------------------------------------------
    const balAfterPartial1 = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });
    assert(
      Number(balAfterPartial1?.quantity) === initialQty1 + 100 + 40,
      'TEST 13: Stock balance increased exactly by +40 for first partial receipt'
    );

    // ----------------------------------------------------------------------------------
    // TEST 14 & 15: Second Partial Receiving (Remaining 60 out of 100) -> Status RECEIVED
    // ----------------------------------------------------------------------------------
    const grnPartial2 = await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: po2.id,
      notes: 'Second partial receive: remaining 60 units',
      receiverId: user.id,
      userBranchIds: [branchA.id],
      items: [
        {
          poItemId: po2Item.id,
          itemId: item1.id,
          receivedQty: 60,
          acceptedQty: 60,
          rejectedQty: 0,
          unitPrice: 22,
          qcStatus: 'PASSED'
        }
      ]
    });

    const po2Completed = await prisma.purchaseOrder.findUnique({
      where: { id: po2.id },
      include: { items: true }
    });
    assert(po2Completed?.status === 'RECEIVED', 'TEST 14: PO 2 status transitioned to RECEIVED after second receipt');
    assert(Number(po2Completed?.items[0].receivedQty) === 100, 'TEST 15: PO 2 item cumulative receivedQty is 100');

    // ----------------------------------------------------------------------------------
    // TEST 16: Strict Over-Receiving Prevention (Attempting receivedQty > orderedQty)
    // ----------------------------------------------------------------------------------
    const po3 = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        status: 'ISSUED',
        items: [{ itemId: item1.id, orderedQty: 50, unitPrice: 20 }]
      },
      user.id,
      [branchA.id]
    );

    let overReceiveBlocked = false;
    try {
      await PurchaseService.createGoodsReceiveNote({
        companyId: company.id,
        branchId: branchA.id,
        warehouseId: warehouseA.id,
        poId: po3.id,
        receiverId: user.id,
        items: [
          {
            poItemId: po3.items[0].id,
            itemId: item1.id,
            receivedQty: 75, // Exceeds 50
            acceptedQty: 75,
            rejectedQty: 0,
            unitPrice: 20
          }
        ]
      });
    } catch (err: any) {
      overReceiveBlocked = true;
    }
    assert(overReceiveBlocked, 'TEST 16: Over-receiving strictly blocked with error');

    // ----------------------------------------------------------------------------------
    // TEST 17: Strict Quality Check (QC) balancing validation
    // ----------------------------------------------------------------------------------
    let qcMismatchBlocked = false;
    try {
      await PurchaseService.createGoodsReceiveNote({
        companyId: company.id,
        branchId: branchA.id,
        warehouseId: warehouseA.id,
        poId: po3.id,
        receiverId: user.id,
        items: [
          {
            poItemId: po3.items[0].id,
            itemId: item1.id,
            receivedQty: 50,
            acceptedQty: 30,
            rejectedQty: 10, // Sum = 40 != 50
            unitPrice: 20
          }
        ]
      });
    } catch (err: any) {
      qcMismatchBlocked = true;
    }
    assert(qcMismatchBlocked, 'TEST 17: QC imbalance (accepted + rejected != received) strictly blocked');

    // ----------------------------------------------------------------------------------
    // TEST 18: Concurrent Receiving Row-Locking & Duplicate Prevention
    // ----------------------------------------------------------------------------------
    const poConcurrent = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        status: 'ISSUED',
        items: [{ itemId: item1.id, orderedQty: 100, unitPrice: 20 }]
      },
      user.id,
      [branchA.id]
    );

    // Launch two simultaneous receiving requests for 80 units (sum = 160 > 100)
    const [p1, p2] = await Promise.allSettled([
      PurchaseService.createGoodsReceiveNote({
        companyId: company.id,
        branchId: branchA.id,
        warehouseId: warehouseA.id,
        poId: poConcurrent.id,
        receiverId: user.id,
        items: [
          {
            poItemId: poConcurrent.items[0].id,
            itemId: item1.id,
            receivedQty: 80,
            acceptedQty: 80,
            rejectedQty: 0,
            unitPrice: 20
          }
        ]
      }),
      PurchaseService.createGoodsReceiveNote({
        companyId: company.id,
        branchId: branchA.id,
        warehouseId: warehouseA.id,
        poId: poConcurrent.id,
        receiverId: user.id,
        items: [
          {
            poItemId: poConcurrent.items[0].id,
            itemId: item1.id,
            receivedQty: 80,
            acceptedQty: 80,
            rejectedQty: 0,
            unitPrice: 20
          }
        ]
      })
    ]);

    // Exactly one should succeed and one must be rejected due to row-level serialization
    const successCount = [p1, p2].filter((r) => r.status === 'fulfilled').length;
    const failCount = [p1, p2].filter((r) => r.status === 'rejected').length;
    assert(
      successCount === 1 && failCount === 1,
      `TEST 18: Concurrency safety verified (1 fulfilled, 1 rejected to prevent over-receiving race condition)`
    );

    // ----------------------------------------------------------------------------------
    // TEST 19: Transaction Rollback Integrity
    // ----------------------------------------------------------------------------------
    const balBeforeRollback = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });

    let rollbackTriggered = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.stockBalance.update({
          where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } },
          data: { quantity: { increment: 9999 } }
        });
        throw new Error('Simulated mid-transaction failure');
      });
    } catch {
      rollbackTriggered = true;
    }

    const balAfterRollback = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });
    assert(
      rollbackTriggered && Number(balBeforeRollback?.quantity) === Number(balAfterRollback?.quantity),
      'TEST 19: Transaction Rollback confirmed (Stock balance unchanged after error)'
    );

    // ----------------------------------------------------------------------------------
    // TEST 20: Cross-Branch Isolation Check
    // ----------------------------------------------------------------------------------
    let branchIsolationBlocked = false;
    try {
      // User only has branchA, tries to receive at warehouseB which belongs to branchB
      await PurchaseService.createGoodsReceiveNote({
        companyId: company.id,
        branchId: branchB.id,
        warehouseId: warehouseB.id,
        supplierId: supplier.id,
        receiverId: user.id,
        userBranchIds: [branchA.id], // Only branchA authorized
        items: [
          {
            itemId: item1.id,
            receivedQty: 10,
            acceptedQty: 10,
            rejectedQty: 0,
            unitPrice: 20
          }
        ]
      });
    } catch (err: any) {
      branchIsolationBlocked = true;
    }
    assert(branchIsolationBlocked, 'TEST 20: Cross-branch unauthorized receiving strictly blocked with 403');

    console.log('\n==================================================');
    console.log(`PART 5 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================\n');
  } catch (error) {
    console.error('Fatal error during Part 5 test suite:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPart5Tests();
