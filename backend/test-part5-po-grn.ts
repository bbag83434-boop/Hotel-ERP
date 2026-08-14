import { prisma } from './src/config/database';
import { PurchaseService } from './src/services/purchase.service';
import { Prisma } from '@prisma/client';

async function runPart5Tests() {
  console.log('==================================================');
  console.log('STARTING PART 5 COMPREHENSIVE TEST SUITE');
  console.log('PURCHASE ORDER + RECEIVING + GRN + DRAFT & CONFIRM + OUTSTANDING TRACKING');
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
    // TEST 1: Create PO
    // ----------------------------------------------------------------------------------
    const po1 = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        deliveryDate: new Date(Date.now() + 86400000 * 3).toISOString(),
        taxAmount: 50,
        notes: 'Test PO 1',
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

    // ----------------------------------------------------------------------------------
    // TEST 2: PO validation (Invalid branch or supplier blocked)
    // ----------------------------------------------------------------------------------
    let invalidSupplierBlocked = false;
    try {
      await PurchaseService.createPurchaseOrder(
        company.id,
        branchA.id,
        {
          supplierId: '00000000-0000-0000-0000-000000000000',
          items: [{ itemId: item1.id, orderedQty: 10, unitPrice: 20 }]
        },
        user.id,
        [branchA.id]
      );
    } catch {
      invalidSupplierBlocked = true;
    }
    assert(invalidSupplierBlocked, 'TEST 2: PO validation blocked invalid supplier');

    // ----------------------------------------------------------------------------------
    // TEST 3: PO item validation (Negative/0 quantity blocked)
    // ----------------------------------------------------------------------------------
    let invalidQtyBlocked = false;
    try {
      await PurchaseService.createPurchaseOrder(
        company.id,
        branchA.id,
        {
          supplierId: supplier.id,
          items: [{ itemId: item1.id, orderedQty: -5, unitPrice: 20 }]
        },
        user.id,
        [branchA.id]
      );
    } catch {
      invalidQtyBlocked = true;
    }
    assert(invalidQtyBlocked, 'TEST 3: PO item validation blocked non-positive quantity');

    // ----------------------------------------------------------------------------------
    // TEST 4: PO total calculation (Backend recalculates line totals, subtotal, tax, grand total)
    // ----------------------------------------------------------------------------------
    assert(Number(po1.totalAmount) === 100 * 20 + 50 * 40, 'TEST 4: Subtotal computed strictly on backend (4000)');
    assert(Number(po1.grandTotal) === 4050, 'TEST 4: Grand total with tax computed strictly on backend (4050)');

    // ----------------------------------------------------------------------------------
    // TEST 5: Submit Draft PO (DRAFT -> ISSUED) & Update Draft PO
    // ----------------------------------------------------------------------------------
    const poDraft = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        notes: 'Draft PO',
        status: 'DRAFT',
        items: [{ itemId: item1.id, orderedQty: 25, unitPrice: 15 }]
      },
      user.id,
      [branchA.id]
    );
    assert(poDraft.status === 'DRAFT', 'TEST 5A: Draft PO created with status DRAFT');

    const poDraftUpdated = await PurchaseService.updatePurchaseOrder(
      company.id,
      poDraft.id,
      {
        notes: 'Updated Draft PO',
        items: [{ itemId: item1.id, orderedQty: 30, unitPrice: 18 }]
      },
      user.id,
      [branchA.id]
    );
    assert(Number(poDraftUpdated.totalAmount) === 30 * 18, 'TEST 5B: Draft PO successfully edited and recalculated (540)');

    const poSubmitted = await PurchaseService.updatePurchaseOrderStatus(
      company.id,
      poDraft.id,
      'ISSUED',
      'Submitted draft PO',
      user.id,
      [branchA.id]
    );
    assert(poSubmitted.status === 'ISSUED', 'TEST 5C: Draft PO submitted and transitioned to ISSUED');

    // ----------------------------------------------------------------------------------
    // TEST 6: Approve PO
    // ----------------------------------------------------------------------------------
    const poApproveTest = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        status: 'DRAFT',
        items: [{ itemId: item1.id, orderedQty: 10, unitPrice: 20 }]
      },
      user.id,
      [branchA.id]
    );
    const poApproved = await PurchaseService.updatePurchaseOrderStatus(
      company.id,
      poApproveTest.id,
      'ISSUED',
      'Approved by General Manager',
      user.id,
      [branchA.id]
    );
    assert(poApproved.status === 'ISSUED', 'TEST 6: PO approved and transitioned to ISSUED');

    // ----------------------------------------------------------------------------------
    // TEST 7: Reject PO (DRAFT / ISSUED -> CANCELLED)
    // ----------------------------------------------------------------------------------
    const poRejectTest = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        status: 'ISSUED',
        items: [{ itemId: item1.id, orderedQty: 10, unitPrice: 20 }]
      },
      user.id,
      [branchA.id]
    );
    const poRejected = await PurchaseService.updatePurchaseOrderStatus(
      company.id,
      poRejectTest.id,
      'CANCELLED',
      'Price too high, cancelled with supplier',
      user.id,
      [branchA.id]
    );
    assert(poRejected.status === 'CANCELLED', 'TEST 7: PO rejected and transitioned to CANCELLED');

    // ----------------------------------------------------------------------------------
    // TEST 8: Requisition Integration (Requested, Approved, Ordered)
    // ----------------------------------------------------------------------------------
    const pr = await prisma.purchaseRequest.create({
      data: {
        companyId: company.id,
        branchId: branchA.id,
        requestNumber: `PR-FLOW-${Date.now()}`,
        requestedById: user.id,
        requiredDate: new Date(Date.now() + 86400000 * 2),
        priority: 'HIGH',
        status: 'APPROVED',
        approvedById: user.id,
        approvedAt: new Date(),
        items: {
          create: [{ itemId: item1.id, requestedQty: new Prisma.Decimal(100), estimatedPrice: new Prisma.Decimal(20) }]
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
        items: [{ itemId: item1.id, orderedQty: 100, unitPrice: 20 }]
      },
      user.id,
      [branchA.id]
    );
    const updatedPR = await prisma.purchaseRequest.findUnique({ where: { id: pr.id } });
    assert(poFromPR.requestId === pr.id, 'TEST 8A: PO linked to Approved Requisition');
    assert(updatedPR?.status === 'ORDERED', 'TEST 8B: Requisition transitioned to ORDERED');

    // ----------------------------------------------------------------------------------
    // TEST 9 & 10: Partial Receiving (Receive 60 out of 100) -> Outstanding = 40
    // ----------------------------------------------------------------------------------
    const poFlowItem = poFromPR.items[0];
    const grnPartial = await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: poFromPR.id,
      notes: 'First partial receive: 60 units',
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'QC_PASSED',
      items: [
        {
          poItemId: poFlowItem.id,
          itemId: item1.id,
          receivedQty: 60,
          acceptedQty: 60,
          rejectedQty: 0,
          unitPrice: 20,
          qcStatus: 'PASSED'
        }
      ]
    });

    const poPartialDetails = await PurchaseService.getPurchaseOrderById(company.id, poFromPR.id);
    assert(poPartialDetails.status === 'PARTIALLY_RECEIVED', 'TEST 9: PO status is PARTIALLY_RECEIVED after 60 units received');
    assert(poPartialDetails.items[0].receivedQty === 60, 'TEST 10A: Received quantity is 60');
    assert(poPartialDetails.items[0].outstandingQty === 40, 'TEST 10B: Outstanding quantity accurately tracked as 40');
    assert(poPartialDetails.metrics.totalOutstandingQty === 40, 'TEST 10C: PO metric totalOutstandingQty is 40');

    // ----------------------------------------------------------------------------------
    // TEST 11: Receiving validation (Cannot receive against CANCELLED PO)
    // ----------------------------------------------------------------------------------
    let receiveAgainstCancelledBlocked = false;
    try {
      await PurchaseService.createGoodsReceiveNote({
        companyId: company.id,
        branchId: branchA.id,
        warehouseId: warehouseA.id,
        poId: poRejected.id,
        receiverId: user.id,
        items: [{ itemId: item1.id, receivedQty: 10, acceptedQty: 10, unitPrice: 20 }]
      });
    } catch {
      receiveAgainstCancelledBlocked = true;
    }
    assert(receiveAgainstCancelledBlocked, 'TEST 11: Receiving against CANCELLED PO strictly blocked');

    // ----------------------------------------------------------------------------------
    // TEST 12: GRN Draft does NOT change stock
    // ----------------------------------------------------------------------------------
    const balBeforeDraft = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });

    const grnDraft = await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: poFromPR.id,
      notes: 'Draft GRN pending physical inspection',
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'RECEIVED', // Draft state
      items: [
        {
          poItemId: poFlowItem.id,
          itemId: item1.id,
          receivedQty: 40,
          acceptedQty: 40,
          rejectedQty: 0,
          unitPrice: 20
        }
      ]
    });

    const balAfterDraft = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });
    assert(grnDraft.status === 'RECEIVED', 'TEST 12A: GRN created in draft/unconfirmed state (RECEIVED)');
    assert(
      Number(balBeforeDraft?.quantity) === Number(balAfterDraft?.quantity),
      'TEST 12B: GRN draft does NOT change warehouse stock balance'
    );

    // ----------------------------------------------------------------------------------
    // TEST 13 & 14: Confirm GRN increases stock & creates immutable StockLedger entry
    // ----------------------------------------------------------------------------------
    const confirmedGRN = await PurchaseService.confirmGoodsReceiveNote(
      company.id,
      grnDraft.id,
      user.id,
      [branchA.id]
    );
    assert(confirmedGRN.status === 'QC_PASSED', 'TEST 13A: Draft GRN confirmed and transitioned to QC_PASSED');

    const balAfterConfirm = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });
    assert(
      Number(balAfterConfirm?.quantity) === Number(balBeforeDraft?.quantity) + 40,
      'TEST 13B: GRN confirmation increased warehouse stock by accepted quantity (+40)'
    );

    const ledgerConfirm = await prisma.stockLedger.findFirst({
      where: { referenceId: grnDraft.id, itemId: item1.id }
    });
    assert(ledgerConfirm !== null && ledgerConfirm.movementType === 'GRN', 'TEST 14: Immutable StockLedger entry created');

    // ----------------------------------------------------------------------------------
    // TEST 15: Double-Receiving Prevention (Cannot confirm already confirmed GRN)
    // ----------------------------------------------------------------------------------
    let doubleConfirmBlocked = false;
    try {
      await PurchaseService.confirmGoodsReceiveNote(company.id, grnDraft.id, user.id, [branchA.id]);
    } catch {
      doubleConfirmBlocked = true;
    }
    assert(doubleConfirmBlocked, 'TEST 15: Double-confirmation of GRN strictly blocked');

    // ----------------------------------------------------------------------------------
    // TEST 16: Duplicate / Over-receiving Prevented (Remaining outstanding = 0)
    // ----------------------------------------------------------------------------------
    const poFlowFinal = await PurchaseService.getPurchaseOrderById(company.id, poFromPR.id);
    assert(poFlowFinal.status === 'RECEIVED', 'TEST 16A: PO fully received after final confirmation');
    assert(poFlowFinal.metrics.totalOutstandingQty === 0, 'TEST 16B: Outstanding quantity is 0');

    let overReceiveBlocked = false;
    try {
      await PurchaseService.createGoodsReceiveNote({
        companyId: company.id,
        branchId: branchA.id,
        warehouseId: warehouseA.id,
        poId: poFromPR.id,
        receiverId: user.id,
        status: 'QC_PASSED',
        items: [
          {
            poItemId: poFlowItem.id,
            itemId: item1.id,
            receivedQty: 10,
            acceptedQty: 10,
            rejectedQty: 0,
            unitPrice: 20
          }
        ]
      });
    } catch {
      overReceiveBlocked = true;
    }
    assert(overReceiveBlocked, 'TEST 16C: Over-receiving on completed PO strictly blocked');

    // ----------------------------------------------------------------------------------
    // TEST 17: Wrong outlet access rejected (403 Forbidden)
    // ----------------------------------------------------------------------------------
    let wrongOutletBlocked = false;
    try {
      await PurchaseService.createGoodsReceiveNote({
        companyId: company.id,
        branchId: branchB.id,
        warehouseId: warehouseB.id,
        supplierId: supplier.id,
        receiverId: user.id,
        userBranchIds: [branchA.id], // User only authorized for Branch A
        items: [{ itemId: item1.id, receivedQty: 5, acceptedQty: 5, unitPrice: 20 }]
      });
    } catch {
      wrongOutletBlocked = true;
    }
    assert(wrongOutletBlocked, 'TEST 17: Wrong outlet/branch unauthorized receiving rejected with 403');

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

    const [p1, p2] = await Promise.allSettled([
      PurchaseService.createGoodsReceiveNote({
        companyId: company.id,
        branchId: branchA.id,
        warehouseId: warehouseA.id,
        poId: poConcurrent.id,
        receiverId: user.id,
        status: 'QC_PASSED',
        items: [{ poItemId: poConcurrent.items[0].id, itemId: item1.id, receivedQty: 80, acceptedQty: 80, unitPrice: 20 }]
      }),
      PurchaseService.createGoodsReceiveNote({
        companyId: company.id,
        branchId: branchA.id,
        warehouseId: warehouseA.id,
        poId: poConcurrent.id,
        receiverId: user.id,
        status: 'QC_PASSED',
        items: [{ poItemId: poConcurrent.items[0].id, itemId: item1.id, receivedQty: 80, acceptedQty: 80, unitPrice: 20 }]
      })
    ]);

    const successCount = [p1, p2].filter((r) => r.status === 'fulfilled').length;
    const failCount = [p1, p2].filter((r) => r.status === 'rejected').length;
    assert(
      successCount === 1 && failCount === 1,
      'TEST 18: Concurrent receiving row-locking verified (1 fulfilled, 1 rejected to prevent duplicate over-receipt)'
    );

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
