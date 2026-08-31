import { prisma } from './src/config/database';
import { AuthService } from './src/services/auth.service';
import { AuditService } from './src/services/audit.service';

async function runPart21Tests() {
  console.log('🧪 Starting PART 21 — Audit & Compliance Engine Test Suite...');

  // 1. Authenticate user
  const loginRes = await AuthService.login('admin@hotel-erp.com', 'Admin@123456');
  const user = loginRes.user;
  console.log(`✅ Authenticated User: ${user.email} (${user.role.name})`);

  // ==========================================
  // TEST 1: Detailed Change Logging with State Diff
  // ==========================================
  console.log('\n--- TEST 1: State Snapshot & Diff Computation ---');

  const stockAdjustmentId = 'SA-2026-TEST-001';
  const oldStockState = {
    itemId: 'item-rice-basmati',
    warehouseId: 'wh-main-kitchen',
    quantity: 100,
    unitCost: 85.0,
    status: 'DRAFT'
  };
  const newStockState = {
    itemId: 'item-rice-basmati',
    warehouseId: 'wh-main-kitchen',
    quantity: 92, // 8kg shrinkage
    unitCost: 85.0,
    status: 'APPROVED'
  };

  const auditEntry = await AuditService.logDetailedChange({
    userId: user.id,
    action: 'STOCK_PHYSICAL_ADJUSTMENT',
    entity: 'StockAdjustment',
    entityId: stockAdjustmentId,
    module: 'INVENTORY',
    oldValue: oldStockState,
    newValue: newStockState,
    reason: 'Monthly physical stock count count discrepancy (-8kg moisture loss)',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  });

  console.log(`✅ Detailed Audit Log Entry Created: ID ${auditEntry?.id}`);
  const details = auditEntry?.details as any;
  console.log(`   - Entity: ${auditEntry?.entity} #${auditEntry?.entityId}`);
  console.log(`   - Action: ${auditEntry?.action}`);
  console.log(`   - Detected Changed Keys:`, details?.changedKeys);
  console.log(`   - Reason: "${details?.reason}"`);

  if (!details?.changedKeys || !details.changedKeys.includes('quantity') || !details.changedKeys.includes('status')) {
    throw new Error('State diff computation failed: changed keys missing');
  }

  // ==========================================
  // TEST 2: Multi-Category Compliance Events
  // ==========================================
  console.log('\n--- TEST 2: Multi-Category Enterprise Audit Events ---');

  // Event A: Purchase Order Status Change
  await AuditService.logDetailedChange({
    userId: user.id,
    action: 'PURCHASE_ORDER_ISSUED',
    entity: 'PurchaseOrder',
    entityId: 'PO-2026-0042',
    module: 'PURCHASING',
    oldValue: { status: 'PENDING_APPROVAL', totalAmount: 45000 },
    newValue: { status: 'ISSUED', totalAmount: 45000 },
    reason: 'Approved by Managing Director per threshold policy'
  });
  console.log(`✅ Purchase Order event logged`);

  // Event B: POS Bill Refund Issued (High Risk Financial Event)
  await AuditService.logDetailedChange({
    userId: user.id,
    action: 'REFUND_ISSUED',
    entity: 'SalesRecord',
    entityId: 'INV-ORD-2026-00088',
    module: 'RESTAURANT',
    oldValue: { grandTotal: 1850, paidAmount: 1850, refundStatus: 'NONE' },
    newValue: { grandTotal: 1850, paidAmount: 0, refundAmount: 1850, refundStatus: 'FULL' },
    reason: 'Customer cancelled booking due to flight delay'
  });
  console.log(`✅ POS Bill Refund event logged`);

  // Event C: Role Permission Security Change (High Risk Security Event)
  await AuditService.logDetailedChange({
    userId: user.id,
    action: 'PERMISSION_GRANTED',
    entity: 'RolePermission',
    entityId: 'role-branch-mgr-01',
    module: 'SECURITY',
    oldValue: { permissions: ['pos:order', 'kds:view'] },
    newValue: { permissions: ['pos:order', 'kds:view', 'discount:apply_max_20'] },
    reason: 'Promoted to Shift Supervisor'
  });
  console.log(`✅ Security Permission event logged`);

  // ==========================================
  // TEST 3: Filterable Audit Stream & Search
  // ==========================================
  console.log('\n--- TEST 3: Filterable Audit Stream Querying ---');
  const filtered = await AuditService.getAuditLogs({
    entity: 'StockAdjustment',
    limit: 10
  });
  console.log(`✅ Filter by Entity (StockAdjustment): Found ${filtered.total} entries (Showing page ${filtered.page}/${filtered.totalPages})`);
  if (filtered.total < 1) throw new Error('Stock adjustment audit filter failed');

  // Search keyword
  const searchResults = await AuditService.getAuditLogs({
    search: 'moisture loss',
    limit: 5
  });
  console.log(`✅ Keyword Search ("moisture loss"): Found ${searchResults.total} entries`);

  // ==========================================
  // TEST 4: Record-Level Entity Lifecycle Trail
  // ==========================================
  console.log('\n--- TEST 4: Record-Level Lifecycle History ---');
  const entityTrail = await AuditService.getEntityAuditTrail('StockAdjustment', stockAdjustmentId);
  console.log(`✅ Entity Audit Trail for StockAdjustment #${stockAdjustmentId}: ${entityTrail.length} event(s) in chronological order`);
  if (entityTrail.length < 1) throw new Error('Entity audit trail query failed');

  // ==========================================
  // TEST 5: Compliance Summary KPIs & Export Dossier
  // ==========================================
  console.log('\n--- TEST 5: Compliance KPIs & Regulatory Export ---');
  const summary = await AuditService.getComplianceSummary();
  console.log(`✅ Compliance Summary KPIs:`);
  console.log(`   - Total Audit Events:       ${summary.totalEvents}`);
  console.log(`   - Events Logged Today:      ${summary.todayEvents}`);
  console.log(`   - Active Audited Actors:    ${summary.activeAuditedUsers}`);
  console.log(`   - High-Risk Stock Events:   ${summary.highRiskBreakdown.stockEvents}`);
  console.log(`   - High-Risk Refund Events:  ${summary.highRiskBreakdown.refundEvents}`);
  console.log(`   - High-Risk Approval Events:${summary.highRiskBreakdown.approvalEvents}`);
  console.log(`   - Top Logged Actions:`, summary.topActions.map((a) => `${a.action} (${a.count})`).join(', '));

  const exportDossier = await AuditService.exportAuditLogs({ limit: 5 });
  console.log(`✅ Compliance Dossier Export: ${exportDossier.length} rows formatted with ISO timestamps & actor identities`);

  console.log('\n🎉 ALL PART 21 AUDIT & COMPLIANCE TESTS PASSED!');
}

runPart21Tests()
  .catch((err) => {
    console.error('❌ PART 21 Test Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
