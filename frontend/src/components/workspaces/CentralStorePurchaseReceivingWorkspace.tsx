'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, FileText, PackageCheck, RefreshCw, Upload, X } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useOutlet } from '@/context/OutletContext';

const money = (v: unknown) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? [];

function fileToBase64(file: File) {
  return new Promise<{ base64: string; fileType: string; fileName: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve({
        base64: result.split(',')[1] || '',
        fileType: file.type || 'image/jpeg',
        fileName: file.name,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CentralStorePurchaseReceivingWorkspace() {
  const { activeOutlet } = useOutlet();
  const branchId = activeOutlet?.id;

  const [orders, setOrders] = useState<any[]>([]);
  const [selectedPO, setSelectedPO] = useState<any | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('0');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    if (!branchId) return;

    setLoading(true);
    setMessage(null);

    try {
      // Central Store receiving must not depend on branch_id matching the PO row.
      // Load company POs and keep only Central Store purchase orders that came
      // through the approved Central Store requirement flow.
      const res = await apiClient.get('/procurement/orders');

      const rows = Array.isArray(unwrap(res)) ? unwrap(res) : [];
      const receivingReady = rows.filter((po: any) => {
        const status = String(po?.status || '').toUpperCase();
        const purchaseType = String(po?.purchase_type || po?.purchaseType || '').toUpperCase();
        const branchName = String(po?.branch_name || po?.branch?.name || '').toLowerCase();
        const note = String(po?.notes || '').toLowerCase();

        const isCentralStorePO =
          purchaseType === 'CENTRAL_STORE_PURCHASE' ||
          branchName.includes('central store') ||
          note.includes('central store requirement');

        const isReceivingStatus = [
          'DRAFT',
          'PENDING_APPROVAL',
          'APPROVED',
          'ORDERED',
          'ISSUED',
          'WHATSAPP_OPENED',
          'SENT_MANUALLY',
          'PARTIALLY_RECEIVED',
        ].includes(status);

        return isCentralStorePO && isReceivingStatus;
      });

      setOrders(receivingReady);
    } catch (err: any) {
      setOrders([]);
      setMessage({
        type: 'error',
        text:
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          'Approved Central Store purchase orders could not be loaded.',
      });
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    load();
  }, [load]);

  const openReceiving = (po: any) => {
    setSelectedPO(po);
    setInvoiceNumber('');
    setInvoiceAmount(String(po?.net_amount ?? po?.total_amount ?? 0));
    setInvoiceFile(null);
    setNotes('');
    setMessage(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const closeReceiving = () => {
    setSelectedPO(null);
    setInvoiceFile(null);
    setInvoiceNumber('');
    setInvoiceAmount('0');
    setNotes('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const selectedVendor =
    selectedPO?.supplier_name ||
    selectedPO?.supplier?.name ||
    'Vendor from approved PO';

  const outstandingItems = useMemo(() => {
    if (!selectedPO?.items) return [];

    return selectedPO.items
      .map((line: any) => {
        const ordered = Number(line.ordered_qty ?? line.quantity ?? 0);
        const received = Number(line.received_qty ?? 0);
        const remaining = Math.max(0, ordered - received);

        return {
          ...line,
          ordered_qty: ordered,
          received_qty: received,
          remaining_qty: remaining,
        };
      })
      .filter((line: any) => line.remaining_qty > 0);
  }, [selectedPO]);

  const handleBillSelected = (file: File | null) => {
    setInvoiceFile(file);
    if (!file) return;

    setMessage({
      type: 'success',
      text: `Bill selected: ${file.name}`,
    });
  };

  const submitReceiving = async () => {
    if (!selectedPO || !branchId) return;

    if (!invoiceFile) {
      setMessage({
        type: 'error',
        text: 'Bill photo/PDF is required. Use Camera or Choose File.',
      });
      return;
    }

    // Keep invoice number optional for the first upload stage.
    // A temporary reference is used until the OCR parser is connected.
    const finalInvoiceNumber =
      invoiceNumber.trim() || `BILL-${Date.now().toString().slice(-8)}`;

    if (!outstandingItems.length) {
      setMessage({
        type: 'error',
        text: 'This PO has no outstanding quantity left to receive.',
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const file = await fileToBase64(invoiceFile);

      const uploadRes = await apiClient.post('/procurement/receiving/upload-invoice', {
        branch_id: branchId,
        invoice_number: finalInvoiceNumber,
        invoice_amount: Number(invoiceAmount || selectedPO?.net_amount || selectedPO?.total_amount || 0),
        file_name: file.fileName,
        file_type: file.fileType,
        file_base64: file.base64,
      });

      const uploadData = uploadRes?.data?.data ?? uploadRes?.data ?? {};
      const storageRef = uploadData?.storage_ref || '';

      // Current backend receiving endpoint requires line quantities.
      // For this stable first workflow, the PO's remaining quantity is used.
      // OCR/bill-line extraction should replace this mapping in the next step.
      const items = outstandingItems.map((line: any) => ({
        po_item_id: line.id,
        item_id: line.item_id,
        received_qty: Number(line.remaining_qty),
        accepted_qty: Number(line.remaining_qty),
        rejected_qty: 0,
        unit_price: Number(line.unit_price ?? line.rate ?? 0),
        qc_status: 'PASSED',
      }));

      await apiClient.post('/procurement/grn/from-po', {
        po_id: selectedPO.id,
        branch_id: branchId,
        supplier_invoice_number: finalInvoiceNumber,
        invoice_amount: Number(
          invoiceAmount || selectedPO?.net_amount || selectedPO?.total_amount || 0,
        ),
        invoice_file_name: storageRef
          ? `${invoiceFile.name} | ${storageRef}`
          : invoiceFile.name,
        notes: `${notes.trim()}${storageRef ? ` [Invoice Storage: ${storageRef}]` : ''}`.trim(),
        items,
      });

      setMessage({
        type: 'success',
        text: 'Bill uploaded and Central Store receiving submitted. Admin approval is required before stock is posted.',
      });

      closeReceiving();
      await load();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text:
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          'Receiving submission failed.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!branchId) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Select Central Store scope first.
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">CENTRAL STORE PURCHASE RECEIVING</h2>
          <p className="text-xs text-[#707070] mt-1">
            Central Store only receives vendor deliveries against Admin-approved purchase orders.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-xs font-semibold ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="font-bold text-sm">Admin Approved Purchase Orders</div>
          <div className="text-[11px] text-[#777]">
            Admin-approved Central Store POs appear here for receiving.
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-[#777]">
            Loading approved purchase orders…
          </div>
        ) : !orders.length ? (
          <div className="p-10 text-center text-sm text-[#777]">
            No Admin-approved Central Store purchase orders waiting for receiving.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {orders.map((po: any) => (
              <div
                key={po.id}
                className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold font-mono text-xs">
                      {po.po_number || po.poNumber || po.id}
                    </span>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                      String(po.status || '').toUpperCase() === 'APPROVED'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {String(po.status || 'APPROVED').toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-[#555]">
                    Vendor: {po.supplier_name || po.supplier?.name || 'Vendor from PO'}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-[#777]">
                      PO Amount
                    </div>
                    <div className="font-bold font-mono">
                      {money(po.net_amount ?? po.total_amount)}
                    </div>
                  </div>

                  <button
                    onClick={() => openReceiving(po)}
                    className="px-4 py-2 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold flex items-center gap-2"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    Receive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPO && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-xl">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-base">Receive Vendor Bill</div>
                <div className="text-xs text-[#777] mt-1">
                  PO {selectedPO.po_number || selectedPO.poNumber || selectedPO.id} · {selectedVendor}
                </div>
              </div>

              <button onClick={closeReceiving} className="p-2 text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-2xl border border-gray-200 p-4 bg-[#FAF8F5]">
                <div className="text-xs font-bold mb-2">Vendor Bill</div>
                <div className="text-[11px] text-[#666]">
                  Take a photo from camera or upload the supplier bill/PDF.
                  The bill is attached to this approved PO and sent for Admin receiving approval.
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#707070]">
                      Bill / Invoice Number
                    </label>
                    <input
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="Optional for now"
                      className="mt-1 w-full p-2.5 rounded-xl border border-gray-200 bg-white text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#707070]">
                      Bill Amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={invoiceAmount}
                      onChange={(e) => setInvoiceAmount(e.target.value)}
                      className="mt-1 w-full p-2.5 rounded-xl border border-gray-200 bg-white text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold cursor-pointer flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5" />
                    Choose Bill
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => handleBillSelected(e.target.files?.[0] || null)}
                    />
                  </label>

                  <label className="px-3 py-2 rounded-xl bg-[#F1E4C5] text-[#7A5B17] text-xs font-bold cursor-pointer flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5" />
                    Camera
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleBillSelected(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                {invoiceFile && (
                  <div className="mt-3 text-[11px] text-[#555] flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    {invoiceFile.name}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-[#FAF8F5] font-bold text-sm">
                  PO Items
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-3 text-left">Item</th>
                        <th className="px-4 py-3 text-right">Ordered</th>
                        <th className="px-4 py-3 text-right">Already Received</th>
                        <th className="px-4 py-3 text-right">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outstandingItems.map((line: any) => (
                        <tr key={line.id} className="border-t border-gray-100">
                          <td className="px-4 py-3">
                            <div className="font-semibold">
                              {line.item_name || line.item?.name || line.name || 'Item'}
                            </div>
                            <div className="text-[10px] text-[#888]">
                              {line.item_code || line.item?.code || ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono">{line.ordered_qty}</td>
                          <td className="px-4 py-3 text-right font-mono">{line.received_qty}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold">
                            {line.remaining_qty}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#707070]">
                  Receiving Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Condition / remarks / delivery note…"
                  className="mt-1 w-full p-2.5 rounded-xl border border-gray-200 bg-[#FAF8F5] text-xs"
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={closeReceiving}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600"
              >
                Cancel
              </button>

              <button
                onClick={submitReceiving}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold disabled:opacity-50"
              >
                {saving ? 'Submitting…' : 'Submit Receiving for Admin Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
