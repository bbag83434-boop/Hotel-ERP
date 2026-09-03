import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/api/client';
import { useOutlet } from '@/context/OutletContext';
import { useAuth } from '@/context/AuthContext';
import { Plus, History, Check, AlertCircle, ShoppingBag, Info, AlertTriangle } from 'lucide-react';

interface PreviewIngredient {
  ingredient_item_id: string;
  ingredient_name: string;
  unit_id: string;
  unit_symbol: string;
  required_qty: number;
  available_qty: number;
  rate: number;
  cost: number;
  is_shortage: boolean;
  shortage_qty: number;
}

interface PreviewResponse {
  item_id: string;
  item_name: string;
  sold_qty: number;
  recipe_id: string;
  recipe_yield: number;
  ingredients: PreviewIngredient[];
  total_cost: number;
  is_valid: boolean;
  message: string;
}

export default function OutletSalesWorkspace() {
  const { activeOutlet, isHeadOffice } = useOutlet();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'entry' | 'history'>('entry');
  
  const [items, setItems] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [history, setHistory] = useState<any[]>([]);
  
  const isManagement = ['SUPER_ADMIN', 'ADMIN', 'HQ_ADMIN', 'HEAD_OFFICE_ADMIN'].includes(
    (typeof user?.role === 'object' ? user.role.name : user?.role)?.toUpperCase() || ''
  );

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    if (activeOutlet?.id) {
      setSelectedBranchId(activeOutlet.id);
    } else if (branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [activeOutlet, branches]);

  const fetchMetadata = async () => {
    try {
      const [itemsRes, unitsRes, branchesRes] = await Promise.all([
        apiClient.get('/inventory/items'),
        apiClient.get('/inventory/units'),
        apiClient.get('/organization/branches')
      ]);
      setItems(itemsRes.data?.data?.filter((i: any) => i.type === 'FINISHED_GOOD' || i.type === 'SEMI_FINISHED') || []);
      setUnits(unitsRes.data?.data || []);
      setBranches(branchesRes.data?.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePreview = async () => {
    if (!selectedBranchId || !selectedItemId || !quantity || !selectedUnitId) {
      setError('Please fill all fields');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.post('/outlet-sales/preview', {
        branch_id: selectedBranchId,
        item_id: selectedItemId,
        quantity: Number(quantity),
        unit_id: selectedUnitId
      });
      setPreviewData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error getting preview');
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    if (!previewData?.is_valid) {
      setError('Cannot post invalid transaction');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await apiClient.post('/outlet-sales', {
        branch_id: selectedBranchId,
        item_id: selectedItemId,
        quantity: Number(quantity),
        unit_id: selectedUnitId,
        transaction_date: new Date().toISOString().split('T')[0],
        idempotency_key: `sale_${Date.now()}_${Math.random().toString(36).substring(7)}`
      });
      // Success
      setPreviewData(null);
      setQuantity('');
      alert('Transaction posted successfully');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error posting transaction');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/outlet-sales', {
        params: selectedBranchId ? { branch_id: selectedBranchId } : {}
      });
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, selectedBranchId]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1C]">Outlet Sales & Consumption</h1>
          <p className="text-sm text-[#707070]">Record direct finished good sales and automate ingredient deduction.</p>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-gray-200 mb-6">
        <button
          className={`pb-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'entry' ? 'border-[#C79A3B] text-[#C79A3B]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('entry')}
        >
          <div className="flex items-center gap-2"><Plus className="w-4 h-4"/> Entry</div>
        </button>
        <button
          className={`pb-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'history' ? 'border-[#C79A3B] text-[#C79A3B]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('history')}
        >
          <div className="flex items-center gap-2"><History className="w-4 h-4"/> History</div>
        </button>
      </div>

      {isManagement && (
        <div className="mb-4 bg-white p-3 rounded-lg shadow-sm">
          <label className="block text-xs font-medium text-gray-700 mb-1">Outlet (Admin View)</label>
          <select
            className="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-[#C79A3B]"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
          >
            <option value="">Select Outlet...</option>
            {branches.filter(b => b.type !== 'HEAD_OFFICE' && b.type !== 'CENTRAL_STORE' && b.type !== 'DESSERT_KITCHEN').map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {activeTab === 'entry' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4 lg:col-span-1 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#C79A3B]" /> Transaction Details
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Finished / Semi-Finished Good</label>
                <select
                  className="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-[#C79A3B]"
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                >
                  <option value="">Select item...</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Quantity Sold</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value ? Number(e.target.value) : '')}
                    className="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-[#C79A3B]"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    className="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-[#C79A3B]"
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                  >
                    <option value="">Select unit...</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <div className="p-2 bg-red-50 text-red-600 text-xs rounded-md border border-red-100 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button 
                onClick={handlePreview} 
                disabled={loading || !selectedItemId || !quantity || !selectedUnitId || !selectedBranchId}
                className="w-full bg-[#1C1C1C] hover:bg-[#333] text-white"
              >
                {loading ? 'Calculating...' : 'Preview Consumption'}
              </Button>
            </div>
          </div>

          <div className="lg:col-span-2">
            {previewData ? (
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm h-full flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      Consumption Preview
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Recipe Yield: {previewData.recipe_yield} | Required ratio applies to ingredients
                    </p>
                  </div>
                  {previewData.is_valid ? (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-md border border-green-200 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Ready to Post
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-md border border-red-200 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Stock Shortage
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">Ingredient</th>
                        <th className="px-4 py-2 font-medium text-right">Required</th>
                        <th className="px-4 py-2 font-medium text-right">Available</th>
                        <th className="px-4 py-2 font-medium text-right">Status</th>
                        <th className="px-4 py-2 font-medium text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewData.ingredients.map((ing, idx) => (
                        <tr key={idx} className={ing.is_shortage ? "bg-red-50/50" : ""}>
                          <td className="px-4 py-2 font-medium text-gray-800">{ing.ingredient_name}</td>
                          <td className="px-4 py-2 text-right">{ing.required_qty.toFixed(4)} {ing.unit_symbol}</td>
                          <td className="px-4 py-2 text-right">{ing.available_qty.toFixed(4)} {ing.unit_symbol}</td>
                          <td className="px-4 py-2 text-right">
                            {ing.is_shortage ? (
                              <span className="text-red-600 font-semibold text-xs">Short {ing.shortage_qty.toFixed(2)}</span>
                            ) : (
                              <span className="text-green-600 font-semibold text-xs">OK</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">${ing.cost.toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-bold">
                        <td colSpan={4} className="px-4 py-2 text-right">Total Recipe Cost</td>
                        <td className="px-4 py-2 text-right text-[#C79A3B]">${previewData.total_cost.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 pt-4 border-t flex justify-end gap-3">
                  <Button className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50" onClick={() => setPreviewData(null)}>Cancel</Button>
                  <Button 
                    onClick={handlePost} 
                    disabled={!previewData.is_valid || loading}
                    className="bg-[#C79A3B] hover:bg-[#B8862D] text-white"
                  >
                    {loading ? 'Posting...' : 'Post Transaction'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 p-6 text-center text-gray-400">
                <div>
                  <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select item and quantity, then click Preview to calculate required ingredients.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Item Sold</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Total Cost</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">{new Date(record.transaction_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {items.find(i => i.id === record.item_id)?.name || 'Unknown Item'}
                    </td>
                    <td className="px-4 py-3">
                      {record.quantity} {units.find(u => u.id === record.unit_id)?.symbol || ''}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700">${Number(record.total_cost).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold tracking-wide bg-green-100 text-green-700">
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                      No sales history found for this outlet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
