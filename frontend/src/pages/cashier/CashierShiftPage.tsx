import React, { useState, useEffect } from 'react';
import {
  IndianRupee,
  Lock,
  Unlock,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  RefreshCw,
  X,
  CreditCard,
  Smartphone,
  ShieldCheck,
  History
} from 'lucide-react';
import { cashierShiftApi } from '../../api/cashier-shift.api';
import {
  CashSession,
  CashMovementType
} from '../../types/cashier-shift.types';
import { formatINR, formatDateIN } from '../../utils/formatters';

export const CashierShiftPage: React.FC = () => {
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<CashMovementType>('CASH_IN');
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [selectedSessionForRecon, setSelectedSessionForRecon] = useState<CashSession | null>(null);

  // Forms
  const [openFloat, setOpenFloat] = useState(2000);
  const [openNotes, setOpenNotes] = useState('Morning Cash Float');

  const [movementAmount, setMovementAmount] = useState<number | ''>(500);
  const [movementReason, setMovementReason] = useState('');

  // Denominations for Close Shift Counter
  const [denominations, setDenominations] = useState<{ [key: number]: number }>({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0
  });
  const [coinsAmount, setCoinsAmount] = useState<number>(0);
  const [manualCountOverride, setManualCountOverride] = useState<number | ''>('');
  const [closeNotes, setCloseNotes] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [reconcileNotes, setReconcileNotes] = useState('Reviewed and verified against physical vault deposit.');

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const [active, pastShifts] = await Promise.all([
        cashierShiftApi.getActiveSession().catch(() => null),
        cashierShiftApi.getHistory().catch(() => [])
      ]);
      setActiveSession(active);
      setHistory(pastShifts);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to load cashier shifts');
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

  // Calculated counted cash from denominations
  const denominationTotal = Object.entries(denominations).reduce(
    (sum, [denom, count]) => sum + Number(denom) * (Number(count) || 0),
    0
  ) + (Number(coinsAmount) || 0);

  const finalCountedCash = manualCountOverride !== '' ? Number(manualCountOverride) : denominationTotal;
  const expectedCash = activeSession?.liveMetrics?.expectedDrawerCash || 0;
  const variance = finalCountedCash - expectedCash;

  // Handlers
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await cashierShiftApi.openSession({
        openingFloat: Number(openFloat),
        notes: openNotes
      });
      setShowOpenModal(false);
      showToast(`Cashier Shift #${res.sessionNumber} opened successfully!`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to open cashier shift');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    try {
      setLoading(true);
      await cashierShiftApi.recordMovement({
        sessionId: activeSession.id,
        movementType,
        amount: Number(movementAmount),
        reason: movementReason
      });
      setShowMovementModal(false);
      setMovementAmount(500);
      setMovementReason('');
      showToast(`${movementType.replace('_', ' ')} recorded successfully!`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to record cash movement');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    if (variance !== 0 && !varianceReason.trim()) {
      setErrorMsg('Please specify a variance reason before closing the shift.');
      return;
    }

    try {
      setLoading(true);
      const res = await cashierShiftApi.closeSession({
        sessionId: activeSession.id,
        closingCash: finalCountedCash,
        notes: closeNotes,
        varianceReason: variance !== 0 ? varianceReason : undefined
      });
      setShowCloseModal(false);
      showToast(`Shift #${res.sessionNumber} closed with variance ${formatINR(Number(res.cashVariance))}`);
      // Reset counter
      setDenominations({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0 });
      setCoinsAmount(0);
      setManualCountOverride('');
      setVarianceReason('');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to close cashier shift');
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionForRecon) return;
    try {
      setLoading(true);
      await cashierShiftApi.reconcileSession({
        sessionId: selectedSessionForRecon.id,
        notes: reconcileNotes
      });
      setShowReconcileModal(false);
      showToast(`Shift #${selectedSessionForRecon.sessionNumber} reconciled & signed off.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to reconcile shift');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-neutral-100 pb-20 md:pb-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#d4a437]/10 border border-[#d4a437]/20 rounded-2xl text-[#d4a437] font-bold">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Cashier Shift & Drawer Reconciliation
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#d4a437]/20 text-[#d4a437] font-bold border border-[#d4a437]/30">
                  PART 19
                </span>
              </h1>
              <p className="text-xs text-neutral-400">
                Opening Cash Float, Live Sales Breakdown, Cash In/Out, Safe Drops & Discrepancy Tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 border border-white/[0.08] font-semibold text-xs rounded-xl transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {!activeSession ? (
              <button
                onClick={() => setShowOpenModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2a] text-black font-bold text-xs rounded-xl shadow-lg transition"
              >
                <Unlock className="w-4 h-4" />
                Open Cashier Shift
              </button>
            ) : (
              <button
                onClick={() => setShowCloseModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#e5544d] hover:bg-[#c9453f] text-white font-bold text-xs rounded-xl shadow-lg transition"
              >
                <Lock className="w-4 h-4" />
                Close Shift & Reconcile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div className="p-4 bg-[#e5544d]/10 border border-[#e5544d]/20 text-[#e5544d] rounded-2xl text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-neutral-400 hover:text-white ml-3"><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-[#3fbf6f]/10 border border-[#3fbf6f]/20 text-[#3fbf6f] rounded-2xl text-xs flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-neutral-400 hover:text-white ml-3"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Active Shift Dashboard */}
      {activeSession ? (
        <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#3fbf6f] animate-pulse" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white font-mono">{activeSession.sessionNumber}</span>
                  <span className="px-2 py-0.5 bg-[#3fbf6f]/20 text-[#3fbf6f] border border-[#3fbf6f]/30 rounded-md text-[10px] font-bold">
                    SHIFT ACTIVE
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Cashier: <strong className="text-white">{activeSession.openedBy?.firstName} {activeSession.openedBy?.lastName}</strong> ({activeSession.openedBy?.email}) | Outlet: <strong className="text-[#d4a437]">{activeSession.branch?.name}</strong>
                </p>
              </div>
            </div>

            {/* Quick Drawer Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setMovementType('CASH_IN');
                  setShowMovementModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3fbf6f]/10 hover:bg-[#3fbf6f]/20 text-[#3fbf6f] border border-[#3fbf6f]/30 font-semibold text-xs rounded-xl transition"
              >
                <ArrowDownRight className="w-3.5 h-3.5" />
                Cash In (+ Float)
              </button>
              <button
                onClick={() => {
                  setMovementType('CASH_OUT');
                  setShowMovementModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e5544d]/10 hover:bg-[#e5544d]/20 text-[#e5544d] border border-[#e5544d]/30 font-semibold text-xs rounded-xl transition"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Cash Out (Expense)
              </button>
              <button
                onClick={() => {
                  setMovementType('CLOSING_DROP');
                  setShowMovementModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d4a437]/10 hover:bg-[#d4a437]/20 text-[#d4a437] border border-[#d4a437]/30 font-semibold text-xs rounded-xl transition"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Drop to Safe
              </button>
            </div>
          </div>

          {/* Real-time Sales Ticker Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06]">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold">Opening Float</span>
              <div className="text-base font-bold font-mono text-[#d4a437] mt-1">
                {formatINR(Number(activeSession.openingFloat))}
              </div>
              <span className="text-[10px] text-neutral-500">Initial Till Float</span>
            </div>

            <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06]">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold flex items-center gap-1">
                <IndianRupee className="w-3 h-3 text-[#3fbf6f]" /> Cash Sales
              </span>
              <div className="text-base font-bold font-mono text-[#3fbf6f] mt-1">
                {formatINR(activeSession.liveMetrics?.cashSales || 0)}
              </div>
              <span className="text-[10px] text-neutral-500">Physical Cash Collected</span>
            </div>

            <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06]">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-[#4d9de5]" /> Card Sales
              </span>
              <div className="text-base font-bold font-mono text-[#4d9de5] mt-1">
                {formatINR(activeSession.liveMetrics?.cardSales || 0)}
              </div>
              <span className="text-[10px] text-neutral-500">POS EDC Terminal</span>
            </div>

            <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06]">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-[#e5a33d]" /> UPI / QR Sales
              </span>
              <div className="text-base font-bold font-mono text-[#e5a33d] mt-1">
                {formatINR(activeSession.liveMetrics?.upiSales || 0)}
              </div>
              <span className="text-[10px] text-neutral-500">Direct QR Bank Transfer</span>
            </div>

            <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-[#d4a437]/30 shadow-xl">
              <span className="text-[10px] text-[#d4a437] uppercase font-bold">Expected Drawer Cash</span>
              <div className="text-lg font-bold font-mono text-white mt-1">
                {formatINR(activeSession.liveMetrics?.expectedDrawerCash || 0)}
              </div>
              <span className="text-[10px] text-neutral-400">Float + Cash Sales ± Moves</span>
            </div>
          </div>

          {/* Movements Stream */}
          {activeSession.movements && activeSession.movements.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/[0.06]">
              <h4 className="text-xs font-semibold text-neutral-400">Cash Drawer Activity Stream ({activeSession.movements.length})</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {activeSession.movements.map((m) => (
                  <div key={m.id} className="bg-[#0c0c0e] p-3 rounded-xl border border-white/[0.04] flex items-center justify-between text-xs">
                    <div>
                      <span className={`font-bold ${
                        m.movementType === 'CASH_IN' || m.movementType === 'FLOAT_START' ? 'text-[#3fbf6f]' : 'text-[#e5544d]'
                      }`}>
                        {m.movementType}
                      </span>
                      <p className="text-[11px] text-neutral-300 mt-0.5">{m.reason}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-white">{formatINR(Number(m.amount))}</span>
                      <p className="text-[10px] text-neutral-500">{new Date(m.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-12 text-center shadow-2xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto text-neutral-400">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No Active Cashier Shift</h3>
            <p className="text-xs text-neutral-400 mt-1">Open a shift to start accepting cash payments and tracking drawer float</p>
          </div>
          <button
            onClick={() => setShowOpenModal(true)}
            className="px-5 py-2.5 bg-[#d4a437] hover:bg-[#b88c2a] text-black font-bold text-xs rounded-xl shadow-xl transition inline-flex items-center gap-2"
          >
            <Unlock className="w-4 h-4" />
            Open Cashier Shift Now
          </button>
        </div>
      )}

      {/* Shift History & Reconciliation Board */}
      <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#d4a437]" />
            <h3 className="text-base font-bold text-white">Shift History & Reconciliation Board</h3>
          </div>
          <span className="text-xs text-neutral-400">{history.length} shift records</span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-white/[0.03] text-[10px] uppercase text-neutral-400 border-b border-white/[0.08]">
              <tr>
                <th className="px-4 py-3">Shift #</th>
                <th className="px-4 py-3">Cashier</th>
                <th className="px-4 py-3">Opened At</th>
                <th className="px-4 py-3">Closed At</th>
                <th className="px-4 py-3 text-right">Float</th>
                <th className="px-4 py-3 text-right">Cash Sales</th>
                <th className="px-4 py-3 text-right">Card/UPI</th>
                <th className="px-4 py-3 text-right">Expected</th>
                <th className="px-4 py-3 text-right">Counted</th>
                <th className="px-4 py-3 text-right">Variance</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] font-mono">
              {history.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-neutral-500 italic font-sans">
                    No cashier shifts recorded yet
                  </td>
                </tr>
              )}
              {history.map((s) => {
                const varNum = Number(s.cashVariance || 0);
                const isExact = Math.abs(varNum) < 0.01;
                return (
                  <tr key={s.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-[#d4a437] font-bold">{s.sessionNumber}</td>
                    <td className="px-4 py-3 font-sans text-white">{s.openedBy?.firstName} {s.openedBy?.lastName}</td>
                    <td className="px-4 py-3 font-sans text-neutral-400">{formatDateIN(s.openedAt)} {new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-4 py-3 font-sans text-neutral-400">{s.closedAt ? `${new Date(s.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '-'}</td>
                    <td className="px-4 py-3 text-right text-neutral-300">{formatINR(Number(s.openingFloat))}</td>
                    <td className="px-4 py-3 text-right text-[#3fbf6f]">{formatINR(Number(s.totalCashSales))}</td>
                    <td className="px-4 py-3 text-right text-[#4d9de5]">{formatINR(Number(s.totalCardSales) + Number(s.totalUpiSales))}</td>
                    <td className="px-4 py-3 text-right text-neutral-300">{s.expectedCash ? formatINR(Number(s.expectedCash)) : '-'}</td>
                    <td className="px-4 py-3 text-right text-white font-bold">{s.closingCash ? formatINR(Number(s.closingCash)) : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      {s.cashVariance !== null && s.cashVariance !== undefined ? (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          isExact ? 'bg-[#3fbf6f]/20 text-[#3fbf6f]' : varNum > 0 ? 'bg-[#d4a437]/20 text-[#d4a437]' : 'bg-[#e5544d]/20 text-[#e5544d]'
                        }`}>
                          {varNum > 0 ? `+${formatINR(varNum)}` : formatINR(varNum)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center font-sans">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === 'OPEN' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        s.status === 'CLOSED' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                        'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-sans">
                      {s.status === 'CLOSED' && (
                        <button
                          onClick={() => {
                            setSelectedSessionForRecon(s);
                            setShowReconcileModal(true);
                          }}
                          className="px-2.5 py-1 bg-[#d4a437]/10 hover:bg-[#d4a437]/20 text-[#d4a437] border border-[#d4a437]/30 text-[11px] font-bold rounded-lg transition"
                        >
                          Reconcile
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS */}

      {/* 1. OPEN SHIFT MODAL */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Unlock className="w-4 h-4 text-[#d4a437]" /> Open Cashier Shift
              </h3>
              <button onClick={() => setShowOpenModal(false)}><X className="w-5 h-5 text-neutral-400 hover:text-white" /></button>
            </div>
            <form onSubmit={handleOpenShift} className="space-y-3">
              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Opening Cash Float (₹) *</label>
                <input
                  type="number"
                  value={openFloat}
                  onChange={(e) => setOpenFloat(Number(e.target.value))}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] font-mono focus:border-[#d4a437] outline-none text-[#3fbf6f]"
                  required
                />
                <span className="text-[10px] text-neutral-500">Physical notes & coins in drawer at shift start</span>
              </div>
              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Shift Notes / Terminal Ref</label>
                <input
                  type="text"
                  placeholder="e.g. Counter 1 Morning Shift"
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="px-4 py-2 bg-white/[0.04] text-neutral-300 text-xs rounded-xl font-semibold hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2a] text-black text-xs rounded-xl font-bold"
                >
                  Confirm & Open Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CASH MOVEMENT MODAL (CASH IN / CASH OUT / SAFE DROP) */}
      {showMovementModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Record Cash Movement ({movementType})
              </h3>
              <button onClick={() => setShowMovementModal(false)}><X className="w-5 h-5 text-neutral-400 hover:text-white" /></button>
            </div>
            <form onSubmit={handleRecordMovement} className="space-y-3">
              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Movement Type</label>
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value as CashMovementType)}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none"
                >
                  <option value="CASH_IN">Cash In (Float Top-up / Change Inflow)</option>
                  <option value="CASH_OUT">Cash Out (Petty Cash Expense)</option>
                  <option value="CLOSING_DROP">Safe Drop (Mid-Day Vault Transfer)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] font-mono focus:border-[#d4a437] outline-none text-[#d4a437]"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Reason / Voucher Description *</label>
                <input
                  type="text"
                  placeholder="e.g. Milk purchase / Safe drop"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowMovementModal(false)}
                  className="px-4 py-2 bg-white/[0.04] text-neutral-300 text-xs rounded-xl font-semibold hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !movementAmount || !movementReason}
                  className="px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2a] text-black text-xs rounded-xl font-bold"
                >
                  Save Drawer Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. CLOSE SHIFT & DENOMINATION COUNTING MODAL */}
      {showCloseModal && activeSession && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#e5544d]" /> Close Shift & Reconcile Drawer
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">Shift #{activeSession.sessionNumber}</p>
              </div>
              <button onClick={() => setShowCloseModal(false)}><X className="w-5 h-5 text-neutral-400 hover:text-white" /></button>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4">
              {/* Denomination Counter Grid */}
              <div className="bg-[#0c0c0e] p-4 rounded-2xl border border-white/[0.06] space-y-3">
                <span className="text-xs font-bold text-neutral-300 block">Currency Denomination Counter</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[500, 200, 100, 50, 20, 10].map((denom) => (
                    <div key={denom} className="flex items-center gap-2 bg-[#17171b] p-2 rounded-xl border border-white/[0.06]">
                      <span className="text-xs font-mono font-bold text-[#d4a437] w-12">₹{denom} ×</span>
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        value={denominations[denom] || ''}
                        onChange={(e) => setDenominations({ ...denominations, [denom]: Number(e.target.value) || 0 })}
                        className="w-full bg-transparent text-white text-xs font-mono outline-none text-right"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                  <span className="text-xs text-neutral-400 font-semibold">Coins & Loose Change (₹)</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={coinsAmount || ''}
                    onChange={(e) => setCoinsAmount(Number(e.target.value) || 0)}
                    className="w-24 bg-[#17171b] text-white text-xs font-mono p-1.5 rounded-lg border border-white/[0.08] text-right"
                  />
                </div>
              </div>

              {/* Total Counted vs Expected Reconciliation */}
              <div className="grid grid-cols-3 gap-3 bg-[#0c0c0e] p-4 rounded-2xl border border-white/[0.06]">
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase font-semibold">Expected Cash</span>
                  <div className="text-base font-bold font-mono text-white mt-1">
                    {formatINR(expectedCash)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase font-semibold">Total Counted</span>
                  <div className="text-base font-bold font-mono text-[#3fbf6f] mt-1">
                    {formatINR(finalCountedCash)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase font-semibold">Variance (Diff)</span>
                  <div className={`text-base font-bold font-mono mt-1 ${
                    Math.abs(variance) < 0.01 ? 'text-[#3fbf6f]' : variance > 0 ? 'text-[#d4a437]' : 'text-[#e5544d]'
                  }`}>
                    {variance > 0 ? `+${formatINR(variance)}` : formatINR(variance)}
                  </div>
                </div>
              </div>

              {/* Variance Reason required if variance != 0 */}
              {Math.abs(variance) >= 0.01 && (
                <div>
                  <label className="text-xs text-[#e5544d] font-semibold block mb-1">
                    Variance Explanation Required ({variance > 0 ? 'Surplus' : 'Shortage'} of {formatINR(Math.abs(variance))}) *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ₹10 coin shortage or rounding discrepancy"
                    value={varianceReason}
                    onChange={(e) => setVarianceReason(e.target.value)}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-[#e5544d]/40 focus:border-[#e5544d] outline-none"
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Closing Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Till handed over to night cashier"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 bg-white/[0.04] text-neutral-300 text-xs rounded-xl font-semibold hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#e5544d] hover:bg-[#c9453f] text-white text-xs rounded-xl font-bold"
                >
                  Confirm & Finalize Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MANAGER RECONCILIATION MODAL */}
      {showReconcileModal && selectedSessionForRecon && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#d4a437]" /> Manager Reconciliation Sign-off
              </h3>
              <button onClick={() => setShowReconcileModal(false)}><X className="w-5 h-5 text-neutral-400 hover:text-white" /></button>
            </div>
            <form onSubmit={handleReconcile} className="space-y-3">
              <div className="bg-[#0c0c0e] p-3.5 rounded-xl border border-white/[0.06] text-xs space-y-1">
                <p className="text-neutral-400">Shift Number: <strong className="text-white font-mono">{selectedSessionForRecon.sessionNumber}</strong></p>
                <p className="text-neutral-400">Cashier: <strong className="text-white">{selectedSessionForRecon.openedBy?.firstName} {selectedSessionForRecon.openedBy?.lastName}</strong></p>
                <p className="text-neutral-400">Counted Cash: <strong className="text-[#3fbf6f] font-mono">{formatINR(Number(selectedSessionForRecon.closingCash))}</strong></p>
                <p className="text-neutral-400">Variance: <strong className={`font-mono ${Number(selectedSessionForRecon.cashVariance) !== 0 ? 'text-[#e5544d]' : 'text-[#3fbf6f]'}`}>
                  {formatINR(Number(selectedSessionForRecon.cashVariance))}
                </strong></p>
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Supervisor Approval Remarks *</label>
                <input
                  type="text"
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="px-4 py-2 bg-white/[0.04] text-neutral-300 text-xs rounded-xl font-semibold hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2a] text-black text-xs rounded-xl font-bold"
                >
                  Sign Off & Reconcile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashierShiftPage;
