import { prisma } from './src/config/database';
import { AccountingService } from './src/services/accounting.service';
import { Prisma } from '@prisma/client';

async function runPart18Tests() {
  console.log('🧪 Starting PART 18 — Advanced Accounting & Financial Statements Test Suite...');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No active company found');

  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) throw new Error('No branch found');

  const user = await prisma.user.findFirst({ where: { companyId: company.id } });
  if (!user) throw new Error('No user found');

  // ==========================================
  // TEST 1: Source Referencing & Multi-Source Journal Verification
  // ==========================================
  console.log('\n--- TEST 1: Multi-Source Journal Entries with Transaction Referencing ---');
  
  const postedJournals = await prisma.journalEntry.findMany({
    where: { companyId: company.id, status: 'POSTED' },
    include: { lines: { include: { account: true } } },
    take: 10,
    orderBy: { createdAt: 'desc' }
  });

  console.log(`✅ Found ${postedJournals.length} sample posted journal entries across system modules:`);
  postedJournals.forEach((j) => {
    console.log(`   - [#${j.entryNumber}] Ref: ${j.referenceType}:${j.referenceId || 'N/A'} | Debit: $${j.totalDebit} | Credit: $${j.totalCredit} | ${j.narration}`);
    if (!j.totalDebit.equals(j.totalCredit)) {
      throw new Error(`Unbalanced journal entry detected: #${j.entryNumber} (Debit: ${j.totalDebit}, Credit: ${j.totalCredit})`);
    }
  });

  // ==========================================
  // TEST 2: Trial Balance Generation & Balance Equation Check
  // ==========================================
  console.log('\n--- TEST 2: Trial Balance Equivalence Verification ---');
  
  const trialBalance = await AccountingService.getTrialBalance(company.id, {
    branchId: branch.id
  });

  console.log(`✅ Trial Balance Generated (As of ${trialBalance.asOfDate.toISOString().split('T')[0]}):`);
  console.log(`   Total Debits:  $${trialBalance.totalDebit}`);
  console.log(`   Total Credits: $${trialBalance.totalCredit}`);
  console.log(`   Variance:      $${trialBalance.variance}`);
  console.log(`   Is Balanced:   ${trialBalance.isBalanced}`);

  if (!trialBalance.isBalanced) {
    throw new Error(`Trial Balance is OUT OF BALANCE! Debits: ${trialBalance.totalDebit}, Credits: ${trialBalance.totalCredit}, Diff: ${trialBalance.variance}`);
  }

  // ==========================================
  // TEST 3: Profit & Loss Statement (P&L)
  // ==========================================
  console.log('\n--- TEST 3: Profit & Loss Statement (P&L) ---');
  
  const pnl = await AccountingService.getProfitAndLoss(company.id, {
    branchId: branch.id
  });

  console.log(`✅ P&L Statement Computed:`);
  console.log(`   Total Revenue:      $${pnl.revenue.total}`);
  console.log(`   Cost of Goods Sold: $${pnl.cogs.total}`);
  console.log(`   Gross Profit:       $${pnl.grossProfit}`);
  console.log(`   Operating Expenses: $${pnl.operatingExpenses.total}`);
  console.log(`   Net Income:         $${pnl.netIncome}`);

  if (pnl.grossProfit !== pnl.revenue.total - pnl.cogs.total) {
    throw new Error('Gross profit calculation error in P&L');
  }

  // ==========================================
  // TEST 4: Balance Sheet (Assets = Liabilities + Equity)
  // ==========================================
  console.log('\n--- TEST 4: Balance Sheet Accounting Equation ---');
  
  const balanceSheet = await AccountingService.getBalanceSheet(company.id, {
    branchId: branch.id
  });

  console.log(`✅ Balance Sheet Computed:`);
  console.log(`   Total Assets:        $${balanceSheet.assets.totalAssets}`);
  console.log(`   Total Liabilities:   $${balanceSheet.liabilities.totalLiabilities}`);
  console.log(`   Total Equity:        $${balanceSheet.equity.totalEquity}`);
  console.log(`   Liabilities+Equity:  $${balanceSheet.totalLiabilitiesAndEquity}`);
  console.log(`   Is Balanced:         ${balanceSheet.isBalanced}`);

  if (!balanceSheet.isBalanced) {
    throw new Error(`Balance Sheet equation violated! Assets: ${balanceSheet.assets.totalAssets}, Liab+Eq: ${balanceSheet.totalLiabilitiesAndEquity}`);
  }

  // ==========================================
  // TEST 5: Tax / GST Breakdown Report
  // ==========================================
  console.log('\n--- TEST 5: Tax / GST Breakdown Report ---');
  
  const taxReport = await AccountingService.getTaxBreakupReport(company.id, {
    branchId: branch.id
  });

  console.log(`✅ Tax / GST Report Generated:`);
  console.log(`   Output Tax Collected: $${taxReport.outputTaxCollected}`);
  console.log(`   Input Tax Credits:    $${taxReport.inputTaxCredit}`);
  console.log(`   Net GST Payable:      $${taxReport.netTaxPayable}`);

  // ==========================================
  // TEST 6: Cash & Bank Reconciliation
  // ==========================================
  console.log('\n--- TEST 6: Cash & Bank Reconciliation ---');
  
  const bankReconciliation = await AccountingService.getBankCashReconciliation(company.id, {
    branchId: branch.id
  });

  console.log(`✅ Cash & Bank Liquidity Summary:`);
  console.log(`   Cash Drawer Funds:  $${bankReconciliation.cashDrawerBalance}`);
  console.log(`   Bank Ledger Funds:  $${bankReconciliation.bankAccountBalance}`);
  console.log(`   Total Liquid Funds: $${bankReconciliation.totalLiquidFunds}`);
  console.log(`   Period Cash Flow:   $${bankReconciliation.netChange}`);

  console.log('\n🎉 ALL PART 18 ADVANCED ACCOUNTING TESTS PASSED!');
}

runPart18Tests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
