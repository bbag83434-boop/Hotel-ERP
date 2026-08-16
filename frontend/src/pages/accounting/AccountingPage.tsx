import React, { useState, useEffect } from 'react';
import {
  IndianRupee,
  BookOpen,
  Receipt,
  CreditCard,
  FileText,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Scale,
  X
} from 'lucide-react';
import { accountingApi } from '../../api/accounting.api';
import {
  ChartOfAccount,
  JournalEntry,
  AccountsPayable,
  AccountsReceivable,
  ProfitAndLossReport,
  CashFlowReport
} from '../../types/accounting.types';
import { formatINR, formatDateIN, getIndianFinancialYear } from '../../utils/formatters';

export const AccountingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pnl' | 'cashflow' | 'gl' | 'accounts' | 'apar' | 'trial'>('pnl');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Data States
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [payables, setPayables] = useState<AccountsPayable[]>([]);
  const [receivables, setReceivables] = useState<AccountsReceivable[]>([]);
  const [pnlReport, setPnlReport] = useState<ProfitAndLossReport | null>(null);
  const [cashFlowReport, setCashFlowReport] = useState<CashFlowReport | null>(null);

  // Modals
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Forms
  const [newAccountForm, setNewAccountForm] = useState<{
    code: string;
    name: string;
    type: any;
    subType: any;
    balance: number;
  }>({
    code: '',
    name: '',
    type: 'EXPENSE',
    subType: 'OPERATING_EXPENSE',
    balance: 0
  });

  const [newJournalForm, setNewJournalForm] = useState({
    narration: '',
    referenceType: 'GENERAL_JOURNAL',
    lines: [
      { accountId: '', debit: 0, credit: 0, narration: '' },
      { accountId: '', debit: 0, credit: 0, narration: '' }
    ]
  });

  const [newExpenseForm, setNewExpenseForm] = useState({
    expenseAccountId: '',
    paidFromAccountId: '',
    paidTo: '',
    amount: 1500,
    paymentMethod: 'MOBILE_BANKING',
    referenceNumber: '',
    description: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const [accs, jes, aps, ars, pnl, cf] = await Promise.all([
        accountingApi.getAccounts().catch(() => []),
        accountingApi.getGeneralLedger().catch(() => []),
        accountingApi.getAccountsPayable().catch(() => []),
        accountingApi.getAccountsReceivable().catch(() => []),
        accountingApi.getProfitAndLoss().catch(() => null),
        accountingApi.getCashFlow().catch(() => null)
      ]);
      setAccounts(accs);
      setJournalEntries(jes);
      setPayables(aps);
      setReceivables(ars);
      setPnlReport(pnl);
      setCashFlowReport(cf);

      // Pre-fill modal defaults if accounts exist
      if (accs.length > 0) {
        const expAcc = accs.find((a: any) => a.type === 'EXPENSE') || accs[0];
        const assetAcc = accs.find((a: any) => a.type === 'ASSET') || accs[0];
        setNewExpenseForm((prev) => ({
          ...prev,
          expenseAccountId: expAcc.id,
          paidFromAccountId: assetAcc.id
        }));
        setNewJournalForm((prev) => ({
          ...prev,
          lines: [
            { accountId: expAcc.id, debit: 1000, credit: 0, narration: '' },
            { accountId: assetAcc.id, debit: 0, credit: 1000, narration: '' }
          ]
        }));
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to load accounting records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Handlers
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await accountingApi.createAccount(newAccountForm);
      setShowAccountModal(false);
      showToast(`Account [${newAccountForm.code}] ${newAccountForm.name} created!`);
      setNewAccountForm({ code: '', name: '', type: 'EXPENSE', subType: 'OPERATING_EXPENSE', balance: 0 });
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create chart of account');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalDebitSum = newJournalForm.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalCreditSum = newJournalForm.lines.reduce((s, l) => s + Number(l.credit || 0), 0);

    if (Math.abs(totalDebitSum - totalCreditSum) > 0.001) {
      setErrorMsg(`Unbalanced journal! Total Debit (${formatINR(totalDebitSum)}) must equal Total Credit (${formatINR(totalCreditSum)})`);
      return;
    }

    try {
      setLoading(true);
      const res = await accountingApi.createJournalEntry({
        narration: newJournalForm.narration,
        referenceType: newJournalForm.referenceType,
        lines: newJournalForm.lines.map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
          narration: l.narration || undefined
        }))
      });
      setShowJournalModal(false);
      showToast(`Journal Entry #${res.entryNumber} posted successfully!`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to post journal entry');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await accountingApi.createExpense({
        ...newExpenseForm,
        amount: Number(newExpenseForm.amount)
      });
      setShowExpenseModal(false);
      showToast('Expense voucher recorded & journal posted successfully!');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to record expense');
    } finally {
      setLoading(false);
    }
  };

  // Journal line helpers
  const updateJournalLine = (index: number, field: string, val: any) => {
    setNewJournalForm((prev) => {
      const updated = [...prev.lines];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, lines: updated };
    });
  };

  const addJournalLine = () => {
    setNewJournalForm((prev) => ({
      ...prev,
      lines: [...prev.lines, { accountId: accounts[0]?.id || '', debit: 0, credit: 0, narration: '' }]
    }));
  };

  const totalDebitSum = newJournalForm.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCreditSum = newJournalForm.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const isJournalBalanced = Math.abs(totalDebitSum - totalCreditSum) < 0.001 && totalDebitSum > 0;

  // Trial balance calculations
  const totalGlDebits = accounts.reduce((acc, a) => {
    const bal = Number(a.balance);
    return ['ASSET', 'EXPENSE'].includes(a.type) && bal > 0 ? acc + bal : acc;
  }, 0);
  const totalGlCredits = accounts.reduce((acc, a) => {
    const bal = Number(a.balance);
    return ['LIABILITY', 'EQUITY', 'REVENUE'].includes(a.type) && bal > 0 ? acc + bal : acc;
  }, 0);

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-neutral-100 pb-20 md:pb-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#d4a437]/10 border border-[#d4a437]/20 rounded-2xl text-[#d4a437] font-bold">
              <IndianRupee className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Advanced Accounting & Financial Statements
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#d4a437]/20 text-[#d4a437] font-bold border border-[#d4a437]/30">
                  {getIndianFinancialYear()}
                </span>
              </h1>
              <p className="text-xs text-neutral-400">Double-Entry General Ledger, Real-Time P&L, Cash Flow, AP/AR & Trial Balance</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowExpenseModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-[#e5544d] border border-[#e5544d]/30 font-semibold text-xs rounded-xl transition"
            >
              <Receipt className="w-4 h-4 text-[#e5544d]" />
              Record Expense
            </button>
            <button
              onClick={() => setShowJournalModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2a] text-black font-bold text-xs rounded-xl shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              New Journal Entry
            </button>
          </div>
        </div>

        {/* Financial KPI Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4 pt-4 border-t border-white/[0.08]">
          <div className="bg-[#0c0c0e] p-3 rounded-2xl border border-white/[0.06]">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold">Operating Revenue</span>
            <div className="text-base font-bold font-mono text-[#3fbf6f] mt-0.5">
              {formatINR(pnlReport ? pnlReport.revenue.total : 0)}
            </div>
          </div>
          <div className="bg-[#0c0c0e] p-3 rounded-2xl border border-white/[0.06]">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold">COGS (Kitchen BOM)</span>
            <div className="text-base font-bold font-mono text-[#e5a33d] mt-0.5">
              {formatINR(pnlReport ? pnlReport.cogs.total : 0)}
            </div>
          </div>
          <div className="bg-[#0c0c0e] p-3 rounded-2xl border border-white/[0.06]">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold">Gross Profit</span>
            <div className="text-base font-bold font-mono text-[#4d9de5] mt-0.5">
              {formatINR(pnlReport ? pnlReport.grossProfit : 0)}
            </div>
          </div>
          <div className="bg-[#0c0c0e] p-3 rounded-2xl border border-white/[0.06]">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold">Net Income (P&L)</span>
            <div className={`text-base font-bold font-mono mt-0.5 ${pnlReport && pnlReport.netIncome >= 0 ? 'text-[#3fbf6f]' : 'text-[#e5544d]'}`}>
              {formatINR(pnlReport ? pnlReport.netIncome : 0)}
            </div>
          </div>
          <div className="bg-[#0c0c0e] p-3 rounded-2xl border border-white/[0.06]">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold">Net Cash Flow</span>
            <div className="text-base font-bold font-mono text-[#d4a437] mt-0.5">
              {formatINR(cashFlowReport ? cashFlowReport.netCashFlow : 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab Bar */}
      <div className="max-w-7xl mx-auto px-1">
        <div className="flex border-b border-white/[0.08] overflow-x-auto scrollbar-none gap-2 pb-1">
          {[
            { key: 'pnl', label: 'Profit & Loss Statement', icon: TrendingUp },
            { key: 'cashflow', label: 'Cash Flow Statement', icon: IndianRupee },
            { key: 'gl', label: 'General Ledger & Journals', icon: BookOpen },
            { key: 'accounts', label: 'Chart of Accounts', icon: FileText },
            { key: 'apar', label: 'Payables & Receivables', icon: CreditCard },
            { key: 'trial', label: 'Trial Balance Verification', icon: Scale }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs whitespace-nowrap transition ${
                  isActive
                    ? 'bg-[#d4a437] text-black font-bold shadow-lg'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="mt-4 p-4 bg-[#e5544d]/10 border border-[#e5544d]/20 text-[#e5544d] rounded-2xl text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-neutral-400 hover:text-white ml-3"><X className="w-4 h-4" /></button>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-4 bg-[#3fbf6f]/10 border border-[#3fbf6f]/20 text-[#3fbf6f] rounded-2xl text-xs flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-neutral-400 hover:text-white ml-3"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* TAB 1: PROFIT & LOSS STATEMENT */}
        {activeTab === 'pnl' && pnlReport && (
          <div className="mt-4 space-y-4 max-w-5xl mx-auto">
            <div className="bg-[#17171b] p-6 rounded-3xl border border-white/[0.08] shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Statement of Profit and Loss</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Real-time automated accrual P&L calculated directly from balanced double-entry general ledger journals
                  </p>
                </div>
                <div className="text-xs px-3 py-1.5 bg-[#0c0c0e] text-[#d4a437] rounded-xl border border-white/[0.08] font-mono font-semibold">
                  {getIndianFinancialYear()}
                </div>
              </div>

              {/* 1. Operating Revenue */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-[#3fbf6f] pb-1 border-b border-white/[0.06] tracking-wider uppercase">
                  <span>1. Operating Revenue & Outlet Sales</span>
                  <span className="font-mono">{formatINR(pnlReport.revenue.total)}</span>
                </div>
                <div className="space-y-1 pl-4 text-xs text-neutral-300">
                  {pnlReport.revenue.items.length === 0 && <p className="text-neutral-500 italic">No revenue recorded yet</p>}
                  {pnlReport.revenue.items.map((it) => (
                    <div key={it.code} className="flex justify-between py-1 border-b border-white/[0.02]">
                      <span>[{it.code}] {it.name}</span>
                      <span className="font-mono font-semibold text-white">{formatINR(it.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Cost of Goods Sold */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-[#e5a33d] pb-1 border-b border-white/[0.06] tracking-wider uppercase">
                  <span>2. Cost of Goods Sold (BOM & Ingredients)</span>
                  <span className="font-mono">({formatINR(pnlReport.cogs.total)})</span>
                </div>
                <div className="space-y-1 pl-4 text-xs text-neutral-300">
                  {pnlReport.cogs.items.length === 0 && <p className="text-neutral-500 italic">No COGS recorded yet</p>}
                  {pnlReport.cogs.items.map((it) => (
                    <div key={it.code} className="flex justify-between py-1 border-b border-white/[0.02]">
                      <span>[{it.code}] {it.name}</span>
                      <span className="font-mono font-semibold text-white">{formatINR(it.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gross Profit Subtotal */}
              <div className="flex justify-between items-center text-sm font-extrabold text-white p-3.5 bg-[#0c0c0e] rounded-2xl border border-white/[0.06]">
                <span>GROSS PROFIT</span>
                <span className="text-[#4d9de5] font-mono">{formatINR(pnlReport.grossProfit)}</span>
              </div>

              {/* 3. Operating Expenses */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-[#e5544d] pb-1 border-b border-white/[0.06] tracking-wider uppercase">
                  <span>3. Operating Expenses & Utilities</span>
                  <span className="font-mono">({formatINR(pnlReport.operatingExpenses.total)})</span>
                </div>
                <div className="space-y-1 pl-4 text-xs text-neutral-300">
                  {pnlReport.operatingExpenses.items.length === 0 && <p className="text-neutral-500 italic">No operating expenses recorded yet</p>}
                  {pnlReport.operatingExpenses.items.map((it) => (
                    <div key={it.code} className="flex justify-between py-1 border-b border-white/[0.02]">
                      <span>[{it.code}] {it.name}</span>
                      <span className="font-mono font-semibold text-white">{formatINR(it.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Net Income Final */}
              <div className="flex justify-between items-center text-base font-black text-white p-4 bg-[#0c0c0e] rounded-2xl border border-[#d4a437]/40 shadow-2xl">
                <span>NET INCOME / (NET PROFIT)</span>
                <span className={`font-mono text-lg ${pnlReport.netIncome >= 0 ? 'text-[#3fbf6f]' : 'text-[#e5544d]'}`}>
                  {formatINR(pnlReport.netIncome)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CASH FLOW STATEMENT */}
        {activeTab === 'cashflow' && cashFlowReport && (
          <div className="mt-4 space-y-4 max-w-5xl mx-auto">
            <div className="bg-[#17171b] p-6 rounded-3xl border border-white/[0.08] shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Dynamic Statement of Cash Flows</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">Automated cash ledger tracking for liquidity analysis</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06]">
                  <span className="text-[10px] text-neutral-400 uppercase font-semibold">Total Inflow</span>
                  <div className="text-base font-bold font-mono text-[#3fbf6f] mt-1 flex items-center gap-1">
                    <ArrowUpRight className="w-4 h-4" />
                    {formatINR(cashFlowReport.totalInflow)}
                  </div>
                </div>
                <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06]">
                  <span className="text-[10px] text-neutral-400 uppercase font-semibold">Total Outflow</span>
                  <div className="text-base font-bold font-mono text-[#e5544d] mt-1 flex items-center gap-1">
                    <ArrowDownRight className="w-4 h-4" />
                    {formatINR(cashFlowReport.totalOutflow)}
                  </div>
                </div>
                <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06]">
                  <span className="text-[10px] text-neutral-400 uppercase font-semibold">Net Cash Position</span>
                  <div className="text-base font-bold font-mono text-[#d4a437] mt-1">
                    {formatINR(cashFlowReport.netCashFlow)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Cash Movement Ledger</h4>
                <div className="divide-y divide-white/[0.04] bg-[#0c0c0e] rounded-2xl border border-white/[0.06] overflow-hidden">
                  {cashFlowReport.transactions.length === 0 ? (
                    <div className="p-6 text-center text-neutral-500 text-xs">No cash transactions in this period.</div>
                  ) : (
                    cashFlowReport.transactions.map((tx, idx) => (
                      <div key={idx} className="p-3.5 flex items-center justify-between text-xs hover:bg-white/[0.02] transition">
                        <div>
                          <div className="font-semibold text-white">{tx.narration}</div>
                          <div className="text-neutral-500 text-[11px] mt-0.5">
                            {formatDateIN(tx.date)} • {tx.entryNumber} • {tx.accountName}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          {tx.inflow > 0 && <span className="font-bold text-[#3fbf6f]">+{formatINR(tx.inflow)}</span>}
                          {tx.outflow > 0 && <span className="font-bold text-[#e5544d]">-{formatINR(tx.outflow)}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GENERAL LEDGER & JOURNALS */}
        {activeTab === 'gl' && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#17171b] p-4 rounded-3xl border border-white/[0.08]">
              <div className="text-xs text-neutral-300 font-semibold">
                General Ledger Journals ({journalEntries.length} entries)
              </div>
              <button
                onClick={() => setShowJournalModal(true)}
                className="px-3.5 py-1.5 bg-[#d4a437] hover:bg-[#b88c2a] text-black font-bold text-xs rounded-xl transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Post Journal Entry
              </button>
            </div>

            <div className="space-y-3">
              {journalEntries.length === 0 ? (
                <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-12 text-center text-neutral-500 text-xs">
                  No journal entries posted yet.
                </div>
              ) : (
                journalEntries.map((je) => (
                  <div key={je.id} className="bg-[#17171b] p-4 rounded-3xl border border-white/[0.08] shadow-2xl space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#d4a437] font-mono text-sm">{je.entryNumber}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] text-neutral-300 font-semibold border border-white/[0.08]">
                          {je.referenceType}
                        </span>
                        <span className="text-xs text-neutral-400 font-mono">{formatDateIN(je.date)}</span>
                      </div>
                      <div className="text-xs font-bold font-mono text-[#3fbf6f]">
                        Total: {formatINR(Number(je.totalDebit))}
                      </div>
                    </div>

                    <p className="text-xs text-neutral-300">{je.narration}</p>

                    <div className="bg-[#0c0c0e] rounded-2xl p-2.5 divide-y divide-white/[0.04] text-xs">
                      {je.lines.map((l) => (
                        <div key={l.id} className="py-1.5 flex items-center justify-between text-neutral-300">
                          <div className="flex items-center gap-2">
                            <span className="text-[#d4a437] font-mono">[{l.account?.code}]</span>
                            <span className="font-medium text-white">{l.account?.name}</span>
                            {l.narration && <span className="text-neutral-500 text-[11px]">({l.narration})</span>}
                          </div>
                          <div className="flex items-center gap-4 font-mono">
                            <span className="text-[#3fbf6f]">
                              {Number(l.debit) > 0 ? `Dr: ${formatINR(Number(l.debit))}` : ''}
                            </span>
                            <span className="text-[#e5544d]">
                              {Number(l.credit) > 0 ? `Cr: ${formatINR(Number(l.credit))}` : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: CHART OF ACCOUNTS */}
        {activeTab === 'accounts' && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#17171b] p-4 rounded-3xl border border-white/[0.08]">
              <div className="text-xs text-neutral-300 font-semibold">
                Chart of Accounts Master ({accounts.length} accounts)
              </div>
              <button
                onClick={() => setShowAccountModal(true)}
                className="px-3.5 py-1.5 bg-[#d4a437] hover:bg-[#b88c2a] text-black font-bold text-xs rounded-xl transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Account
              </button>
            </div>

            <div className="bg-[#17171b] rounded-3xl border border-white/[0.08] overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-neutral-300">
                  <thead className="bg-white/[0.03] text-[10px] uppercase text-neutral-400 border-b border-white/[0.08]">
                    <tr>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Account Name</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Sub-Type</th>
                      <th className="px-4 py-3 text-right">Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {accounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-white/[0.02] transition">
                        <td className="px-4 py-3 font-mono font-bold text-[#d4a437]">{acc.code}</td>
                        <td className="px-4 py-3 font-medium text-white">{acc.name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            acc.type === 'ASSET' ? 'bg-[#4d9de5]/20 text-[#4d9de5] border border-[#4d9de5]/30' :
                            acc.type === 'LIABILITY' ? 'bg-[#e5a33d]/20 text-[#e5a33d] border border-[#e5a33d]/30' :
                            acc.type === 'REVENUE' ? 'bg-[#3fbf6f]/20 text-[#3fbf6f] border border-[#3fbf6f]/30' :
                            acc.type === 'EXPENSE' ? 'bg-[#e5544d]/20 text-[#e5544d] border border-[#e5544d]/30' : 'bg-white/[0.06] text-neutral-300'
                          }`}>
                            {acc.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-400">{acc.subType}</td>
                        <td className="px-4 py-3 text-right font-bold font-mono text-white">
                          {formatINR(Number(acc.balance))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: AP / AR */}
        {activeTab === 'apar' && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Accounts Payable */}
            <div className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-[#e5a33d]" /> Accounts Payable (Vendors / Suppliers)
                  </h3>
                  <p className="text-xs text-neutral-400">Purchasing tax invoices and vendor payables</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {payables.length === 0 && <p className="text-xs text-neutral-500 italic p-3">No supplier payables currently due</p>}
                {payables.map((ap) => (
                  <div key={ap.id} className="p-3.5 bg-[#0c0c0e] rounded-2xl border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{ap.supplier?.name}</div>
                      <div className="text-xs text-neutral-400 mt-0.5">Inv: {ap.invoiceNumber} • {formatDateIN(ap.invoiceDate)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono text-[#e5a33d] text-sm">{formatINR(Number(ap.balance))}</div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#e5a33d]/20 text-[#e5a33d] font-semibold border border-[#e5a33d]/30">
                        {ap.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Accounts Receivable */}
            <div className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-[#4d9de5]" /> Accounts Receivable (Guests & City Ledger)
                  </h3>
                  <p className="text-xs text-neutral-400">Guest folios, banquet and corporate billing receivables</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {receivables.length === 0 && <p className="text-xs text-neutral-500 italic p-3">No customer receivables pending</p>}
                {receivables.map((ar) => (
                  <div key={ar.id} className="p-3.5 bg-[#0c0c0e] rounded-2xl border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{ar.guest?.firstName} {ar.guest?.lastName}</div>
                      <div className="text-xs text-neutral-400 mt-0.5">Booking: {ar.booking?.bookingNumber} • {ar.invoiceNumber}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono text-[#4d9de5] text-sm">{formatINR(Number(ar.balance))}</div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#4d9de5]/20 text-[#4d9de5] font-semibold border border-[#4d9de5]/30">
                        {ar.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: TRIAL BALANCE */}
        {activeTab === 'trial' && (
          <div className="mt-4 space-y-4 max-w-5xl mx-auto">
            <div className="bg-[#17171b] p-6 rounded-3xl border border-white/[0.08] shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Scale className="w-5 h-5 text-[#d4a437]" /> Trial Balance Verification
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">Verification that sum of all debit balances equals sum of all credit balances</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                    Math.abs(totalGlDebits - totalGlCredits) < 0.01
                      ? 'bg-[#3fbf6f]/20 text-[#3fbf6f] border border-[#3fbf6f]/30'
                      : 'bg-[#e5544d]/20 text-[#e5544d] border border-[#e5544d]/30'
                  }`}>
                    {Math.abs(totalGlDebits - totalGlCredits) < 0.01 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {Math.abs(totalGlDebits - totalGlCredits) < 0.01 ? 'TRIAL BALANCE IN BALANCE' : 'TRIAL BALANCE OUT OF BALANCE'}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-neutral-300">
                  <thead className="bg-white/[0.03] text-[10px] uppercase text-neutral-400 border-b border-white/[0.08]">
                    <tr>
                      <th className="px-4 py-3">Account Code</th>
                      <th className="px-4 py-3">Account Title</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Debit Balance (₹)</th>
                      <th className="px-4 py-3 text-right">Credit Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] font-mono">
                    {accounts.map((acc) => {
                      const bal = Number(acc.balance);
                      const isDr = ['ASSET', 'EXPENSE'].includes(acc.type);
                      const isCr = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(acc.type);
                      return (
                        <tr key={acc.id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-3 text-[#d4a437] font-bold">{acc.code}</td>
                          <td className="px-4 py-3 font-sans font-medium text-white">{acc.name}</td>
                          <td className="px-4 py-3 font-sans text-neutral-400">{acc.type}</td>
                          <td className="px-4 py-3 text-right text-[#3fbf6f]">
                            {isDr && bal > 0 ? formatINR(bal) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-[#e5544d]">
                            {isCr && bal > 0 ? formatINR(bal) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-[#0c0c0e] font-mono font-bold text-xs border-t-2 border-white/[0.1]">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 font-sans text-white uppercase">Grand Total (Debits & Credits)</td>
                      <td className="px-4 py-3 text-right text-[#3fbf6f]">{formatINR(totalGlDebits)}</td>
                      <td className="px-4 py-3 text-right text-[#e5544d]">{formatINR(totalGlCredits)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {/* 1. New Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="text-base font-bold text-white">Create New Account (GL Master)</h3>
              <button onClick={() => setShowAccountModal(false)}><X className="w-5 h-5 text-neutral-400 hover:text-white" /></button>
            </div>
            <form onSubmit={handleCreateAccount} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 font-semibold block mb-1">Account Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. 6040"
                    value={newAccountForm.code}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, code: e.target.value })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] font-mono focus:border-[#d4a437] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 font-semibold block mb-1">Account Type *</label>
                  <select
                    value={newAccountForm.type}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, type: e.target.value })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none"
                  >
                    <option value="ASSET">Asset</option>
                    <option value="LIABILITY">Liability</option>
                    <option value="EQUITY">Equity</option>
                    <option value="REVENUE">Revenue</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Account Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Input GST Credit Account"
                  value={newAccountForm.name}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, name: e.target.value })}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Sub-Category *</label>
                <select
                  value={newAccountForm.subType}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, subType: e.target.value })}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none"
                >
                  <option value="CURRENT_ASSET">Current Asset</option>
                  <option value="FIXED_ASSET">Fixed Asset</option>
                  <option value="CURRENT_LIABILITY">Current Liability</option>
                  <option value="LONG_TERM_LIABILITY">Long Term Liability</option>
                  <option value="OPERATING_REVENUE">Operating Revenue</option>
                  <option value="COST_OF_GOODS_SOLD">Cost of Goods Sold</option>
                  <option value="OPERATING_EXPENSE">Operating Expense</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 bg-white/[0.04] text-neutral-300 text-xs rounded-xl font-semibold hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2a] text-black text-xs rounded-xl font-bold"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. New Double-Entry Journal Modal */}
      {showJournalModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="text-base font-bold text-white">Post Double-Entry Journal</h3>
              <div className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${
                isJournalBalanced ? 'bg-[#3fbf6f]/20 text-[#3fbf6f] border border-[#3fbf6f]/30' : 'bg-[#e5544d]/20 text-[#e5544d] border border-[#e5544d]/30'
              }`}>
                {isJournalBalanced ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {isJournalBalanced ? 'BALANCED' : 'UNBALANCED'}
              </div>
            </div>

            <form onSubmit={handleCreateJournal} className="space-y-3">
              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Narration / Description *</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly GST liability settlement"
                  value={newJournalForm.narration}
                  onChange={(e) => setNewJournalForm({ ...newJournalForm, narration: e.target.value })}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-neutral-400 font-semibold block">Journal Lines (Debit / Credit ₹)</label>
                {newJournalForm.lines.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 bg-[#0c0c0e] p-2.5 rounded-xl border border-white/[0.06] items-center">
                    <div className="col-span-6">
                      <select
                        value={l.accountId}
                        onChange={(e) => updateJournalLine(idx, 'accountId', e.target.value)}
                        className="w-full bg-[#17171b] text-white text-xs p-2 rounded-lg border border-white/[0.1] focus:border-[#d4a437] outline-none"
                        required
                      >
                        <option value="">Select Account</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>[{a.code}] {a.name} ({a.type})</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        placeholder="Debit (₹)"
                        value={l.debit || ''}
                        onChange={(e) => updateJournalLine(idx, 'debit', Number(e.target.value))}
                        className="w-full bg-[#17171b] text-white text-xs p-2 rounded-lg border border-white/[0.1] font-mono text-[#3fbf6f]"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        placeholder="Credit (₹)"
                        value={l.credit || ''}
                        onChange={(e) => updateJournalLine(idx, 'credit', Number(e.target.value))}
                        className="w-full bg-[#17171b] text-white text-xs p-2 rounded-lg border border-white/[0.1] font-mono text-[#e5544d]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={addJournalLine}
                  className="text-xs text-[#d4a437] hover:underline font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Line
                </button>
                <div className="text-xs space-x-3 font-mono">
                  <span className="text-neutral-400">Total Dr: <strong className="text-[#3fbf6f]">{formatINR(totalDebitSum)}</strong></span>
                  <span className="text-neutral-400">Total Cr: <strong className="text-[#e5544d]">{formatINR(totalCreditSum)}</strong></span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowJournalModal(false)}
                  className="px-4 py-2 bg-white/[0.04] text-neutral-300 text-xs rounded-xl font-semibold hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !isJournalBalanced}
                  className={`px-4 py-2 text-xs rounded-xl font-bold transition ${
                    isJournalBalanced ? 'bg-[#d4a437] hover:bg-[#b88c2a] text-black' : 'bg-white/[0.06] text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  Post to General Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Record Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="text-base font-bold text-white">Record Operating Expense</h3>
              <button onClick={() => setShowExpenseModal(false)}><X className="w-5 h-5 text-neutral-400 hover:text-white" /></button>
            </div>
            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Paid To (Vendor/Entity) *</label>
                <input
                  type="text"
                  placeholder="e.g. State Electricity Board / Amul Dairy"
                  value={newExpenseForm.paidTo}
                  onChange={(e) => setNewExpenseForm({ ...newExpenseForm, paidTo: e.target.value })}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 font-semibold block mb-1">Expense Account *</label>
                  <select
                    value={newExpenseForm.expenseAccountId}
                    onChange={(e) => setNewExpenseForm({ ...newExpenseForm, expenseAccountId: e.target.value })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none"
                    required
                  >
                    {accounts.filter(a => a.type === 'EXPENSE').map((a) => (
                      <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-400 font-semibold block mb-1">Paid From *</label>
                  <select
                    value={newExpenseForm.paidFromAccountId}
                    onChange={(e) => setNewExpenseForm({ ...newExpenseForm, paidFromAccountId: e.target.value })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none"
                    required
                  >
                    {accounts.filter(a => a.type === 'ASSET').map((a) => (
                      <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-400 font-semibold block mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    value={newExpenseForm.amount}
                    onChange={(e) => setNewExpenseForm({ ...newExpenseForm, amount: Number(e.target.value) })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] font-mono focus:border-[#d4a437] outline-none text-[#e5544d]"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 font-semibold block mb-1">Payment Method</label>
                  <select
                    value={newExpenseForm.paymentMethod}
                    onChange={(e) => setNewExpenseForm({ ...newExpenseForm, paymentMethod: e.target.value })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none"
                  >
                    <option value="MOBILE_BANKING">UPI / QR Payment</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="DEBIT_CARD">Debit Card</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 bg-white/[0.04] text-neutral-300 text-xs rounded-xl font-semibold hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#e5544d] hover:bg-[#c9453f] text-white text-xs rounded-xl font-bold"
                >
                  Record Expense Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountingPage;
