'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Eye,
  Loader2,
  PackageCheck,
  Printer,
  RefreshCw,
  Send,
} from 'lucide-react';
import { apiClient } from '@/api/client';
import { Badge, Button, EmptyState, StatCard } from '@/components/ui';
import { useOutlet } from '@/context/OutletContext';

const money = (v: any) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const unwrap = (r: any) => r?.data?.data ?? r?.data ?? [];
const num = (v: any) => Number(v ?? 0);

export default function CentralStoreWorkspace() {
  const { activeOutlet, isHeadOffice } = useOutlet();
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState('REQUESTED');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<any | null>(null);
  const [dispatchQtys, setDispatchQtys] = useState<Record<string, string>>({});
  const [dispatching, setDispatching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const isCentralStoreScope = String(activeOutlet?.name || '')
        .toLowerCase()
        .includes('central store');
      const branch_id = isHeadOffice || isCentralStoreScope ? undefined : activeOutlet?.id;

      const res = await apiClient.get('/procurement/central-store/queue', {
        params: { status_filter: status, ...(branch_id ? { branch_id } : {}) },
      });
      setRows(unwrap(res));
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ||
          e?.response?.data?.message ||
          e?.message ||
          'Central Store queue could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [activeOutlet?.id, activeOutlet?.name, isHeadOffice, status]);

  useEffect(() => {
    load();
  }, [load]);

  const openTransfer = (row: any) => {
    setView(row);
    const next: Record<string, string> = {};
    (row?.items || []).forEach((item: any) => {
      const id = String(item?.id || item?.item_id || '');
      if (id) next[id] = String(item?.requested_qty ?? item?.quantity ?? 0);
    });
    setDispatchQtys(next);
  };

  const closeTransfer = () => {
    if (dispatching) return;
    setView(null);
    setDispatchQtys({});
  };

  const setQty = (itemId: string, value: string) => {
    setDispatchQtys((prev) => ({ ...prev, [itemId]: value }));
  };

  const escapeHtml = (value: any) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const printTransfer = () => {
    if (!view) return;

    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      setError('Please allow pop-ups in the browser to print the dispatch note.');
      return;
    }

    const itemsHtml = (view.items || [])
      .map((item: any, index: number) => {
        const id = String(item?.id || item?.item_id || index);
        const requested = num(item?.requested_qty ?? item?.quantity);
        const dispatchQty = num(dispatchQtys[id]);
        const amount = dispatchQty * num(item?.unit_cost);

        return `
          <tr>
            <td>${escapeHtml(item?.item_name || '—')}</td>
            <td>${escapeHtml(item?.item_code || '—')}</td>
            <td class="num">${requested}</td>
            <td>${escapeHtml(item?.unit || item?.unit_symbol || '—')}</td>
            <td class="num">${dispatchQty}</td>
            <td class="num strong">${money(amount)}</td>
          </tr>
        `;
      })
      .join('');

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Central Store Dispatch Note - ${escapeHtml(view.transfer_number || '')}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #172033;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-size: 12px;
      line-height: 1.35;
    }

    .sheet {
      width: 100%;
      min-height: 275mm;
      display: flex;
      flex-direction: column;
    }

    .header {
      border: 2px solid #172033;
      padding: 5mm 6mm;
      margin-bottom: 5mm;
    }

    .company {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.4px;
      text-transform: uppercase;
      color: #555;
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 8mm;
      margin-top: 2mm;
    }

    h1 {
      margin: 0;
      font-size: 25px;
      line-height: 1.1;
    }

    .doc-tag {
      border: 1px solid #172033;
      padding: 2mm 3mm;
      font-weight: 700;
      font-size: 11px;
      white-space: nowrap;
      text-transform: uppercase;
    }

    .sub {
      margin-top: 2mm;
      font-size: 11px;
      color: #4b5563;
    }

    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3mm;
      margin-bottom: 5mm;
    }

    .meta-box {
      border: 1px solid #bfc5ce;
      padding: 3.5mm;
      min-height: 18mm;
    }

    .label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .6px;
      color: #69707c;
      margin-bottom: 1.5mm;
      font-weight: 700;
    }

    .value {
      font-size: 13px;
      font-weight: 700;
      color: #172033;
      overflow-wrap: anywhere;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 11.5px;
    }

    thead th {
      background: #172033;
      color: #fff;
      font-weight: 700;
      padding: 3.2mm 2.4mm;
      text-align: left;
      border: 1px solid #172033;
    }

    tbody td {
      border: 1px solid #bfc5ce;
      padding: 3.0mm 2.4mm;
      vertical-align: middle;
    }

    tbody tr:nth-child(even) td {
      background: #f7f8fa;
    }

    th:nth-child(1), td:nth-child(1) { width: 29%; }
    th:nth-child(2), td:nth-child(2) { width: 15%; }
    th:nth-child(3), td:nth-child(3) { width: 15%; }
    th:nth-child(4), td:nth-child(4) { width: 10%; }
    th:nth-child(5), td:nth-child(5) { width: 15%; }
    th:nth-child(6), td:nth-child(6) { width: 16%; }

    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .strong { font-weight: 700; }

    .total-box {
      margin-top: 4mm;
      border: 2px solid #172033;
      padding: 3.5mm 4mm;
      display: flex;
      justify-content: flex-end;
      gap: 10mm;
      align-items: center;
      font-size: 14px;
      font-weight: 700;
    }

    .signature-area {
      margin-top: auto;
      padding-top: 12mm;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12mm;
    }

    .signature {
      padding-top: 12mm;
      border-top: 1px solid #4b5563;
      text-align: center;
      font-size: 10px;
      color: #4b5563;
    }

    .footer {
      margin-top: 8mm;
      padding-top: 3mm;
      border-top: 1px solid #cfd4dc;
      display: flex;
      justify-content: space-between;
      gap: 8mm;
      font-size: 9px;
      color: #69707c;
    }

    @media print {
      html, body { width: 100%; height: auto; overflow: visible; }
      .sheet { min-height: 275mm; }
      table, tr, td, th { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="header">
      <div class="company">CB Hotel Management · Central Store</div>
      <div class="title-row">
        <h1>Central Store Dispatch Note</h1>
        <div class="doc-tag">Internal Stock Transfer</div>
      </div>
      <div class="sub">Transfer No: ${escapeHtml(view.transfer_number || '—')}</div>
    </header>

    <section class="meta">
      <div class="meta-box">
        <div class="label">Requirement No.</div>
        <div class="value">${escapeHtml(requirementNumber)}</div>
      </div>
      <div class="meta-box">
        <div class="label">Transfer No.</div>
        <div class="value">${escapeHtml(view.transfer_number || '—')}</div>
      </div>
      <div class="meta-box">
        <div class="label">From</div>
        <div class="value">Central Store</div>
      </div>
      <div class="meta-box">
        <div class="label">Destination Outlet</div>
        <div class="value">${escapeHtml(view.destination_branch_name || '—')}</div>
      </div>
      <div class="meta-box">
        <div class="label">Status</div>
        <div class="value">${escapeHtml(String(view.status || '').replaceAll('_', ' '))}</div>
      </div>
      <div class="meta-box">
        <div class="label">Purpose</div>
        <div class="value">Outlet Requirement Fulfilment</div>
      </div>
    </section>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Code</th>
          <th class="num">Requested Qty</th>
          <th>Unit</th>
          <th class="num">Dispatch Qty</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="total-box">
      <span>Total Dispatch Value</span>
      <span>${money(dispatchTotal)}</span>
    </div>

    <section class="signature-area">
      <div class="signature">Prepared By · Central Store</div>
      <div class="signature">Checked / Approved By</div>
      <div class="signature">Received By · Outlet</div>
    </section>

    <footer class="footer">
      <div>Generated from Central Store Requirement · ${escapeHtml(view.transfer_number || '—')}</div>
      <div>Destination: ${escapeHtml(view.destination_branch_name || '—')}</div>
    </footer>
  </main>

  <script>
    window.addEventListener('load', function () {
      window.focus();
      setTimeout(function () {
        window.print();
        setTimeout(function () { window.close(); }, 300);
      }, 200);
    });
  </script>
</body>
</html>`;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  };

  const submitDispatch = async () => {
    if (!view?.id) return;

    const items = (view.items || [])
      .map((item: any) => {
        const transferItemId = String(item?.id || '').trim();
        const requested = num(item?.requested_qty ?? item?.quantity);
        const dispatchQty = num(dispatchQtys[transferItemId]);
        return { transferItemId, requested, dispatchQty };
      })
      .filter((row: any) => row.dispatchQty > 0);

    if (!items.length) {
      setError('Enter at least one dispatch quantity greater than zero.');
      return;
    }

    for (const row of items) {
      if (!row.transferItemId) {
        setError('Transfer item id is missing.');
        return;
      }
      if (row.dispatchQty > row.requested) {
        setError('Dispatch quantity cannot exceed the requested quantity.');
        return;
      }
    }

    setDispatching(true);
    setError('');
    try {
      await apiClient.post(`/procurement/central-store/transfers/${view.id}/dispatch`, {
        items: items.map((row: any) => ({
          transfer_item_id: row.transferItemId,
          dispatch_qty: row.dispatchQty,
        })),
        notes: 'Submitted from Central Store Request Queue.',
      });

      setView(null);
      setDispatchQtys({});
      setStatus('PENDING');
      await load();
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ||
          e?.response?.data?.message ||
          e?.message ||
          'Dispatch submission failed.',
      );
    } finally {
      setDispatching(false);
    }
  };

  const totalQty = useMemo(
    () =>
      rows.reduce(
        (n, r) =>
          n +
          (r.items || []).reduce(
            (s: number, i: any) => s + num(i.quantity || i.requested_qty || 0),
            0,
          ),
        0,
      ),
    [rows],
  );

  const totalValue = useMemo(
    () => rows.reduce((n, r) => n + num(r.total_amount || 0), 0),
    [rows],
  );

  const canDispatch = view && ['REQUESTED', 'APPROVED'].includes(String(view.status || '').toUpperCase());

  const requirementNumber = view?.notes
    ? (String(view.notes).match(/(?:from|requirement)\s+([A-Z0-9-]+)/i)?.[1] || '—')
    : '—';

  const dispatchTotal = view
    ? (view.items || []).reduce((sum: number, item: any, index: number) => {
        const id = String(item?.id || item?.item_id || index);
        return sum + num(dispatchQtys[id]) * num(item?.unit_cost);
      }, 0)
    : 0;

  return (
    <div className="space-y-5 text-[#18233A]">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        @media print {
          html, body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            overflow: hidden !important;
          }
          body * { visibility: hidden !important; }
          .print-overlay,
          #central-store-transfer-print,
          #central-store-transfer-print * { visibility: visible !important; }
          .print-overlay {
            position: fixed !important;
            inset: 0 !important;
            display: block !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            overflow: hidden !important;
          }
          #central-store-transfer-print {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: auto !important;
            bottom: auto !important;
            width: 210mm !important;
            max-width: 210mm !important;
            min-width: 210mm !important;
            height: auto !important;
            max-height: 285mm !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 6mm 7mm !important;
            box-sizing: border-box !important;
            background: white !important;
            box-shadow: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            font-size: 9px !important;
          }
          #central-store-transfer-print .print-scroll {
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #central-store-transfer-print .print-scroll > div {
            margin-bottom: 2mm !important;
          }
          #central-store-transfer-print table {
            font-size: 8px !important;
            line-height: 1.1 !important;
            width: 100% !important;
          }
          #central-store-transfer-print th,
          #central-store-transfer-print td {
            padding: 1.2mm 1.6mm !important;
          }
          #central-store-transfer-print .print-scroll .mb-5 { margin-bottom: 2mm !important; }
          #central-store-transfer-print .print-scroll .mt-4 { margin-top: 1.5mm !important; }
          #central-store-transfer-print .print-scroll .mt-6 { margin-top: 2mm !important; }
          #central-store-transfer-print .print-scroll .pt-4 { padding-top: 1.5mm !important; }
          #central-store-transfer-print .print-scroll .p-4 { padding: 1.8mm !important; }
          #central-store-transfer-print > .p-4 { padding: 2mm 0 !important; }
          #central-store-transfer-print .no-print { display: none !important; }
          #central-store-transfer-print tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-[#B8862D]" />
            <h1 className="text-xl font-bold">Central Store</h1>
          </div>
          <p className="text-xs text-[#707070] mt-1">
            Outlet requirements waiting for Central Store fulfilment
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard title="Requests" value={rows.length} icon={<Boxes className="w-4 h-4" />} />
        <StatCard title="Items Qty" value={totalQty} icon={<PackageCheck className="w-4 h-4" />} />
        <StatCard title="Estimated Value" value={money(totalValue)} icon={<PackageCheck className="w-4 h-4" />} />
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {[
          'REQUESTED',
          'APPROVED',
          'PENDING',
          'DISPATCHED',
          'IN_TRANSIT',
          'PARTIALLY_RECEIVED',
          'FULLY_RECEIVED',
        ].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border ${
              status === s
                ? 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/30'
                : 'bg-white text-[#707070] border-gray-200'
            }`}
          >
            {s === 'PENDING' ? 'PENDING APPROVAL' : s.replaceAll('_', ' ')}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-[#707070]">
          Loading Central Store queue…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No ${status.replaceAll('_', ' ').toLowerCase()} transfers`}
          description="Approved Central Store requirements will appear here automatically."
          icon={<Boxes className="w-6 h-6" />}
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => {
            const rowCanDispatch = ['REQUESTED', 'APPROVED'].includes(
              String(r?.status || '').toUpperCase(),
            );
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{r.transfer_number}</span>
                      <Badge variant="outlet">{r.status}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Destination:{' '}
                      <span className="font-semibold text-gray-800">
                        {r.destination_branch_name || '—'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {(r.items || []).length} item(s) · {r.notes || 'Auto-generated from approved requirement'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500">Value</div>
                      <div className="font-bold">{money(r.total_amount)}</div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => openTransfer(r)}>
                      <Eye className="w-4 h-4" /> View
                    </Button>
                    {rowCanDispatch && (
                      <Button size="sm" onClick={() => openTransfer(r)}>
                        <Send className="w-4 h-4" /> Dispatch
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view && (
        <div
          className="print-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={closeTransfer}
        >
          <div
            id="central-store-transfer-print"
            className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">CB Hotel Management · Central Store</div>
                <h3 className="font-bold text-xl mt-1">Central Store Dispatch Note</h3>
                <div className="text-sm text-gray-600 mt-1">Transfer: {view.transfer_number}</div>
              </div>
              <div className="flex items-center gap-2 no-print">
                <Button variant="secondary" onClick={printTransfer}>
                  <Printer className="w-4 h-4" /> Print
                </Button>
                <button type="button" onClick={closeTransfer} className="text-gray-400 px-2 text-xl">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto print-scroll">
              <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="rounded-xl border bg-gray-50 p-3">
                  <div className="text-gray-500">Requirement No.</div>
                  <div className="font-bold mt-1">{requirementNumber}</div>
                </div>
                <div className="rounded-xl border bg-gray-50 p-3">
                  <div className="text-gray-500">From</div>
                  <div className="font-bold mt-1">Central Store</div>
                </div>
                <div className="rounded-xl border bg-gray-50 p-3">
                  <div className="text-gray-500">Outlet / Destination</div>
                  <div className="font-bold mt-1">{view.destination_branch_name || '—'}</div>
                </div>
                <div className="rounded-xl border bg-gray-50 p-3">
                  <div className="text-gray-500">Status</div>
                  <div className="font-bold mt-1">{String(view.status || '').replaceAll('_', ' ')}</div>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2 text-right">Requested Qty</th>
                      <th className="px-3 py-2">Unit</th>
                      <th className="px-3 py-2 text-right">Dispatch Qty</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(view.items || []).map((i: any, index: number) => {
                      const id = String(i?.id || i?.item_id || index);
                      const requested = num(i?.requested_qty ?? i?.quantity);
                      const dispatchQty = num(dispatchQtys[id]);
                      const amount = dispatchQty * num(i?.unit_cost);
                      return (
                        <tr key={id}>
                          <td className="px-3 py-2 font-medium">{i.item_name}</td>
                          <td className="px-3 py-2">{i.item_code || '—'}</td>
                          <td className="px-3 py-2 text-right font-mono">{requested}</td>
                          <td className="px-3 py-2">{i.unit || i.unit_symbol || '—'}</td>
                          <td className="px-3 py-2 text-right">
                            {canDispatch ? (
                              <input
                                type="number"
                                min="0"
                                max={requested}
                                step="0.0001"
                                value={dispatchQtys[id] ?? ''}
                                onChange={(e) => setQty(id, e.target.value)}
                                className="w-28 px-2 py-1.5 rounded-lg border border-[#D9D2C6] bg-white text-right font-mono outline-none focus:ring-2 focus:ring-[#C79A3B]/30"
                              />
                            ) : (
                              <span className="font-mono">{dispatchQty}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">{money(amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end">
                <div className="text-sm font-bold">
                  Dispatch Value:{' '}
{money(dispatchTotal)}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t text-xs text-gray-500 flex justify-between gap-4">
                <div>Generated from Central Store Requirement · Transfer {view.transfer_number}</div>
                <div>Destination: {view.destination_branch_name || '—'}</div>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-between gap-2 no-print">
              <div className="text-xs text-gray-500 self-center">
                Dispatch submit will go to Admin approval. Stock is not reduced at this step.
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={closeTransfer} disabled={dispatching}>
                  Close
                </Button>
                {canDispatch && (
                  <Button onClick={submitDispatch} disabled={dispatching}>
                    {dispatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit Dispatch
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
