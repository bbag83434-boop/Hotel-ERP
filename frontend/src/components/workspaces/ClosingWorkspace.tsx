'use client';

import React, { useState, useEffect } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { procurementApi } from '@/api/procurement';
import {
  OutletClosingRecord,
  ActiveClosingDraft,
  ClosingStockItem,
} from '@/types/purchase.types';
import {
  CalendarDays,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  Calculator,
  ShieldCheck,
  Percent,
  RefreshCw,
  Lock,
  Unlock,
  TrendingUp,
  DollarSign,
  FileSpreadsheet,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Badge, Button, StatCard, AlertBanner, Modal } from '@/components/ui';

export const ClosingWorkspace: React.FC = () => {
  const { activeOutlet, closingInfo, isHeadOffice } = useOutlet();

  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [closingDraft, setClosingDraft] = useState<ActiveClosingDraft | null>(null);
  const [closingHistory, setClosingHistory] = useState<OutletClosingRecord[]>([]);
  const [physicalCounts, setPhysicalCounts] = useState<{ [itemId: string]: number }>({});
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Reopen modal state
  const [reopenModalId, setReopenModalId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState<string>('');

  const fetchClosingData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      if (activeOutlet.id) {
        // 1. Fetch active draft
        try {
          const draft = await procurementApi.getActiveClosingDraft(activeOutlet.id);
          setClosingDraft(draft);
          const initialCounts: { [id: string]: number } = {};
          (draft.items || []).forEach((ci) => {
            initialCounts[ci.item_id] = Number(ci.physical_closing_qty || ci.theoretical_closing_qty || 0);
          });
          setPhysicalCounts(initialCounts);
        } catch (e) {
          // ignore draft error if not initiated
        }

        // 2. Fetch closing history
        const history = await procurementApi.getOutletClosings({
          branch_id: isHeadOffice ? undefined : activeOutlet.id,
        });
        setClosingHistory(history || []);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to load closing records.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosingData();
  }, [activeOutlet.id]);

  // Compute live totals
  const totalPhysicalValuation = (closingDraft?.items || []).reduce((acc, ci) => {
    const qty = physicalCounts[ci.item_id] ?? ci.physical_closing_qty ?? 0;
    return acc + qty * Number(ci.unit_cost || 0);
  }, 0);

  const totalOpening = Number(closingDraft?.opening_valuation || 0);
  const totalPurchases = Number(closingDraft?.total_purchases || 0);
  const calculatedFoodCost = Math.max(0, totalOpening + totalPurchases - totalPhysicalValuation);

  const handleSubmitReconciliation = async () => {
    if (!closingDraft) return;
    setSubmitting(true);
    try {
      const itemsToSubmit = (closingDraft.items || []).map((ci) => ({
        item_id: ci.item_id,
        physical_closing_qty: Number(physicalCounts[ci.item_id] ?? ci.physical_closing_qty ?? 0),
      }));

      const res = await procurementApi.submitOutletClosing({
        branch_id: activeOutlet.id,
        period_type: closingDraft.period_type,
        year: closingDraft.year,
        month: closingDraft.month,
        items: itemsToSubmit,
        notes: closingNotes || undefined,
      });

      setFeedback({
        type: 'success',
        message: `Closing reconciliation submitted successfully! Valuation: $${Number(res.closing_physical_valuation).toFixed(2)}, Actual Food Cost: $${Number(res.actual_food_cost).toFixed(2)}.`,
      });
      fetchClosingData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || 'Failed to submit physical counts.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLockClosing = async (closingId: string) => {
    setLoading(true);
    try {
      await procurementApi.lockOutletClosing(closingId);
      setFeedback({ type: 'success', message: 'Closing period locked and finalized.' });
      fetchClosingData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to lock closing.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReopenClosing = async () => {
    if (!reopenModalId || !reopenReason.trim()) return;
    setLoading(true);
    try {
      await procurementApi.reopenOutletClosing(reopenModalId, { reason: reopenReason });
      setFeedback({ type: 'success', message: 'Closing period reopened for correction.' });
      setReopenModalId(null);
      setReopenReason('');
      fetchClosingData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to reopen closing.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#C79A3B]" />
              Bi-Monthly Closing Engine (1st–15th & 16th–MonthEnd)
            </h2>
            <Badge variant="outlet">[{activeOutlet.code}]</Badge>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Strict physical stock reconciliation calculating actual vs. theoretical consumption and food cost variances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchClosingData}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5 text-[#C79A3B]" />}
          >
            Sync Data
          </Button>
          <Badge variant="warning">
            Active Cycle: {closingInfo.periodType === 'FIRST_HALF' ? '1st–15th' : '16th–End'}
          </Badge>
        </div>
      </div>

      {/* Feedback Banner */}
      <AlertBanner feedback={feedback} onClose={() => setFeedback(null)} />

      {/* Cycle Period Info Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-white via-[#FAF8F5] to-white border border-[rgba(45,45,45,0.08)] shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs text-[#707070] font-semibold uppercase tracking-wider">Accounting Period Range</span>
          <p className="text-lg font-bold text-[#1C1C1C] font-['Outfit']">
            {closingInfo.label} ({closingInfo.startDate.slice(0, 10)} to {closingInfo.endDate.slice(0, 10)})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white border border-[rgba(45,45,45,0.08)] text-center">
            <span className="text-[10px] text-[#707070] block">Days Remaining</span>
            <span className="text-xl font-bold text-[#B8862D] font-['Outfit']">{closingInfo.daysRemaining}</span>
          </div>
          <div className="p-3 rounded-xl bg-white border border-[rgba(45,45,45,0.08)] text-center">
            <span className="text-[10px] text-[#707070] block">Audit Status</span>
            <span className="text-xs font-bold text-[#2E8B57] flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> OPEN
            </span>
          </div>
        </div>
      </div>

      {/* Real-time Math Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          title="1. Opening Stock"
          value={`$${totalOpening.toFixed(2)}`}
          subtitle="Valuation at start of cycle"
          icon={<DollarSign className="w-4 h-4 text-[#1C1C1C]" />}
          iconBgColor="bg-[#FAF8F5] text-[#1C1C1C]"
        />

        <StatCard
          title="2. Period Purchases"
          value={`+$${totalPurchases.toFixed(2)}`}
          subtitle="Total GRN stock received"
          icon={<DollarSign className="w-4 h-4 text-[#2E8B57]" />}
          iconBgColor="bg-[#2E8B57]/10 text-[#2E8B57]"
        />

        <StatCard
          title="3. Closing Count"
          value={`-$${totalPhysicalValuation.toFixed(2)}`}
          subtitle="Physical count valuation"
          icon={<DollarSign className="w-4 h-4 text-[#B8862D]" />}
          iconBgColor="bg-[#F1E4C5]/40 text-[#B8862D]"
        />

        <StatCard
          title="4. Actual Food Cost"
          value={`=$${calculatedFoodCost.toFixed(2)}`}
          subtitle="Formula: 1 + 2 - 3"
          icon={<Calculator className="w-4 h-4 text-[#1C1C1C]" />}
          iconBgColor="bg-gray-100 text-[#1C1C1C]"
        />
      </div>

      {/* Live Physical Stock Reconciliation Entry */}
      {closingDraft && (
        <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-xs text-[#1C1C1C] uppercase tracking-wider font-['Outfit']">
                Physical Stock Count & Automated Valuation Ledger ({activeOutlet.name})
              </h3>
              <p className="text-[11px] text-[#707070]">Formula: Opening + Purchases - Closing = Actual Consumption</p>
            </div>
            <Badge variant="purple">Active Cycle Reconciliation</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-white border-b border-[rgba(45,45,45,0.08)] text-[#707070] font-bold">
                  <th className="p-3.5">Item Name</th>
                  <th className="p-3.5 text-right">Unit Cost</th>
                  <th className="p-3.5 text-right">Opening Qty</th>
                  <th className="p-3.5 text-right">Received Qty</th>
                  <th className="p-3.5 text-right">Theoretical Closing</th>
                  <th className="p-3.5 text-right">Physical Count</th>
                  <th className="p-3.5 text-right">Calculated Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(45,45,45,0.05)] font-mono">
                {closingDraft.items.map((ci) => {
                  const countVal = physicalCounts[ci.item_id] ?? ci.physical_closing_qty ?? 0;
                  const lineVal = countVal * ci.unit_cost;

                  return (
                    <tr key={ci.item_id} className="hover:bg-[#FAF8F5]/60 transition-all font-sans">
                      <td className="p-3.5 font-bold text-[#1C1C1C]">
                        {ci.item_name}
                        <span className="block text-[10px] font-mono text-gray-400">{ci.item_code}</span>
                      </td>
                      <td className="p-3.5 text-right font-mono">${Number(ci.unit_cost).toFixed(2)}</td>
                      <td className="p-3.5 text-right font-mono text-gray-600">{ci.opening_qty} {ci.unit_symbol}</td>
                      <td className="p-3.5 text-right font-mono text-[#2E8B57] font-bold">+{ci.received_qty} {ci.unit_symbol}</td>
                      <td className="p-3.5 text-right font-mono text-gray-600">{ci.theoretical_closing_qty} {ci.unit_symbol}</td>
                      <td className="p-3.5 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={countVal}
                          onChange={(e) =>
                            setPhysicalCounts({
                              ...physicalCounts,
                              [ci.item_id]: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-24 p-1.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl text-xs font-mono font-bold text-[#1C1C1C] text-right focus:outline-none focus:border-[#C79A3B]"
                        />
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-[#B8862D]">${lineVal.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="text"
              placeholder="Closing Remarks / Auditor Notes..."
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              className="flex-1 px-3.5 py-2.5 bg-white border border-[rgba(45,45,45,0.15)] rounded-xl text-xs focus:outline-none focus:border-[#C79A3B]"
            />
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmitReconciliation}
              disabled={submitting}
              loading={submitting}
              icon={<CheckCircle2 className="w-4 h-4 text-[#C79A3B]" />}
            >
              {submitting ? 'Reconciling...' : 'Submit Physical Closing Count'}
            </Button>
          </div>
        </div>
      )}

      {/* Historical Closing Periods */}
      <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs overflow-hidden space-y-2">
        <div className="p-4 border-b border-[rgba(45,45,45,0.08)] bg-[#FAF8F5] flex items-center justify-between">
          <h3 className="font-bold text-xs text-[#1C1C1C] uppercase tracking-wider font-['Outfit']">
            Bi-Monthly Closing History & Food Cost Ledger
          </h3>
          <span className="text-xs text-[#707070]">{closingHistory.length} Period Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-white border-b border-[rgba(45,45,45,0.08)] text-[#707070] font-bold">
                <th className="p-3.5">Period</th>
                <th className="p-3.5">Branch</th>
                <th className="p-3.5 text-right">Opening Value</th>
                <th className="p-3.5 text-right">Purchases (GRN)</th>
                <th className="p-3.5 text-right">Closing Value</th>
                <th className="p-3.5 text-right">Actual Food Cost</th>
                <th className="p-3.5 text-right">Variance %</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(45,45,45,0.05)] font-mono">
              {closingHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400 font-sans">
                    No historical closing records recorded yet. Submit your first period count above.
                  </td>
                </tr>
              ) : (
                closingHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-[#FAF8F5]/60 transition-all font-sans">
                    <td className="p-3.5 font-mono font-bold text-[#1C1C1C]">
                      {h.period_type === 'FIRST_HALF' ? '1st–15th' : '16th–End'} {h.year}-{h.month}
                    </td>
                    <td className="p-3.5 font-semibold text-[#1C1C1C]">{h.branch_name}</td>
                    <td className="p-3.5 text-right font-mono">${Number(h.opening_valuation).toFixed(2)}</td>
                    <td className="p-3.5 text-right font-mono text-[#2E8B57] font-bold">+${Number(h.total_purchases).toFixed(2)}</td>
                    <td className="p-3.5 text-right font-mono">${Number(h.closing_physical_valuation).toFixed(2)}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-[#1C1C1C]">${Number(h.actual_food_cost).toFixed(2)}</td>
                    <td className={`p-3.5 text-right font-mono font-bold ${Math.abs(Number(h.variance_percentage || 0)) > 5 ? 'text-red-600' : 'text-[#2E8B57]'}`}>
                      {Number(h.variance_percentage || 0).toFixed(1)}%
                    </td>
                    <td className="p-3.5">
                      <Badge
                        variant={
                          h.status === 'LOCKED'
                            ? 'purple'
                            : h.status === 'SUBMITTED'
                            ? 'success'
                            : 'neutral'
                        }
                      >
                        {h.status}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      {h.status !== 'LOCKED' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleLockClosing(h.id)}
                          icon={<Lock className="w-3 h-3 text-gray-500" />}
                        >
                          Lock
                        </Button>
                      )}
                      {h.status === 'LOCKED' && isHeadOffice && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setReopenModalId(h.id)}
                          icon={<Unlock className="w-3 h-3 text-amber-600" />}
                        >
                          Reopen
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Core Mathematical Formulas */}
      <div className="p-6 rounded-2xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] space-y-4 font-mono text-xs shadow-inner">
        <div className="flex items-center gap-2 font-sans font-bold text-sm text-[#1C1C1C]">
          <Calculator className="w-4 h-4 text-[#C79A3B]" />
          <span>Core Food Cost & Consumption Formulas (Section 6.15.17):</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[rgba(45,45,45,0.08)] space-y-1 text-[#2E8B57] font-semibold">
          <div className="text-[10px] text-[#707070] font-sans">Formula 1: Actual Consumption Valuation</div>
          <div>Actual Consumption = Opening Physical Stock + Purchases in Period - Closing Physical Count</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[rgba(45,45,45,0.08)] space-y-1 text-[#B8862D] font-semibold">
          <div className="text-[10px] text-[#707070] font-sans">Formula 2: Variance Valuation ($)</div>
          <div>Variance Amount = Actual Consumption - Theoretical Consumption (POS Sales & Recipes)</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[rgba(45,45,45,0.08)] space-y-1 text-[#3978B8] font-semibold">
          <div className="text-[10px] text-[#707070] font-sans">Formula 3: Food Cost Percentage (%)</div>
          <div>Food Cost % = (Actual Consumption Cost / Total Food Sales Revenue) × 100%</div>
        </div>
      </div>

      {/* Security & Audit Note */}
      <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] space-y-2 shadow-sm text-xs text-[#707070]">
        <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#2E8B57]" />
          Immutable Closing Snapshots
        </h3>
        <p>
          Once a bi-monthly period is closed and signed off by the General Manager and Finance Auditor, closing stock valuations and variance records become immutable.
        </p>
      </div>

      {/* Reopen Modal */}
      <Modal
        isOpen={!!reopenModalId}
        onClose={() => setReopenModalId(null)}
        title="Reopen Locked Closing Cycle"
        icon={<Unlock className="w-5 h-5 text-amber-600" />}
      >
        <div className="space-y-4">
          <p className="text-xs text-[#707070]">
            Reopening an approved period allows stock reconciliation corrections but will generate a permanent compliance audit flag in the system log.
          </p>
          <div>
            <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
              Justification / Reason *
            </label>
            <textarea
              placeholder="Enter mandatory GM/Finance justification..."
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              rows={3}
              className="w-full p-2.5 bg-[#FAF8F5] border border-[rgba(45,45,45,0.15)] rounded-xl text-xs focus:outline-none focus:border-[#C79A3B]"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(45,45,45,0.06)]">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setReopenModalId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleReopenClosing}
              disabled={!reopenReason.trim() || loading}
            >
              Reopen Period
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClosingWorkspace;
