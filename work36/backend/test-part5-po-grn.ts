import { prisma } from './src/config/database';
import { PurchaseService } from './src/services/purchase.service';
import { Prisma } from '@prisma/client';

async function runPart5Tests() {
  console.log('==================================================');
  console.log('STARTING PART 5 COMPREHENSIVE 24-SCENARIO TEST SUITE');
  console.log('PURCHASE ORDER + RECEIVING + GRN + INVENTORY + AUDIT');
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
    // SETUP: Query existing live seeded entities (NO dummy/mock data)
    const company = await prisma.company.findFirst({ where: { isActive: true } });
    if (!company) throw new Error('Company not found');

    const user = await prisma.user.findFirst({ where: { companyId: company.id, isActive: true } });
    if (!user) throw new Error('User not found');

    const warehouses = await prisma.warehouse.findMany({ where: { companyId: company.id, isActive: true } });
    const warehouseA = warehouses[0];
    const warehouseB = warehouses.length > 1 ? warehouses[1] : warehouses[0];

    const branches = await prisma.branch.findMany({ where: { companyId: company.id } });
    if (branches.length < 2) throw new Error('Need at least 2 branches for outlet isolation tests');
    const branchA = branches.find((b) => b.id === warehouseA.branchId) || branches[0];
    const branchB = branches.find((b) => b.id !== branchA.id) || branches[1];

    const supplier = await prisma.supplier.findFirst({ where: { companyId: company.id, isActive: true } });
    if (!supplier) throw new Error('Supplier not found');

    const items = await prisma.item.findMany({ where: { companyId: company.id, isActive: true } });
    if (items.length < 2) throw new Error('Need at least 2 items');
    const item1 = items[0];
    const item2 = items[1];

    console.log(`Company: ${company.name}`);
    console.log(`Branch A: ${branchA.name}, Branch B: ${branchB.name}`);
    console.log(`Warehouse A: ${warehouseA.name}, Supplier: ${supplier.name}`);
    console.log(`Item 1: ${item1.name}, Item 2: ${item2.name}\n`);

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
    assert(po1.status === 'ISSUED' && po1.items.length === 2, 'TEST 1: PO created with status ISSUED');

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
    assert(invalidSupplierBlocked, 'TEST 2: PO validation blocked invalid supplier reference');

    // ----------------------------------------------------------------------------------
    // TEST 3: PO item validation (Negative / 0 quantity blocked)
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
    assert(invalidQtyBlocked, 'TEST 3: PO item validation blocked negative quantity');

    // ----------------------------------------------------------------------------------
    // TEST 4: PO total calculation (Backend recalculates line totals, subtotal, tax, grand total)
    // ----------------------------------------------------------------------------------
    assert(Number(po1.totalAmount) === 100 * 20 + 50 * 40, 'TEST 4A: Subtotal calculated strictly on backend (4000)');
    assert(Number(po1.grandTotal) === 4050, 'TEST 4B: Grand total with tax calculated strictly on backend (4050)');

    // ----------------------------------------------------------------------------------
    // TEST 5: Submit PO (Draft to Issued)
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
      'Approved by Branch Manager',
      user.id,
      [branchA.id]
    );
    assert(poApproved.status === 'ISSUED', 'TEST 6: PO approved and transitioned to ISSUED');

    // ----------------------------------------------------------------------------------
    // TEST 7: Reject PO (Transitions to CANCELLED)
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
      'Price exceeds budget, rejected',
      user.id,
      [branchA.id]
    );
    assert(poRejected.status === 'CANCELLED', 'TEST 7: PO rejected and transitioned to CANCELLED');

    // ----------------------------------------------------------------------------------
    // TEST 8: Create GRN
    // ----------------------------------------------------------------------------------
    const poForGRN = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        status: 'ISSUED',
        items: [{ itemId: item1.id, orderedQty: 100, unitPrice: 25 }]
      },
      user.id,
      [branchA.id]
    );
    const grnDirect = await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: poForGRN.id,
      notes: 'Direct GRN Creation',
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'QC_PASSED',
      items: [
        {
          poItemId: poForGRN.items[0].id,
          itemId: item1.id,
          receivedQty: 50,
          acceptedQty: 50,
          rejectedQty: 0,
          unitPrice: 25,
          qcStatus: 'PASSED'
        }
      ]
    });
    assert(grnDirect.status === 'QC_PASSED', 'TEST 8: Goods Receive Note created with QC status');

    // ----------------------------------------------------------------------------------
    // TEST 9: Partial receiving (PO status PARTIALLY_RECEIVED)
    // ----------------------------------------------------------------------------------
    const poPartialCheck = await PurchaseService.getPurchaseOrderById(company.id, poForGRN.id);
    assert(poPartialCheck.status === 'PARTIALLY_RECEIVED', 'TEST 9: PO status is PARTIALLY_RECEIVED after receiving 50/100');

    // ----------------------------------------------------------------------------------
    // TEST 10: Full receiving (PO status RECEIVED upon completing remaining 50)
    // ----------------------------------------------------------------------------------
    const grnSecond = await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: poForGRN.id,
      notes: 'Final delivery',
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'QC_PASSED',
      items: [
        {
          poItemId: poForGRN.items[0].id,
          itemId: item1.id,
          receivedQty: 50,
          acceptedQty: 50,
          rejectedQty: 0,
          unitPrice: 25,
          qcStatus: 'PASSED'
        }
      ]
    });
    const poFullCheck = await PurchaseService.getPurchaseOrderById(company.id, poForGRN.id);
    assert(poFullCheck.status === 'RECEIVED', 'TEST 10: PO status is RECEIVED upon full delivery (100/100)');

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
    // TEST 12: GRN draft does NOT change stock
    // ----------------------------------------------------------------------------------
    const balBeforeDraft = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });

    const poForDraft = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        status: 'ISSUED',
        items: [{ itemId: item1.id, orderedQty: 40, unitPrice: 20 }]
      },
      user.id,
      [branchA.id]
    );

    const grnDraft = await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: poForDraft.id,
      notes: 'Draft GRN awaiting inspection',
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'RECEIVED', // Draft status
      items: [
        {
          poItemId: poForDraft.items[0].id,
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
    assert(grnDraft.status === 'RECEIVED', 'TEST 12A: GRN created in draft status (RECEIVED)');
    assert(
      Number(balBeforeDraft?.quantity) === Number(balAfterDraft?.quantity),
      'TEST 12B: GRN draft does NOT change warehouse stock balance'
    );

    // ----------------------------------------------------------------------------------
    // TEST 13: GRN confirm increases stock
    // ----------------------------------------------------------------------------------
    const confirmedGRN = await PurchaseService.confirmGoodsReceiveNote(
      company.id,
      grnDraft.id,
      user.id,
      [branchA.id]
    );
    assert(confirmedGRN.status === 'QC_PASSED', 'TEST 13A: Draft GRN confirmed to QC_PASSED');

    const balAfterConfirm = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });
    assert(
      Number(balAfterConfirm?.quantity) === Number(balBeforeDraft?.quantity) + 40,
      'TEST 13B: GRN confirmation increased warehouse stock by accepted quantity (+40)'
    );

    // ----------------------------------------------------------------------------------
    // TEST 14: Stock movement created
    // ----------------------------------------------------------------------------------
    const ledgerEntry = await prisma.stockLedger.findFirst({
      where: { referenceId: grnDraft.id, itemId: item1.id }
    });
    assert(ledgerEntry !== null && ledgerEntry.movementType === 'GRN', 'TEST 14: Immutable StockLedger entry created with type GRN');

    // ----------------------------------------------------------------------------------
    // TEST 15: Double-receiving prevention
    // ----------------------------------------------------------------------------------
    let doubleConfirmBlocked = false;
    try {
      await PurchaseService.confirmGoodsReceiveNote(company.id, grnDraft.id, user.id, [branchA.id]);
    } catch {
      doubleConfirmBlocked = true;
    }
    assert(doubleConfirmBlocked, 'TEST 15: Re-confirming already confirmed GRN strictly blocked');

    // ----------------------------------------------------------------------------------
    // TEST 16: Duplicate GRN prevented / Over-receiving blocked
    // ----------------------------------------------------------------------------------
    let overReceiveBlocked = false;
    try {
      await PurchaseService.createGoodsReceiveNote({
        companyId: company.id,
        branchId: branchA.id,
        warehouseId: warehouseA.id,
        poId: poForDraft.id,
        receiverId: user.id,
        status: 'QC_PASSED',
        items: [
          {
            poItemId: poForDraft.items[0].id,
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
    assert(overReceiveBlocked, 'TEST 16: Duplicate / Over-receiving on completed PO strictly blocked');

    // ----------------------------------------------------------------------------------
    // TEST 17: Wrong outlet access rejected
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
    // TEST 18: Unauthorized PO approval rejected
    // ----------------------------------------------------------------------------------
    const poBranchA = await PurchaseService.createPurchaseOrder(
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

    let unauthorizedApprovalBlocked = false;
    try {
      await PurchaseService.updatePurchaseOrderStatus(
        company.id,
        poBranchA.id,
        'ISSUED',
        'Unauthorized approval attempt',
        user.id,
        [branchB.id] // User only has permissions for Branch B
      );
    } catch {
      unauthorizedApprovalBlocked = true;
    }
    assert(unauthorizedApprovalBlocked, 'TEST 18: Unauthorized cross-branch PO approval strictly rejected with 403');

    // ----------------------------------------------------------------------------------
    // TEST 19: Unauthorized receiving rejected
    // ----------------------------------------------------------------------------------
    let unauthorizedReceivingBlocked = false;
    try {
      await PurchaseService.createGoodsReceiveNote({
        companyId: company.id,
        branchId: branchA.id,
        warehouseId: warehouseA.id,
        poId: poBranchA.id,
        receiverId: user.id,
        userBranchIds: [branchB.id], // User only authorized for Branch B
        items: [{ itemId: item1.id, receivedQty: 5, acceptedQty: 5, unitPrice: 20 }]
      });
    } catch {
      unauthorizedReceivingBlocked = true;
    }
    assert(unauthorizedReceivingBlocked, 'TEST 19: Unauthorized cross-branch goods receiving strictly rejected with 403');

    // ----------------------------------------------------------------------------------
    // TEST 20: Transaction rollback
    // ----------------------------------------------------------------------------------
    const balBeforeRollback = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });

    let rollbackTriggered = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.stockBalance.update({
          where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } },
          data: { quantity: { increment: 999 } }
        });
        throw new Error('Simulated failure during GRN posting');
      });
    } catch {
      rollbackTriggered = true;
    }

    const balAfterRollback = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });
    assert(
      rollbackTriggered && Number(balBeforeRollback?.quantity) === Number(balAfterRollback?.quantity),
      'TEST 20: Transaction rollback confirmed (Stock balance unchanged after error)'
    );

    // ----------------------------------------------------------------------------------
    // TEST 21: Existing supplier integration
    // ----------------------------------------------------------------------------------
    const supplierBefore = await prisma.supplier.findUnique({ where: { id: supplier.id } });
    const poSupplierTest = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        status: 'ISSUED',
        items: [{ itemId: item1.id, orderedQty: 10, unitPrice: 50 }]
      },
      user.id,
      [branchA.id]
    );

    const test21InvoiceNo = `INV-SUPP-${Date.now()}`;
    const grnSupplierTest = await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: poSupplierTest.id,
      invoiceNumber: test21InvoiceNo,
      invoiceAmount: 500,
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'QC_PASSED',
      items: [{ poItemId: poSupplierTest.items[0].id, itemId: item1.id, receivedQty: 10, acceptedQty: 10, unitPrice: 50 }]
    });

    const supplierAfter = await prisma.supplier.findUnique({ where: { id: supplier.id } });
    const supplierLedger = await prisma.supplierLedger.findFirst({
      where: { referenceId: grnSupplierTest.id, supplierId: supplier.id }
    });
    const purchaseInvoice = await prisma.purchaseInvoice.findFirst({
      where: { grnId: grnSupplierTest.id }
    });
    assert(
      Number(supplierAfter?.balance) === Number(supplierBefore?.balance) + 500 &&
        supplierLedger !== null &&
        purchaseInvoice !== null &&
        Number(purchaseInvoice.totalAmount) === 500,
      'TEST 21: Existing supplier & Invoice integration confirmed (Invoice Amount 500 & payable ledger credited)'
    );

    // ----------------------------------------------------------------------------------
    // TEST 22: Existing item integration (Item Master costPrice sync)
    // ----------------------------------------------------------------------------------
    const item1Updated = await prisma.item.findUnique({ where: { id: item1.id } });
    assert(Number(item1Updated?.costPrice) === 50, 'TEST 22: Item Master costPrice automatically synced to latest purchase price (50)');

    // ----------------------------------------------------------------------------------
    // TEST 23: Existing requisition integration (Requested, Approved, Ordered)
    // ----------------------------------------------------------------------------------
    const prLive = await prisma.purchaseRequest.create({
      data: {
        companyId: company.id,
        branchId: branchA.id,
        requestNumber: `PR-REQ-${Date.now()}`,
        requestedById: user.id,
        requiredDate: new Date(Date.now() + 86400000 * 2),
        priority: 'MEDIUM',
        status: 'APPROVED',
        approvedById: user.id,
        approvedAt: new Date(),
        items: {
          create: [{ itemId: item1.id, requestedQty: new Prisma.Decimal(80), estimatedPrice: new Prisma.Decimal(50) }]
        }
      }
    });

    const poFromLivePR = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        requestId: prLive.id,
        status: 'ISSUED',
        items: [{ itemId: item1.id, orderedQty: 80, unitPrice: 50 }]
      },
      user.id,
      [branchA.id]
    );

    const prLiveCheck = await prisma.purchaseRequest.findUnique({ where: { id: prLive.id } });
    assert(
      poFromLivePR.requestId === prLive.id && prLiveCheck?.status === 'ORDERED',
      'TEST 23: Existing requisition integration confirmed (PR transitioned to ORDERED upon PO generation)'
    );

    // ----------------------------------------------------------------------------------
    // TEST 24: Existing inventory integration (Stock balance & ledger tracking)
    // ----------------------------------------------------------------------------------
    const balInventoryCheck = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });
    const latestStockLedger = await prisma.stockLedger.findFirst({
      where: { warehouseId: warehouseA.id, itemId: item1.id },
      orderBy: { createdAt: 'desc' }
    });
    assert(
      balInventoryCheck !== null && Number(balInventoryCheck.quantity) > 0 && latestStockLedger?.movementType === 'GRN',
      'TEST 24: Existing inventory integration confirmed (StockBalance and StockLedger active in warehouse)'
    );

    // ----------------------------------------------------------------------------------
    // TEST 25: Duplicate Supplier Invoice Number Check (Blocked)
    // ----------------------------------------------------------------------------------
    let duplicateInvoiceBlocked = false;
    let duplicateErrorMsg = '';
    try {
      await PurchaseService.createGoodsReceiveNote({
        companyId: company.id,
        branchId: branchA.id,
        warehouseId: warehouseA.id,
        supplierId: supplier.id,
        invoiceNumber: test21InvoiceNo, // Attempt to reuse invoice number from TEST 21
        invoiceAmount: 500,
        receiverId: user.id,
        userBranchIds: [branchA.id],
        status: 'QC_PASSED',
        items: [{ itemId: item1.id, receivedQty: 10, acceptedQty: 10, unitPrice: 50 }]
      });
    } catch (err: any) {
      duplicateInvoiceBlocked = true;
      duplicateErrorMsg = err.message;
    }
    assert(
      duplicateInvoiceBlocked && duplicateErrorMsg === 'Duplicate supplier invoice detected.',
      'TEST 25: Duplicate supplier invoice strictly blocked with "Duplicate supplier invoice detected."'
    );

    // ----------------------------------------------------------------------------------
    // TEST 26: 3-Way Price Verification: PO Value Exceeded (+₹500 variance)
    // ----------------------------------------------------------------------------------
    const poVarianceTest = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        status: 'ISSUED',
        items: [{ itemId: item1.id, orderedQty: 100, unitPrice: 100 }] // PO Base = 10,000
      },
      user.id,
      [branchA.id]
    );

    const grnVariance = await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: poVarianceTest.id,
      invoiceNumber: `INV-VAR-${Date.now()}`,
      invoiceAmount: 12800,
      taxAmount: 1800,
      freightAmount: 500,
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'QC_PASSED',
      items: [
        {
          poItemId: poVarianceTest.items[0].id,
          itemId: item1.id,
          receivedQty: 100,
          acceptedQty: 100,
          unitPrice: 105 // Invoice Base = 10,500 (+500 difference)
        }
      ]
    });
    assert(
      grnVariance.notes?.includes('PO_VALUE_EXCEEDED') === true,
      'TEST 26: 3-Way match flagged variance (PO Base: 10000, Invoice Base: 10500 -> PO_VALUE_EXCEEDED)'
    );

    // ----------------------------------------------------------------------------------
    // TEST 27: 3-Way Price Verification: Amount Matched
    // ----------------------------------------------------------------------------------
    const poMatchTest = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        status: 'ISSUED',
        items: [{ itemId: item1.id, orderedQty: 50, unitPrice: 100 }] // PO Base = 5000
      },
      user.id,
      [branchA.id]
    );

    const grnMatched = await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: poMatchTest.id,
      invoiceNumber: `INV-MATCH-${Date.now()}`,
      invoiceAmount: 5900,
      taxAmount: 900,
      freightAmount: 0,
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'QC_PASSED',
      items: [
        {
          poItemId: poMatchTest.items[0].id,
          itemId: item1.id,
          receivedQty: 50,
          acceptedQty: 50,
          unitPrice: 100 // Invoice Base = 5000 (Exact match)
        }
      ]
    });
    assert(
      grnMatched.notes?.includes('AMOUNT_MATCHED') === true,
      'TEST 27: 3-Way match flagged exact price match (PO Base: 5000, Invoice Base: 5000 -> AMOUNT_MATCHED)'
    );

    // ----------------------------------------------------------------------------------
    // TEST 28: Variance Approval Workflow (Blocked -> Pending Approval -> Approved)
    // ----------------------------------------------------------------------------------
    const poVarianceWorkflow = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        status: 'ISSUED',
        items: [{ itemId: item1.id, orderedQty: 100, unitPrice: 100 }] // PO Base = 10,000
      },
      user.id,
      [branchA.id]
    );

    const balBeforeVariance = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });

    const grnPendingApproval = await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: poVarianceWorkflow.id,
      invoiceNumber: `INV-VAR-PENDING-${Date.now()}`,
      invoiceAmount: 10500,
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'QC_PASSED', // Normal submit attempted
      items: [
        {
          poItemId: poVarianceWorkflow.items[0].id,
          itemId: item1.id,
          receivedQty: 100,
          acceptedQty: 100,
          unitPrice: 105 // 5% price increase -> 10,500
        }
      ]
    });

    const balDuringPending = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });

    assert(
      grnPendingApproval.status === 'RECEIVED' &&
        grnPendingApproval.notes?.includes('PENDING_VARIANCE_APPROVAL') === true &&
        Number(balBeforeVariance?.quantity) === Number(balDuringPending?.quantity),
      'TEST 28A: Unapproved excess invoice variance blocked from auto-confirming; stock balance unchanged in PENDING state'
    );

    const grnApproved = await PurchaseService.approveGoodsReceiveVariance(
      company.id,
      grnPendingApproval.id,
      user.id,
      [branchA.id]
    );

    const balAfterApproval = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });

    assert(
      grnApproved.status === 'QC_PASSED' &&
        Number(balAfterApproval?.quantity) === Number(balBeforeVariance?.quantity) + 100,
      'TEST 28B: Authorized manager approval confirms GRN and increases stock by +100'
    );

    // ----------------------------------------------------------------------------------
    // TEST 29: Variance Rejection Workflow (Blocked -> Rejected -> Excess Not Finalized)
    // ----------------------------------------------------------------------------------
    const poVarianceReject = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        status: 'ISSUED',
        items: [{ itemId: item1.id, orderedQty: 50, unitPrice: 100 }]
      },
      user.id,
      [branchA.id]
    );

    const grnToReject = await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: poVarianceReject.id,
      invoiceNumber: `INV-VAR-REJ-${Date.now()}`,
      invoiceAmount: 6000,
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'QC_PASSED',
      items: [
        {
          poItemId: poVarianceReject.items[0].id,
          itemId: item1.id,
          receivedQty: 50,
          acceptedQty: 50,
          unitPrice: 120 // 20% price increase
        }
      ]
    });

    const grnRejected = await PurchaseService.rejectGoodsReceiveVariance(
      company.id,
      grnToReject.id,
      'Price exceeds agreed contractual rate',
      user.id,
      [branchA.id]
    );

    assert(
      grnRejected.status === 'REJECTED' &&
        grnRejected.notes?.includes('VARIANCE REJECTED: Price exceeds agreed contractual rate') === true,
      'TEST 29: Rejected variance strictly marked REJECTED and excess amount not finalized'
    );

    // ----------------------------------------------------------------------------------
    // TEST 30: Multi-Stage Receiving (PO = 100 -> Receive 60 -> PARTIALLY_RECEIVED -> Receive 40 -> RECEIVED)
    // ----------------------------------------------------------------------------------
    const poMultiStage = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        status: 'ISSUED',
        items: [{ itemId: item1.id, orderedQty: 100, unitPrice: 50 }]
      },
      user.id,
      [branchA.id]
    );

    // Stage 1: Receive 60 KG
    await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: poMultiStage.id,
      invoiceNumber: `INV-STAGE1-${Date.now()}`,
      invoiceAmount: 3000,
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'QC_PASSED',
      items: [
        {
          poItemId: poMultiStage.items[0].id,
          itemId: item1.id,
          receivedQty: 60,
          acceptedQty: 60,
          unitPrice: 50
        }
      ]
    });

    const poAfterStage1 = await PurchaseService.getPurchaseOrderById(company.id, poMultiStage.id);
    assert(
      poAfterStage1.status === 'PARTIALLY_RECEIVED' &&
        Number(poAfterStage1.items[0].receivedQty) === 60 &&
        poAfterStage1.items[0].outstandingQty === 40,
      'TEST 30A: Multi-stage receiving Stage 1: Received 60/100 -> Status is PARTIALLY_RECEIVED (40 Outstanding)'
    );

    // Stage 2: Receive remaining 40 KG
    await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: poMultiStage.id,
      invoiceNumber: `INV-STAGE2-${Date.now()}`,
      invoiceAmount: 2000,
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'QC_PASSED',
      items: [
        {
          poItemId: poMultiStage.items[0].id,
          itemId: item1.id,
          receivedQty: 40,
          acceptedQty: 40,
          unitPrice: 50
        }
      ]
    });

    const poAfterStage2 = await PurchaseService.getPurchaseOrderById(company.id, poMultiStage.id);
    assert(
      poAfterStage2.status === 'RECEIVED' &&
        Number(poAfterStage2.items[0].receivedQty) === 100 &&
        poAfterStage2.items[0].outstandingQty === 0 &&
        poAfterStage2.metrics.isFullyReceived === true,
      'TEST 30B: Multi-stage receiving Stage 2: Received remaining 40/40 -> Status is RECEIVED (Fully Received)'
    );

    // ----------------------------------------------------------------------------------
    // TEST 31: Supplier Invoice Upload - PDF format & file integrity
    // ----------------------------------------------------------------------------------
    const dummyPdfContent = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF').toString('base64');
    const invoicePdfNumber = `INV-PDF-${Date.now()}`;
    const uploadPdfRes = await PurchaseService.uploadSupplierInvoice({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      supplierId: supplier.id,
      poId: poMultiStage.id,
      invoiceNumber: invoicePdfNumber,
      invoiceDate: '2026-08-15',
      invoiceAmount: 5000,
      fileName: 'vendor_invoice_doc.pdf',
      fileType: 'application/pdf',
      fileBase64: dummyPdfContent,
      actorId: user.id,
      userBranchIds: [branchA.id]
    });
    assert(
      uploadPdfRes.fileName === 'vendor_invoice_doc.pdf' &&
        uploadPdfRes.fileType === 'application/pdf' &&
        uploadPdfRes.storageRef.includes('uploads/invoices') &&
        uploadPdfRes.invoiceNumber === invoicePdfNumber &&
        uploadPdfRes.invoiceAmount === 5000,
      'TEST 31: Supplier invoice PDF uploaded, validated magic bytes, and linked with storage reference'
    );

    // ----------------------------------------------------------------------------------
    // TEST 32: Supplier Invoice Upload - JPEG image photo & linkage
    // ----------------------------------------------------------------------------------
    const dummyJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60, 0x00, 0x60, 0x00, 0x00, 0xff, 0xd9]);
    const invoiceJpgNumber = `INV-JPG-${Date.now()}`;
    const uploadJpgRes = await PurchaseService.uploadSupplierInvoice({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      supplierId: supplier.id,
      invoiceNumber: invoiceJpgNumber,
      invoiceAmount: 2500,
      fileName: 'camera_capture_receipt.jpg',
      fileType: 'image/jpeg',
      fileBase64: dummyJpegBuffer.toString('base64'),
      actorId: user.id,
      userBranchIds: [branchA.id]
    });
    assert(
      uploadJpgRes.fileType === 'image/jpeg' &&
        uploadJpgRes.storageRef.endsWith('.jpg') &&
        uploadJpgRes.invoiceAmount === 2500,
      'TEST 32: Supplier invoice JPEG photo upload validated and stored securely'
    );

    // ----------------------------------------------------------------------------------
    // TEST 33: Unsupported file type and corrupted file rejection
    // ----------------------------------------------------------------------------------
    let corruptRejected = false;
    try {
      await PurchaseService.uploadSupplierInvoice({
        companyId: company.id,
        branchId: branchA.id,
        warehouseId: warehouseA.id,
        supplierId: supplier.id,
        invoiceNumber: `INV-CORRUPT-${Date.now()}`,
        invoiceAmount: 1000,
        fileName: 'malicious_script.exe',
        fileType: 'application/x-msdownload' as any,
        fileBase64: Buffer.from('MZ...').toString('base64'),
        actorId: user.id
      });
    } catch (e: any) {
      corruptRejected = e.message.includes('Unsupported file type');
    }
    assert(corruptRejected, 'TEST 33: Unsupported file type strictly rejected without execution');

    // ----------------------------------------------------------------------------------
    // TEST 34: GRN creation with attached invoice metadata
    // ----------------------------------------------------------------------------------
    const grnWithAttachmentNo = `INV-ATTACH-${Date.now()}`;
    const grnWithAttachment = await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      supplierId: supplier.id,
      invoiceNumber: grnWithAttachmentNo,
      invoiceAmount: 1500,
      invoiceAttachment: {
        fileName: 'vendor_receipt.png',
        fileType: 'image/png',
        fileBase64: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]).toString('base64')
      },
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'QC_PASSED',
      items: [{ itemId: item1.id, receivedQty: 30, acceptedQty: 30, unitPrice: 50 }]
    });
    assert(
      grnWithAttachment.id !== undefined && grnWithAttachment.status === 'QC_PASSED',
      'TEST 34: GRN created with validated supplier invoice attachment metadata & confirmed'
    );

    // ----------------------------------------------------------------------------------
    // TEST 35: Idempotency Key Duplicate PO Prevention
    // ----------------------------------------------------------------------------------
    const test35IdempKey = `IDEMP-PO-TEST-${Date.now()}`;
    const poFirst = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        status: 'ISSUED',
        idempotencyKey: test35IdempKey,
        items: [{ itemId: item1.id, orderedQty: 25, unitPrice: 50 }]
      },
      user.id,
      [branchA.id]
    );

    const poDuplicateSubmit = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        status: 'ISSUED',
        idempotencyKey: test35IdempKey,
        items: [{ itemId: item1.id, orderedQty: 25, unitPrice: 50 }]
      },
      user.id,
      [branchA.id]
    );

    assert(
      poFirst.id === poDuplicateSubmit.id && poDuplicateSubmit.poNumber === poFirst.poNumber,
      'TEST 35: Idempotency key duplicate PO submit returns existing PO without creating duplicate record'
    );

    // ----------------------------------------------------------------------------------
    // TEST 36: Idempotency Key Duplicate GRN Prevention (No duplicate stock increase)
    // ----------------------------------------------------------------------------------
    const test36IdempKey = `IDEMP-GRN-TEST-${Date.now()}`;
    const stockBefore36 = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });

    const grnFirst = await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      supplierId: supplier.id,
      invoiceNumber: `INV-IDEMP-${Date.now()}`,
      invoiceAmount: 500,
      idempotencyKey: test36IdempKey,
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'QC_PASSED',
      items: [{ itemId: item1.id, receivedQty: 10, acceptedQty: 10, unitPrice: 50 }]
    });

    const grnDuplicateSubmit = await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      supplierId: supplier.id,
      invoiceNumber: `INV-IDEMP-RETRY-${Date.now()}`,
      invoiceAmount: 500,
      idempotencyKey: test36IdempKey,
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'QC_PASSED',
      items: [{ itemId: item1.id, receivedQty: 10, acceptedQty: 10, unitPrice: 50 }]
    });

    const stockAfter36 = await prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: warehouseA.id, itemId: item1.id } }
    });

    assert(
      grnFirst.id === grnDuplicateSubmit.id &&
        Number(stockAfter36?.quantity) === Number(stockBefore36?.quantity) + 10,
      'TEST 36: Idempotency key network retry returns existing GRN with zero duplicate stock movements'
    );

    // ----------------------------------------------------------------------------------
    // TEST 37: Outlet A user receiving into Outlet B warehouse strictly rejected
    // ----------------------------------------------------------------------------------
    let crossOutletRejected = false;
    try {
      await PurchaseService.createGoodsReceiveNote({
        companyId: company.id,
        branchId: branchB.id,
        warehouseId: warehouseB.id,
        supplierId: supplier.id,
        invoiceNumber: `INV-CROSS-${Date.now()}`,
        invoiceAmount: 500,
        receiverId: user.id,
        userBranchIds: [branchA.id], // User only authorized for Branch A
        status: 'QC_PASSED',
        items: [{ itemId: item1.id, receivedQty: 10, acceptedQty: 10, unitPrice: 50 }]
      });
    } catch (e: any) {
      crossOutletRejected = e.message.includes('Outlet A user cannot receive goods into Outlet B');
    }
    assert(crossOutletRejected, 'TEST 37: Outlet A user receiving into Outlet B warehouse strictly rejected with 403');

    // ----------------------------------------------------------------------------------
    // TEST 38: Inactive user receiving goods strictly rejected
    // ----------------------------------------------------------------------------------
    const inactiveUser = await prisma.user.create({
      data: {
        companyId: company.id,
        email: `inactive-${Date.now()}@hotel.com`,
        username: `inactive_${Date.now()}`,
        passwordHash: 'dummy',
        firstName: 'Inactive',
        lastName: 'User',
        isActive: false
      }
    });

    let inactiveRejected = false;
    try {
      await PurchaseService.createGoodsReceiveNote({
        companyId: company.id,
        branchId: branchA.id,
        warehouseId: warehouseA.id,
        supplierId: supplier.id,
        invoiceNumber: `INV-INACTIVE-${Date.now()}`,
        invoiceAmount: 500,
        receiverId: inactiveUser.id,
        userBranchIds: [branchA.id],
        status: 'QC_PASSED',
        items: [{ itemId: item1.id, receivedQty: 10, acceptedQty: 10, unitPrice: 50 }]
      });
    } catch (e: any) {
      inactiveRejected = e.message.includes('User account is inactive');
    }
    assert(inactiveRejected, 'TEST 38: Inactive user account receiving goods strictly blocked with 403');

    // ----------------------------------------------------------------------------------
    // TEST 39: Requisition Tracking Metrics (Requested = 100, Approved = 100, Ordered = 100, Received = 60, Outstanding = 40)
    // ----------------------------------------------------------------------------------
    const prTrack = await prisma.purchaseRequest.create({
      data: {
        companyId: company.id,
        branchId: branchA.id,
        requestNumber: `PR-TRACK-${Date.now()}`,
        requestedById: user.id,
        requiredDate: new Date(Date.now() + 86400000 * 3),
        priority: 'HIGH',
        status: 'APPROVED',
        approvedById: user.id,
        approvedAt: new Date(),
        items: {
          create: [{ itemId: item1.id, requestedQty: new Prisma.Decimal(100), estimatedPrice: new Prisma.Decimal(50) }]
        }
      }
    });

    const poTrack = await PurchaseService.createPurchaseOrder(
      company.id,
      branchA.id,
      {
        supplierId: supplier.id,
        requestId: prTrack.id,
        status: 'ISSUED',
        items: [{ itemId: item1.id, orderedQty: 100, unitPrice: 50 }]
      },
      user.id,
      [branchA.id]
    );

    // Receive 60 KG
    await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: poTrack.id,
      invoiceNumber: `INV-PR-STAGE1-${Date.now()}`,
      invoiceAmount: 3000,
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'QC_PASSED',
      items: [{ poItemId: poTrack.items[0].id, itemId: item1.id, receivedQty: 60, acceptedQty: 60, unitPrice: 50 }]
    });

    const prTrackCheck1 = await PurchaseService.getPurchaseRequests(company.id, { branchId: branchA.id });
    const prTrackItem1 = prTrackCheck1.requests.find((r) => r.id === prTrack.id);

    assert(
      prTrackItem1?.metrics?.requestedQty === 100 &&
        prTrackItem1?.metrics?.approvedQty === 100 &&
        prTrackItem1?.metrics?.orderedQty === 100 &&
        prTrackItem1?.metrics?.receivedQty === 60 &&
        prTrackItem1?.metrics?.outstandingQty === 40 &&
        prTrackItem1?.metrics?.isCompleted === false,
      'TEST 39A: Requisition partial tracking confirmed (Requested = 100, Approved = 100, Ordered = 100, Received = 60, Outstanding = 40, isCompleted: false)'
    );

    // Receive remaining 40 KG
    await PurchaseService.createGoodsReceiveNote({
      companyId: company.id,
      branchId: branchA.id,
      warehouseId: warehouseA.id,
      poId: poTrack.id,
      invoiceNumber: `INV-PR-STAGE2-${Date.now()}`,
      invoiceAmount: 2000,
      receiverId: user.id,
      userBranchIds: [branchA.id],
      status: 'QC_PASSED',
      items: [{ poItemId: poTrack.items[0].id, itemId: item1.id, receivedQty: 40, acceptedQty: 40, unitPrice: 50 }]
    });

    const prTrackCheck2 = await PurchaseService.getPurchaseRequests(company.id, { branchId: branchA.id });
    const prTrackItem2 = prTrackCheck2.requests.find((r) => r.id === prTrack.id);

    assert(
      prTrackItem2?.metrics?.requestedQty === 100 &&
        prTrackItem2?.metrics?.receivedQty === 100 &&
        prTrackItem2?.metrics?.outstandingQty === 0 &&
        prTrackItem2?.metrics?.isCompleted === true,
      'TEST 39B: Requisition full completion confirmed (Requested = 100, Received = 100, Outstanding = 0, isCompleted: true)'
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
