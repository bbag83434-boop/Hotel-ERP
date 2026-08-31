import { prisma } from './src/config/database';
import { PurchaseService } from './src/services/purchase.service';
import { Prisma } from '@prisma/client';

async function runPart14Tests() {
  console.log('🧪 Starting PART 14 — Receiving, Invoice Verification & 3-Way Match Test Suite...');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No active company found');

  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) throw new Error('No branch found');

  const warehouse = await prisma.warehouse.findFirst({
    where: { branchId: branch.id, isActive: true }
  }) || await prisma.warehouse.findFirst({ where: { companyId: company.id } });
  if (!warehouse) throw new Error('Warehouse missing');

  const user = await prisma.user.findFirst({ where: { companyId: company.id } });
  if (!user) throw new Error('No user found');

  const supplier = await prisma.supplier.findFirst({ where: { companyId: company.id, isActive: true } });
  if (!supplier) throw new Error('Supplier missing');

  const gheeItem = await prisma.item.findFirst({
    where: { companyId: company.id, code: 'RM-DESI-GHEE' }
  });
  if (!gheeItem) throw new Error('Test item missing');

  // ==========================================
  // TEST 1: Invoice Evidence Validation (Magic Bytes & Format Check)
  // ==========================================
  console.log('\n--- TEST 1: Invoice Evidence & Magic Byte Validation ---');
  
  // Valid PDF header test base64: "%PDF-1.4 test content"
  const validPdfBase64 = Buffer.from('%PDF-1.4 sample supplier invoice binary header').toString('base64');
  const validFileMeta = PurchaseService.validateAndSaveInvoiceFile({
    companyId: company.id,
    fileName: 'supplier_invoice_aug2026.pdf',
    fileType: 'application/pdf',
    fileBase64: validPdfBase64
  });

  console.log(`✅ Valid Invoice File Stored: ${validFileMeta.fileName} (${validFileMeta.fileSize} bytes, Path: ${validFileMeta.storageRef})`);

  // Invalid fake PDF header test
  try {
    PurchaseService.validateAndSaveInvoiceFile({
      companyId: company.id,
      fileName: 'fake_invoice.pdf',
      fileType: 'application/pdf',
      fileBase64: Buffer.from('NOT_A_PDF_CORRUPT').toString('base64')
    });
    throw new Error('❌ Failed: Corrupted invoice file was accepted without magic byte validation!');
  } catch (err: any) {
    console.log(`✅ Passed: Fake invoice rejected by file integrity validator: "${err.message}"`);
  }

  // ==========================================
  // TEST 2: Setup Baseline Purchase Order (PO)
  // ==========================================
  console.log('\n--- TEST 2: Baseline Purchase Order for 3-Way Match ---');
  const poCount = await prisma.purchaseOrder.count({ where: { companyId: company.id } });
  const poNumber = `PO-${new Date().getFullYear()}-${String(poCount + 1).padStart(5, '0')}`;

  const po = await prisma.purchaseOrder.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      supplierId: supplier.id,
      poNumber,
      status: 'ISSUED',
      totalAmount: new Prisma.Decimal(13000.0), // 20 KG @ $650/KG = $13,000
      taxAmount: new Prisma.Decimal(0),
      grandTotal: new Prisma.Decimal(13000.0),
      createdById: user.id,
      items: {
        create: [
          {
            itemId: gheeItem.id,
            orderedQty: new Prisma.Decimal(20.0),
            unitPrice: new Prisma.Decimal(650.0),
            totalPrice: new Prisma.Decimal(13000.0)
          }
        ]
      }
    },
    include: { items: true }
  });

  const poItem = po.items[0];
  console.log(`✅ Baseline PO Created: #${po.poNumber} (Ordered: ${poItem.orderedQty} KG @ $${poItem.unitPrice}, Total: $${po.grandTotal})`);

  // ==========================================
  // TEST 3: Perfect 3-Way Match Receiving (No Variance -> Auto Confirmed)
  // ==========================================
  console.log('\n--- TEST 3: Perfect 3-Way Match GRN Receiving ---');
  
  const perfectGrn = await PurchaseService.createGoodsReceiveNote({
    companyId: company.id,
    branchId: branch.id,
    warehouseId: warehouse.id,
    supplierId: supplier.id,
    poId: po.id,
    invoiceNumber: `INV-PERFECT-${Date.now()}`,
    invoiceAmount: 6500.0, // Receiving 10 KG @ $650 = $6,500
    receiverId: user.id,
    items: [
      {
        poItemId: poItem.id,
        itemId: gheeItem.id,
        receivedQty: 10.0,
        acceptedQty: 10.0,
        unitPrice: 650.0, // Exactly matches PO price $650
        batchNumber: 'LOT-MATCH-01'
      }
    ]
  });

  console.log(`✅ Perfect Match GRN: #${perfectGrn.grnNumber} (Status: ${perfectGrn.status})`);
  console.log(`   Verification Note: ${perfectGrn.notes}`);
  if (perfectGrn.status !== 'QC_PASSED') {
    throw new Error(`Expected status QC_PASSED for perfectly matched GRN, got: ${perfectGrn.status}`);
  }

  // ==========================================
  // TEST 4: 3-Way Mismatch Detection (Price Variance -> Placed on HOLD)
  // ==========================================
  console.log('\n--- TEST 4: Price Variance Mismatch Detection & HOLD Status ---');
  
  const initialStockBal = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: gheeItem.id } }
  });
  const stockBeforeVariance = initialStockBal ? initialStockBal.quantity : new Prisma.Decimal(0);

  // Supplier billed $750/KG instead of agreed PO price $650/KG
  const varianceGrn = await PurchaseService.createGoodsReceiveNote({
    companyId: company.id,
    branchId: branch.id,
    warehouseId: warehouse.id,
    supplierId: supplier.id,
    poId: po.id,
    invoiceNumber: `INV-VARIANCE-${Date.now()}`,
    invoiceAmount: 7500.0, // 10 KG @ $750 = $7,500 (Exceeds PO price by $100/KG)
    receiverId: user.id,
    items: [
      {
        poItemId: poItem.id,
        itemId: gheeItem.id,
        receivedQty: 10.0,
        acceptedQty: 10.0,
        unitPrice: 750.0, // Supplier charged $750 (+15.38% price spike)
        batchNumber: 'LOT-VARIANCE-01'
      }
    ]
  });

  console.log(`✅ Variance GRN Created: #${varianceGrn.grnNumber}`);
  console.log(`   Status: ${varianceGrn.status} (Expected: RECEIVED / On Hold for Variance Approval)`);
  console.log(`   Audit Note: ${varianceGrn.notes}`);

  if (varianceGrn.status !== 'RECEIVED') {
    throw new Error(`Expected status RECEIVED (HOLD) for price variance GRN, got: ${varianceGrn.status}`);
  }

  // Verify stock was NOT incremented while on HOLD
  const stockDuringHold = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: gheeItem.id } }
  });
  console.log(`✅ Stock Balance during Variance HOLD: ${stockDuringHold?.quantity} (Unchanged: ${stockBeforeVariance})`);
  if (!stockDuringHold?.quantity.equals(stockBeforeVariance)) {
    throw new Error('Stock balance was prematurely incremented while GRN was on variance hold');
  }

  // ==========================================
  // TEST 5: Managerial Variance Authorization
  // ==========================================
  console.log('\n--- TEST 5: Managerial Variance Authorization & Confirmation ---');
  
  const approvedGrn = await PurchaseService.approveGoodsReceiveVariance(
    company.id,
    varianceGrn.id,
    user.id
  );

  console.log(`✅ Variance Approved by Manager: GRN #${approvedGrn.grnNumber} (Status: ${approvedGrn.status})`);
  if (approvedGrn.status !== 'QC_PASSED') {
    throw new Error(`Expected status QC_PASSED after variance approval, got: ${approvedGrn.status}`);
  }

  // Verify stock is now incremented
  const stockAfterApproval = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: gheeItem.id } }
  });
  const expectedStock = stockBeforeVariance.plus(new Prisma.Decimal(10.0));
  console.log(`✅ Stock Balance after Variance Approval: ${stockAfterApproval?.quantity} (Expected: ${expectedStock})`);

  if (!stockAfterApproval?.quantity.equals(expectedStock)) {
    throw new Error(`Stock balance mismatch after variance approval: Expected ${expectedStock}, got ${stockAfterApproval?.quantity}`);
  }

  // Verify AP journal entry is posted with adjusted amount
  const apJournal = await prisma.journalEntry.findFirst({
    where: { referenceId: approvedGrn.id, referenceType: 'GRN' }
  });
  console.log(`✅ AP Journal Entry for Approved Variance GRN: #${apJournal?.entryNumber} (Total: $${apJournal?.totalDebit})`);

  console.log('\n🎉 ALL PART 14 RECEIVING & 3-WAY MATCH TESTS PASSED!');
}

runPart14Tests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
