import React from 'react';
import {
  FileText,
  TrendingUp,
  IndianRupee,
  Hotel,
  UtensilsCrossed,
  Boxes,
  Users,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getIndianFinancialYear } from '../../utils/formatters';

export const ReportsHubPage: React.FC = () => {
  const navigate = useNavigate();

  const reportCategories = [
    {
      title: 'Profit & Loss Statement (P&L)',
      description: 'Real-time double-entry revenue, BOM kitchen COGS, gross profit & net income statement (Indian FY).',
      path: '/accounting',
      icon: TrendingUp,
      badge: 'Real-Time GST & P&L',
      badgeColor: 'bg-emerald-500/20 text-emerald-300'
    },
    {
      title: 'Statement of Cash Flows',
      description: 'Cash inflows and outflows derived from operating bank and cash general ledger journals.',
      path: '/accounting',
      icon: IndianRupee,
      badge: 'Live GL Derived',
      badgeColor: 'bg-sky-500/20 text-sky-300'
    },
    {
      title: 'Hotel Occupancy & Night Audit Reports',
      description: 'Room revenue, ADR (Average Daily Rate), RevPAR, occupancy rate % and folio breakdown.',
      path: '/hotel',
      icon: Hotel,
      badge: 'PMS Analytics',
      badgeColor: 'bg-indigo-500/20 text-indigo-300'
    },
    {
      title: 'Restaurant F&B Sales & Cashier Settlement',
      description: 'Sales records, menu item popularity, dine-in vs takeaway sales, and discount audits.',
      path: '/restaurant',
      icon: UtensilsCrossed,
      badge: 'POS Terminal Reports',
      badgeColor: 'bg-rose-500/20 text-rose-300'
    },
    {
      title: 'Inventory Valuation & Immutable Stock Ledger',
      description: 'Live asset valuation, batch & expiry tracking, warehouse balances, and wastage logs.',
      path: '/inventory',
      icon: Boxes,
      badge: 'Supply Chain',
      badgeColor: 'bg-amber-500/20 text-amber-300'
    },
    {
      title: 'HR & Monthly Payroll Disbursement Reports',
      description: 'Staff salary records, attendance hours, approved leaves, and GL salary voucher entries.',
      path: '/hr',
      icon: Users,
      badge: 'HR & Wages',
      badgeColor: 'bg-cyan-500/20 text-cyan-300'
    },
    {
      title: 'Approval Center & Governance Audit',
      description: 'Multi-step authorization history for purchase requests, high discounts, and expenses.',
      path: '/approvals',
      icon: ShieldCheck,
      badge: 'Governance',
      badgeColor: 'bg-purple-500/20 text-purple-300'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-xl shadow-lg shadow-purple-900/20 text-white font-bold">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Reports & Executive Analytics Hub
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium border border-purple-500/30">
                {getIndianFinancialYear()}
              </span>
            </h1>
            <p className="text-xs text-slate-400">Direct access to cross-module financial, operational and audit reports</p>
          </div>
        </div>
      </header>

      {/* Grid of Report Cards */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reportCategories.map((rep, idx) => {
            const Icon = rep.icon;
            return (
              <div
                key={idx}
                onClick={() => navigate(rep.path)}
                className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl hover:border-slate-700 hover:bg-slate-850 cursor-pointer transition flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 group-hover:text-purple-400 transition">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${rep.badgeColor}`}>
                      {rep.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition">{rep.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{rep.description}</p>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold text-purple-400 pt-3 border-t border-slate-800/80 group-hover:text-purple-300">
                  <span>Open Report & Filters</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
