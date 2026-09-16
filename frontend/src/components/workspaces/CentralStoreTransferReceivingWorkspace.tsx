
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useOutlet } from '@/context/OutletContext';
import { Button, Badge, EmptyState } from '@/components/ui';

interface TransferItem {
  transfer_item_id: string;
  item_name: string;
  item_code?: string;
  unit?: string;
  dispatch_qty: number;
  received_qty: number;
  unit_cost: number;
  amount: number;
}

interface TransferRow {
  id: string;
  transfer_number: string;
  status: string;
  source_warehouse_name?: string;
  destination_branch_name?: string;
  transfer_date?: string;
  items: TransferItem[];
  total_amount?: number;
}

const money = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r ?? [];

export default function CentralStoreTransferReceivingWorkspace() {
  const { activeOutlet } = useOutlet();
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await apiClient.get('/procurement/central-store/receiving', {
        params: { branch_id: activeOutlet?.id || undefined },
      });
      setRows(unwrap(response));
    } catch (error: any) {
      const data = error?.response?.data;
      setMessage(data?.detail || data?.message || 'Receiving data could not be loaded.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeOutlet?.id]);

  useEffect(() => { load(); }, [load]);

  const receive = async (row: TransferRow) => {
    setActingId(row.id);
    setMessage('');
    try {
      await apiClient.post(`/procurement/central-store/transfers/${row.id}/receive`, {
        items: row.items.map((item) => ({
          transfer_item_id: item.transfer_item_id,
          received_qty: item.dispatch_qty,
        })),
      });
      setMessage(`${row.transfer_number} received successfully. Outlet stock has been updated.`);
      await load();
    } catch (error: any) {
      const data = error?.response?.data;
      setMessage(data?.detail || data?.message || 'Receiving failed.');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-[#B8862D]" />
            <h1 className="text-xl font-bold">Central Store Receiving</h1>
          </div>
          <p className="text-xs text-[#707070] mt-1">Admin-approved Central Store transfers ready for this outlet to receive.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {message && <div className="p-3 rounded-xl bg-white border border-gray-200 text-xs font-medium">{message}</div>}

      {loading ? (
        <div className="p-8 text-center text-sm text-[#707070]">Loading Central Store transfers…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No Central Store transfers to receive" description="Admin-approved transfers will appear here." icon={<CheckCircle2 className="w-6 h-6" />} />
      ) : (
        <div className="grid gap-4">
          {rows.map((row) => (
            <div key={row.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm">{row.transfer_number}</span>
                    <Badge variant="outlet">{row.status}</Badge>
                  </div>
                  <div className="text-xs text-[#707070] mt-1">
                    {row.source_warehouse_name || 'Central Store'} → {row.destination_branch_name || activeOutlet?.name || 'This Outlet'}
                  </div>
                </div>
                <Button size="sm" variant="primary" disabled={actingId === row.id} onClick={() => receive(row)}>
                  <PackageCheck className="w-4 h-4" /> Receive Stock
                </Button>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Dispatch Qty</th>
                      <th className="px-3 py-2">Unit</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.items.map((item) => (
                      <tr key={item.transfer_item_id} className="border-t">
                        <td className="px-3 py-3">
                          <div className="font-semibold">{item.item_name}</div>
                          <div className="text-[10px] text-gray-500">{item.item_code || ''}</div>
                        </td>
                        <td className="px-3 py-3 font-bold">{item.dispatch_qty}</td>
                        <td className="px-3 py-3">{item.unit || 'UNIT'}</td>
                        <td className="px-3 py-3 text-right font-bold">{money(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
