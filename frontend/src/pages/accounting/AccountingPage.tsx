import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  BookOpen,
  Receipt,
  CreditCard,
  FileText,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  CheckCircle2,
  AlertCircle
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
  const [activeTab, setActiveTab] = useState<'pnl' | 'gl' | 'accounts' | 'apar' | 'expenses' | 'cashflow'>('pnl');
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 md:pb-8">
      {/* Top Banner */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-xl shadow-lg shadow-emerald-900/20 text-slate-950 font-bold">
              <DollarSign className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Accounting & GST Controller
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">
                  {getIndianFinancialYear()}
                </span>
              </h1>
              <p className="text-xs text-slate-400">General Ledger, Dynamic P&L, Cash Flow, AP/AR & GST Input/Output Ledgers</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowExpenseModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 font-medium text-sm rounded-lg transition"
            >
              <Receipt className="w-4 h-4 text-rose-400" />
              Record Expense
            </button>
            <button
              onClick={() => setShowJournalModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-semibold text-sm rounded-lg shadow-md transition"
            >
              <Plus className="w-4 h-4" />
              New Journal Entry
            </button>
          </div>
        </div>

        {/* Financial KPI Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-3 pt-3 border-t border-slate-800/80">
          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Operating Revenue</span>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              {formatINR(pnlReport ? pnlReport.revenue.total : 0)}
            </div>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
            <span className="text-[11px] text-slate-400 uppercase font-medium">COGS (Kitchen BOM)</span>
            <div className="text-lg font-bold text-amber-400 mt-0.5">
              {formatINR(pnlReport ? pnlReport.cogs.total : 0)}
            </div>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Gross Profit</span>
            <div className="text-lg font-bold text-sky-400 mt-0.5">
              {formatINR(pnlReport ? pnlReport.grossProfit : 0)}
            </div>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Net Income (P&L)</span>
            <div className={`text-lg font-bold mt-0.5 ${pnlReport && pnlReport.netIncome >= 0 ? 'text-teal-300' : 'text-rose-400'}`}>
              {formatINR(pnlReport ? pnlReport.netIncome : 0)}
            </div>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Net Cash Flow</span>
            <div className="text-lg font-bold text-purple-300 mt-0.5">
              {formatINR(cashFlowReport ? cashFlowReport.netCashFlow : 0)}
            </div>
          </div>
        </div>
      </header>

      {/* Main Tab Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <div className="flex border-b border-slate-800 overflow-x-auto scrollbar-none gap-2">
          {[
            { key: 'pnl', label: 'Profit & Loss Statement', icon: TrendingUp },
            { key: 'cashflow', label: 'Cash Flow Statement', icon: DollarSign },
            { key: 'gl', label: 'General Ledger & Journals', icon: BookOpen },
            { key: 'accounts', label: 'Chart of Accounts', icon: FileText },
            { key: 'apar', label: 'Accounts Payable & Receivable', icon: CreditCard }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition ${
                  isActive
                    ? 'border-emerald-400 text-emerald-400 bg-emerald-400/5 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
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
          <div className="mt-4 p-3 bg-rose-950/80 border border-rose-800/80 text-rose-200 rounded-lg text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-rose-400 font-bold ml-3">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-800/80 text-emerald-200 rounded-lg text-sm flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-400 font-bold ml-3">✕</button>
          </div>
        )}

        {/* TAB 1: PROFIT & LOSS STATEMENT */}
        {activeTab === 'pnl' && pnlReport && (
          <div className="mt-4 space-y-4 max-w-5xl mx-auto">
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Statement of Profit and Loss</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Computed in real time from double-entry General Ledger lines across POS, Hotel and Purchases
                  </p>
                </div>
                <div className="text-xs px-3 py-1.5 bg-slate-950 text-slate-300 rounded-lg border border-slate-800 font-medium">
                  {getIndianFinancialYear()} (April - March)
                </div>
              </div>

              {/* 1. Operating Revenue */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm font-bold text-emerald-400 pb-1 border-b border-slate-800">
                  <span>1. OPERATING REVENUE</span>
                  <span>{formatINR(pnlReport.revenue.total)}</span>
                </div>
                <div className="space-y-1 pl-4 text-xs text-slate-300">
                  {pnlReport.revenue.items.length === 0 && <p className="text-slate-500 italic">No revenue recorded yet</p>}
                  {pnlReport.revenue.items.map((it) => (
                    <div key={it.code} className="flex justify-between py-0.5">
                      <span>[{it.code}] {it.name}</span>
                      <span className="font-semibold text-slate-100">{formatINR(it.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Cost of Goods Sold */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm font-bold text-amber-400 pb-1 border-b border-slate-800">
                  <span>2. COST OF GOODS SOLD (KITCHEN BOM INGREDIENTS)</span>
                  <span>({formatINR(pnlReport.cogs.total)})</span>
                </div>
                <div className="space-y-1 pl-4 text-xs text-slate-300">
                  {pnlReport.cogs.items.length === 0 && <p className="text-slate-500 italic">No COGS recorded yet</p>}
                  {pnlReport.cogs.items.map((it) => (
                    <div key={it.code} className="flex justify-between py-0.5">
                      <span>[{it.code}] {it.name}</span>
                      <span className="font-semibold text-slate-100">{formatINR(it.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gross Profit Subtotal */}
              <div className="flex justify-between items-center text-base font-extrabold text-white p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span>GROSS PROFIT</span>
                <span className="text-sky-400">{formatINR(pnlReport.grossProfit)}</span>
              </div>

              {/* 3. Operating Expenses */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm font-bold text-rose-400 pb-1 border-b border-slate-800">
                  <span>3. OPERATING EXPENSES & UTILITIES</span>
                  <span>({formatINR(pnlReport.operatingExpenses.total)})</span>
                </div>
                <div className="space-y-1 pl-4 text-xs text-slate-300">
                  {pnlReport.operatingExpenses.items.length === 0 && <p className="text-slate-500 italic">No operating expenses recorded yet</p>}
                  {pnlReport.operatingExpenses.items.map((it) => (
                    <div key={it.code} className="flex justify-between py-0.5">
                      <span>[{it.code}] {it.name}</span>
                      <span className="font-semibold text-slate-100">{formatINR(it.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Net Income Final */}
              <div className="flex justify-between items-center text-lg font-black text-white p-4 bg-gradient-to-r from-slate-950 via-emerald-950/40 to-slate-950 rounded-xl border border-emerald-700/60 shadow-lg">
                <span>NET INCOME / (NET PROFIT)</span>
                <span className={pnlReport.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {formatINR(pnlReport.netIncome)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CASH FLOW STATEMENT */}
        {activeTab === 'cashflow' && cashFlowReport && (
          <div className="mt-4 space-y-4 max-w-5xl mx-auto">
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Dynamic Statement of Cash Flows</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Derived from Cash & Operating Bank General Ledger postings</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Total Inflow</span>
                  <div className="text-lg font-bold text-emerald-400 mt-1 flex items-center gap-1">
                    <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                    {formatINR(cashFlowReport.totalInflow)}
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Total Outflow</span>
                  <div className="text-lg font-bold text-rose-400 mt-1 flex items-center gap-1">
                    <ArrowDownRight className="w-5 h-5 text-rose-400" />
                    {formatINR(cashFlowReport.totalOutflow)}
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Net Cash Flow</span>
                  <div className="text-lg font-bold text-sky-400 mt-1">
                    {formatINR(cashFlowReport.netCashFlow)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cash Movement Ledger</h4>
                <div className="divide-y divide-slate-800/80 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                  {cashFlowReport.transactions.map((tx, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-900/50 transition">
                      <div>
                        <div className="font-semibold text-slate-200">{tx.narration}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          {formatDateIN(tx.date)} • {tx.entryNumber} • {tx.accountName}
                        </div>
                      </div>
                      <div className="text-right">
                        {tx.inflow > 0 && <span className="font-bold text-emerald-400">+{formatINR(tx.inflow)}</span>}
                        {tx.outflow > 0 && <span className="font-bold text-rose-400">-{formatINR(tx.outflow)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GENERAL LEDGER & JOURNALS */}
        {activeTab === 'gl' && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-300 font-semibold">
                General Ledger Journal Entries ({journalEntries.length} entries)
              </div>
              <button
                onClick={() => setShowJournalModal(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Post Journal Entry
              </button>
            </div>

            <div className="space-y-3">
              {journalEntries.map((je) => (
                <div key={je.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{je.entryNumber}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-emerald-300 font-semibold border border-emerald-500/20">
                        {je.referenceType}
                      </span>
                      <span className="text-xs text-slate-400">{formatDateIN(je.date)}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-200">
                      Total: {formatINR(Number(je.totalDebit))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 font-medium">{je.narration}</p>

                  <div className="bg-slate-950 rounded-lg p-2 divide-y divide-slate-800/60 text-xs">
                    {je.lines.map((l) => (
                      <div key={l.id} className="py-1.5 flex items-center justify-between text-slate-300">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-mono">[{l.account?.code}]</span>
                          <span className="font-medium text-slate-200">{l.account?.name}</span>
                          {l.narration && <span className="text-slate-500 text-[11px]">({l.narration})</span>}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-slate-400">
                            {Number(l.debit) > 0 ? `Dr: ${formatINR(Number(l.debit))}` : ''}
                          </span>
                          <span className="text-slate-400">
                            {Number(l.credit) > 0 ? `Cr: ${formatINR(Number(l.credit))}` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: CHART OF ACCOUNTS */}
        {activeTab === 'accounts' && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-300 font-semibold">
                Chart of Accounts Master ({accounts.length} accounts)
              </div>
              <button
                onClick={() => setShowAccountModal(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Account
              </button>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Account Name</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Sub-Type</th>
                      <th className="px-4 py-3 text-right">Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {accounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3 font-mono font-bold text-white">{acc.code}</td>
                        <td className="px-4 py-3 font-medium text-slate-200">{acc.name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            acc.type === 'ASSET' ? 'bg-sky-500/20 text-sky-300' :
                            acc.type === 'LIABILITY' ? 'bg-amber-500/20 text-amber-300' :
                            acc.type === 'REVENUE' ? 'bg-emerald-500/20 text-emerald-300' :
                            acc.type === 'EXPENSE' ? 'bg-rose-500/20 text-rose-300' : 'bg-purple-500/20 text-purple-300'
                          }`}>
                            {acc.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{acc.subType}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-100">
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
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-amber-400" /> Accounts Payable (Vendors / Suppliers)
                  </h3>
                  <p className="text-xs text-slate-400">Purchasing tax invoices and vendor payables</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {payables.length === 0 && <p className="text-xs text-slate-500 italic p-3">No supplier payables currently due</p>}
                {payables.map((ap) => (
                  <div key={ap.id} className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{ap.supplier?.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">Inv: {ap.invoiceNumber} • {formatDateIN(ap.invoiceDate)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-amber-300 text-sm">{formatINR(Number(ap.balance))}</div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-400 font-semibold border border-amber-800">
                        {ap.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Accounts Receivable */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-sky-400" /> Accounts Receivable (Guests & City Ledger)
                  </h3>
                  <p className="text-xs text-slate-400">Guest folios, banquet and corporate billing receivables</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {receivables.length === 0 && <p className="text-xs text-slate-500 italic p-3">No customer receivables pending</p>}
                {receivables.map((ar) => (
                  <div key={ar.id} className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{ar.guest?.firstName} {ar.guest?.lastName}</div>
                      <div className="text-xs text-slate-400 mt-0.5">Booking: {ar.booking?.bookingNumber} • {ar.invoiceNumber}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sky-300 text-sm">{formatINR(Number(ar.balance))}</div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-sky-950 text-sky-400 font-semibold border border-sky-800">
                        {ar.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {/* 1. New Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Create New Account (GL Master)</h3>
            <form onSubmit={handleCreateAccount} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Account Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. 6040"
                    value={newAccountForm.code}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, code: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Account Type *</label>
                  <select
                    value={newAccountForm.type}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, type: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
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
                <label className="text-xs text-slate-400 font-semibold block mb-1">Account Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Input GST Credit Account"
                  value={newAccountForm.name}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, name: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Sub-Category *</label>
                <select
                  value={newAccountForm.subType}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, subType: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
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

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs rounded-lg font-bold"
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Post Double-Entry Journal Entry</h3>
              <div className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${
                isJournalBalanced ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {isJournalBalanced ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {isJournalBalanced ? 'BALANCED' : 'UNBALANCED'}
              </div>
            </div>

            <form onSubmit={handleCreateJournal} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Narration / Description *</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly GST liability settlement"
                  value={newJournalForm.narration}
                  onChange={(e) => setNewJournalForm({ ...newJournalForm, narration: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-semibold block">Journal Lines (Debit / Credit ₹)</label>
                {newJournalForm.lines.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 items-center">
                    <div className="col-span-6">
                      <select
                        value={l.accountId}
                        onChange={(e) => updateJournalLine(idx, 'accountId', e.target.value)}
                        className="w-full bg-slate-900 text-slate-200 text-xs p-2 rounded border border-slate-700"
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
                        className="w-full bg-slate-900 text-slate-200 text-xs p-2 rounded border border-slate-700 font-mono"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        placeholder="Credit (₹)"
                        value={l.credit || ''}
                        onChange={(e) => updateJournalLine(idx, 'credit', Number(e.target.value))}
                        className="w-full bg-slate-900 text-slate-200 text-xs p-2 rounded border border-slate-700 font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={addJournalLine}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Line
                </button>
                <div className="text-xs space-x-3 font-mono">
                  <span className="text-slate-400">Total Debit: <strong className="text-white">{formatINR(totalDebitSum)}</strong></span>
                  <span className="text-slate-400">Total Credit: <strong className="text-white">{formatINR(totalCreditSum)}</strong></span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowJournalModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !isJournalBalanced}
                  className={`px-4 py-2 text-xs rounded-lg font-bold transition ${
                    isJournalBalanced ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Record Operating Expense Voucher</h3>
            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Paid To (Vendor/Entity) *</label>
                <input
                  type="text"
                  placeholder="e.g. State Electricity Board / Amul Dairy"
                  value={newExpenseForm.paidTo}
                  onChange={(e) => setNewExpenseForm({ ...newExpenseForm, paidTo: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Expense Account *</label>
                  <select
                    value={newExpenseForm.expenseAccountId}
                    onChange={(e) => setNewExpenseForm({ ...newExpenseForm, expenseAccountId: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                    required
                  >
                    {accounts.filter(a => a.type === 'EXPENSE').map((a) => (
                      <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Paid From *</label>
                  <select
                    value={newExpenseForm.paidFromAccountId}
                    onChange={(e) => setNewExpenseForm({ ...newExpenseForm, paidFromAccountId: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
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
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    value={newExpenseForm.amount}
                    onChange={(e) => setNewExpenseForm({ ...newExpenseForm, amount: Number(e.target.value) })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Payment Method</label>
                  <select
                    value={newExpenseForm.paymentMethod}
                    onChange={(e) => setNewExpenseForm({ ...newExpenseForm, paymentMethod: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  >
                    <option value="MOBILE_BANKING">UPI / QR Payment</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="DEBIT_CARD">Debit Card</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs rounded-lg font-bold"
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
