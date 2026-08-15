import { prisma } from './src/config/database';
import { PurchaseService } from './src/services/purchase.service';
import { Prisma } from '@prisma/client';

async function runPart13Tests() {
  console.log('🧪 Starting PART 13 — Procurement & Supplier Management Test Suite...');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No active company found');

  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) throw new Error('No branch found');

  let warehouse = await prisma.warehouse.findFirst({
    where: { branchId: branch.id, isActive: true }
  });
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        name: `${branch.name} Inward Provisioning Store`,
        code: `WH-INWARD-${branch.code}`,
        isCentral: false,
        isActive: true
      }
    });
  }

  const user = await prisma.user.findFirst({ where: { companyId: company.id } });
  if (!user) throw new Error('No user found');

  const unitKg = await prisma.unit.findFirst({ where: { companyId: company.id, symbol: 'kg' } })
    || await prisma.unit.create({ data: { companyId: company.id, name: 'Kilogram', symbol: 'kg' } });

  const category = await prisma.category.findFirst({ where: { companyId: company.id } });
  if (!category) throw new Error('Category missing');

  const gheeItem = await prisma.item.upsert({
    where: { companyId_code: { companyId: company.id, code: 'RM-DESI-GHEE' } },
    update: { costPrice: 650.0 },
    create: {
      companyId: company.id,
      categoryId: category.id,
      unitId: unitKg.id,
      name: 'Pure Cow Desi Ghee',
      code: 'RM-DESI-GHEE',
      type: 'RAW_MATERIAL',
      costPrice: 650.0,
      minStockLevel: 20.0,
      isActive: true
    }
  });

  const cardamomItem = await prisma.item.upsert({
    where: { companyId_code: { companyId: company.id, code: 'RM-CARDAMOM-01' } },
    update: { costPrice: 2800.0 },
    create: {
      companyId: company.id,
      categoryId: category.id,
      unitId: unitKg.id,
      name: 'Green Cardamom Pods',
      code: 'RM-CARDAMOM-01',
      type: 'RAW_MATERIAL',
      costPrice: 2800.0,
      minStockLevel: 5.0,
      isActive: true
    }
  });

  // ==========================================
  // TEST 1: Supplier Profile Creation & Compliance
  // ==========================================
  console.log('\n--- TEST 1: Supplier Profile & Master Data ---');
  const supplier = await prisma.supplier.upsert({
    where: { companyId_code: { companyId: company.id, code: 'SUP-DAIRY-HERITAGE' } },
    update: {
      name: 'Royal Heritage Organic Dairy & Spices Ltd',
      taxNumber: 'GSTIN27AABCU9603R1ZM',
      paymentTerms: 'NET_30',
      contactPerson: 'Harish Mehta',
      email: 'orders@heritagedairy.com',
      phone: '+91 98200 44556',
      isActive: true
    },
    create: {
      companyId: company.id,
      code: 'SUP-DAIRY-HERITAGE',
      name: 'Royal Heritage Organic Dairy & Spices Ltd',
      contactPerson: 'Harish Mehta',
      email: 'orders@heritagedairy.com',
      phone: '+91 98200 44556',
      taxNumber: 'GSTIN27AABCU9603R1ZM',
      paymentTerms: 'NET_30',
      address: 'Plot 45, Dairy Hub, Maharashtra',
      isActive: true
    }
  });

  console.log(`✅ Supplier Registered: [${supplier.code}] "${supplier.name}" (GSTIN: ${supplier.taxNumber}, Terms: ${supplier.paymentTerms})`);

  // ==========================================
  // TEST 2: Material Request / Purchase Requisition (PR)
  // ==========================================
  console.log('\n--- TEST 2: Material Request / Purchase Requisition Creation ---');
  const pr = await PurchaseService.createPurchaseRequest(
    company.id,
    branch.id,
    {
      priority: 'HIGH',
      requiredDate: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days lead time
      notes: 'Urgent restocking for festive banquet season',
      items: [
        {
          itemId: gheeItem.id,
          requestedQty: 50.0, // 50 KG Desi Ghee
          estimatedPrice: 650.0,
          notes: 'Pure cow ghee A2 grade'
        },
        {
          itemId: cardamomItem.id,
          requestedQty: 10.0, // 10 KG Cardamom
          estimatedPrice: 2800.0,
          notes: 'Green premium pods'
        }
      ]
    },
    user.id
  );

  console.log(`✅ Purchase Request Created: #${pr.requestNumber} (Priority: ${pr.priority}, Status: ${pr.status})`);
  console.log(`   Items: ${pr.items.length} lines`);

  // ==========================================
  // TEST 3: PR Approval & Auto-Generation of Purchase Order (PO)
  // ==========================================
  console.log('\n--- TEST 3: Purchase Request Approval & PO Generation ---');
  const approvalRes = await PurchaseService.approvePurchaseRequest(
    company.id,
    pr.id,
    user.id,
    {
      autoCreatePO: true,
      supplierId: supplier.id,
      notes: 'Approved by Head of Procurement'
    }
  );

  const po = approvalRes.purchaseOrder;
  if (!po) throw new Error('PO was not automatically generated on PR approval');

  console.log(`✅ PR #${pr.requestNumber} Approved. Auto-Generated PO: #${po.poNumber}`);
  console.log(`   PO Grand Total: $${po.grandTotal} | Status: ${po.status}`);

  // ==========================================
  // TEST 4: Goods Receipt Note (GRN) & Stock Ledger Inward
  // ==========================================
  console.log('\n--- TEST 4: Goods Receipt Note (GRN) Inward Execution ---');
  
  const initialGheeStock = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: gheeItem.id } }
  });
  const gheeBefore = initialGheeStock ? initialGheeStock.quantity : new Prisma.Decimal(0);

  const grn = await PurchaseService.createGoodsReceiveNote({
    companyId: company.id,
    branchId: branch.id,
    warehouseId: warehouse.id,
    supplierId: supplier.id,
    poId: po.id,
    invoiceNumber: `INV-SUP-${Date.now()}`,
    invoiceAmount: Number(po.grandTotal),
    notes: 'All items inspected & quality verified at receiving dock',
    receiverId: user.id,
    items: [
      {
        itemId: gheeItem.id,
        receivedQty: 50.0,
        acceptedQty: 50.0,
        unitPrice: 650.0,
        batchNumber: 'LOT-GHEE-2026-08',
        expiryDate: new Date(Date.now() + 86400000 * 180).toISOString() // 6 months shelf life
      },
      {
        itemId: cardamomItem.id,
        receivedQty: 10.0,
        acceptedQty: 10.0,
        unitPrice: 2800.0,
        batchNumber: 'LOT-CARD-2026-08',
        expiryDate: new Date(Date.now() + 86400000 * 365).toISOString() // 1 year shelf life
      }
    ]
  });

  console.log(`✅ GRN Created & Received: #${grn.grnNumber} (Status: ${grn.status})`);
  console.log(`   Total Value: $${grn.totalAmount}`);

  // Verify stock increment
  const updatedGheeStock = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: gheeItem.id } }
  });
  const expectedGhee = gheeBefore.plus(new Prisma.Decimal(50.0));
  console.log(`✅ Ghee Warehouse Stock: ${updatedGheeStock?.quantity} KG (Expected: ${expectedGhee})`);

  if (!updatedGheeStock?.quantity.equals(expectedGhee)) {
    throw new Error(`Stock balance increment mismatch: Expected ${expectedGhee}, got ${updatedGheeStock?.quantity}`);
  }

  // ==========================================
  // TEST 5: Stock Ledger GRN Movements
  // ==========================================
  console.log('\n--- TEST 5: Immutable Stock Ledger Inward Audit ---');
  const grnLedgers = await prisma.stockLedger.findMany({
    where: { referenceId: grn.id, movementType: 'GRN' }
  });

  console.log(`✅ Recorded ${grnLedgers.length} GRN inward movements in Stock Ledger:`);
  grnLedgers.forEach((l) => {
    console.log(`   - Wh: ${l.warehouseId.slice(0, 8)}... | Item: ${l.itemId.slice(0, 8)}... | Inward: +${l.changeQty} @ $${l.unitCost} = $${l.totalCost}`);
  });

  if (grnLedgers.length !== 2) {
    throw new Error('Stock ledger entries for GRN inward were not recorded');
  }

  // ==========================================
  // TEST 6: Accounts Payable & GL Journal Verification
  // ==========================================
  console.log('\n--- TEST 6: Double-Entry Accounts Payable General Ledger Verification ---');
  const apJournal = await prisma.journalEntry.findFirst({
    where: { referenceId: grn.id, referenceType: 'GRN' },
    include: { lines: { include: { account: true } } }
  });

  if (apJournal) {
    console.log(`✅ AP Journal Entry Posted: #${apJournal.entryNumber} (Total: $${apJournal.totalDebit})`);
    apJournal.lines.forEach((l) => {
      console.log(`   - [${l.account.code}] ${l.account.name}: Debit $${l.debit} | Credit $${l.credit}`);
    });
    if (!apJournal.totalDebit.equals(apJournal.totalCredit)) {
      throw new Error('AP journal entry is not balanced (Debit != Credit)');
    }
  }

  console.log('\n🎉 ALL PART 13 PROCUREMENT & SUPPLIER MANAGEMENT TESTS PASSED!');
}

runPart13Tests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
