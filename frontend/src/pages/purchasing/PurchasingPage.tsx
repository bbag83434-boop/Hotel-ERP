import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  FileCheck,
  PackageCheck,
  Users,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RefreshCw,
  X,
  Camera,
  Upload,
  ShieldCheck,
  Eye
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { purchaseApi } from '../../api/purchase.api';
import { inventoryApi } from '../../api/inventory.api';
import {
  Supplier,
  SupplierLedgerEntry,
  PurchaseRequest,
  PurchaseOrder,
  GoodsReceiveNote,
  PRPriority
} from '../../types/purchase.types';
import { formatINR, formatDateIN } from '../../utils/formatters';
import { Item, Warehouse } from '../../types/inventory.types';
import { useAuth } from '../../context/AuthContext';

export const PurchasingPage: React.FC = () => {
  const { user, selectedBranchId } = useAuth();
  const [activeTab, setActiveTab] = useState<'requests' | 'orders' | 'grn' | 'suppliers'>('suppliers');

  // Data lists
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [grns, setGrns] = useState<GoodsReceiveNote[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showRequestModal, setShowRequestModal] = useState<boolean>(false);
  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);
  const [selectedPR, setSelectedPR] = useState<PurchaseRequest | null>(null);
  const [approveForm, setApproveForm] = useState({ autoCreatePO: true, supplierId: '', notes: '' });

  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  const [showPOModal, setShowPOModal] = useState<boolean>(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  const [showGRNModal, setShowGRNModal] = useState<boolean>(false);
  const [selectedGRNDetails, setSelectedGRNDetails] = useState<GoodsReceiveNote | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState<boolean>(false);
  const [showLedgerModal, setShowLedgerModal] = useState<boolean>(false);
  const [selectedSupplierLedger, setSelectedSupplierLedger] = useState<{ supplier: Supplier; entries: SupplierLedgerEntry[] } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form States
  const [prForm, setPrForm] = useState({
    requiredDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    priority: 'MEDIUM' as PRPriority,
    notes: '',
    items: [{ itemId: '', requestedQty: 10, estimatedPrice: 0, notes: '' }]
  });

  const [poForm, setPoForm] = useState({
    supplierId: '',
    deliveryDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    taxAmount: 0,
    notes: '',
    items: [{ itemId: '', orderedQty: 10, unitPrice: 0, notes: '' }]
  });

  const [grnForm, setGrnForm] = useState({
    warehouseId: '',
    supplierId: '',
    poId: '',
    receiveDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    invoiceAmount: 0,
    taxAmount: 0,
    freightAmount: 0,
    allowPriceVariance: false,
    invoiceAttachment: null as { fileName: string; fileType: string; fileBase64: string; fileSize: number } | null,
    notes: '',
    items: [{ itemId: '', receivedQty: 10, acceptedQty: 10, unitPrice: 0, batchNumber: `BAT-${Math.floor(1000 + Math.random() * 9000)}`, expiryDate: '' }]
  });

  const [supplierForm, setSupplierForm] = useState({
    name: '',
    code: `SUP-${Math.floor(100 + Math.random() * 900)}`,
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    taxNumber: '',
    paymentTerms: 'NET_30'
  });

  // Load Base Metadata
  const loadBaseMetadata = useCallback(async () => {
    try {
      const [suppRes, itemsRes, whList] = await Promise.all([
        purchaseApi.getSuppliers({ limit: 100 }),
        inventoryApi.getItems({ limit: 100 }),
        inventoryApi.getWarehouses()
      ]);
      setSuppliers(suppRes.suppliers);
      setItems(itemsRes.items);
      setWarehouses(whList);

      if (suppRes.suppliers.length > 0) {
        setApproveForm((prev) => ({ ...prev, supplierId: suppRes.suppliers[0].id }));
        setPoForm((prev) => ({ ...prev, supplierId: suppRes.suppliers[0].id }));
        setGrnForm((prev) => ({ ...prev, supplierId: suppRes.suppliers[0].id }));
      }
      if (whList.length > 0) {
        setGrnForm((prev) => ({ ...prev, warehouseId: whList[0].id }));
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Error loading purchasing metadata');
    }
  }, []);

  const loadTabData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      if (activeTab === 'requests') {
        const res = await purchaseApi.getPurchaseRequests({ branchId: selectedBranchId || undefined });
        setRequests(res.requests);
      } else if (activeTab === 'orders') {
        const res = await purchaseApi.getPurchaseOrders({ branchId: selectedBranchId || undefined });
        setOrders(res.orders);
      } else if (activeTab === 'grn') {
        const res = await purchaseApi.getGoodsReceiveNotes({ branchId: selectedBranchId || undefined });
        setGrns(res.grns);
      } else if (activeTab === 'suppliers') {
        const res = await purchaseApi.getSuppliers();
        setSuppliers(res.suppliers);
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to load tab data');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, selectedBranchId]);

  useEffect(() => {
    loadBaseMetadata();
  }, [loadBaseMetadata]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  // Handlers
  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    const branchId = selectedBranchId || user?.branches[0]?.id;
    if (!branchId) {
      setErrorMsg('No active branch selected');
      return;
    }
    const validItems = prForm.items.filter((i) => i.itemId && i.requestedQty > 0);
    if (validItems.length === 0) {
      setErrorMsg('Please add at least one valid item');
      return;
    }

    try {
      await purchaseApi.createPurchaseRequest({
        branchId,
        requiredDate: prForm.requiredDate,
        priority: prForm.priority,
        notes: prForm.notes,
        items: validItems
      });
      setSuccessMsg('Purchase Request submitted for approval');
      setShowRequestModal(false);
      loadTabData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to submit PR');
    }
  };

  const handleApprovePR = async () => {
    if (!selectedPR) return;
    try {
      const res = await purchaseApi.approvePurchaseRequest(selectedPR.id, approveForm);
      setSuccessMsg(
        res.purchaseOrder
          ? `PR Approved and PO ${res.purchaseOrder.poNumber} created automatically!`
          : 'Purchase Request approved successfully'
      );
      setShowApproveModal(false);
      setSelectedPR(null);
      loadTabData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to approve PR');
    }
  };

  const handleRejectPR = async () => {
    if (!selectedPR || !rejectReason) return;
    try {
      await purchaseApi.rejectPurchaseRequest(selectedPR.id, rejectReason);
      setSuccessMsg('Purchase Request rejected');
      setShowRejectModal(false);
      setSelectedPR(null);
      loadTabData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to reject PR');
    }
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const branchId = selectedBranchId || user?.branches[0]?.id;
    if (!branchId) return;

    const validItems = poForm.items.filter((i) => i.itemId && i.orderedQty > 0);
    if (validItems.length === 0) {
      setErrorMsg('Please select at least one item');
      return;
    }

    try {
      setIsSubmitting(true);
      await purchaseApi.createPurchaseOrder({
        branchId,
        supplierId: poForm.supplierId,
        deliveryDate: poForm.deliveryDate,
        taxAmount: Number(poForm.taxAmount),
        idempotencyKey: `IDEMP-PO-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        notes: poForm.notes,
        items: validItems
      });
      setSuccessMsg('Purchase Order generated successfully');
      setShowPOModal(false);
      loadTabData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to generate PO');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvoiceFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setGrnForm((prev) => ({
        ...prev,
        invoiceAttachment: {
          fileName: file.name,
          fileType: file.type,
          fileBase64: base64,
          fileSize: file.size
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreateGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    const branchId = selectedBranchId || user?.branches[0]?.id;
    if (!branchId) return;

    const validItems = grnForm.items.filter((i) => i.itemId && i.acceptedQty > 0);
    if (validItems.length === 0) {
      setErrorMsg('Please add at least one accepted item');
      return;
    }

    try {
      await purchaseApi.createGoodsReceiveNote({
        branchId,
        warehouseId: grnForm.warehouseId,
        supplierId: grnForm.supplierId,
        poId: grnForm.poId || undefined,
        receiveDate: grnForm.receiveDate,
        invoiceNumber: grnForm.invoiceNumber,
        invoiceDate: grnForm.invoiceDate,
        invoiceAmount: Number(grnForm.invoiceAmount),
        taxAmount: Number(grnForm.taxAmount),
        freightAmount: Number(grnForm.freightAmount),
        allowPriceVariance: grnForm.allowPriceVariance,
        invoiceAttachment: grnForm.invoiceAttachment || undefined,
        notes: grnForm.notes,
        items: validItems.map((item) => ({
          itemId: item.itemId,
          receivedQty: Number(item.receivedQty),
          acceptedQty: Number(item.acceptedQty),
          rejectedQty: Number(item.receivedQty) - Number(item.acceptedQty),
          unitPrice: Number(item.unitPrice),
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate || undefined
        }))
      });
      setSuccessMsg('Goods Receipt Note processed & Inventory ledger updated!');
      setShowGRNModal(false);
      loadTabData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to process GRN');
    }
  };

  const handleApproveVariance = async (grnId: string) => {
    try {
      await purchaseApi.approveGoodsReceiveVariance(grnId);
      setSuccessMsg('Price variance approved and stock ledger posted');
      setSelectedGRNDetails(null);
      loadTabData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to approve variance');
    }
  };

  const handleRejectVariance = async (grnId: string) => {
    try {
      await purchaseApi.rejectGoodsReceiveVariance(grnId, 'Price variance exceeded acceptable limit');
      setSuccessMsg('GRN rejected due to excessive price variance');
      setSelectedGRNDetails(null);
      loadTabData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to reject GRN');
    }
  };

  const handleViewSupplierLedger = async (sup: Supplier) => {
    try {
      const res = await purchaseApi.getSupplierLedger(sup.id);
      setSelectedSupplierLedger({ supplier: sup, entries: res.entries });
      setShowLedgerModal(true);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to load vendor statement');
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await purchaseApi.createSupplier(supplierForm);
      setSuccessMsg('Vendor registered successfully');
      setShowSupplierModal(false);
      setSupplierForm({
        name: '',
        code: `SUP-${Math.floor(100 + Math.random() * 900)}`,
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        taxNumber: '',
        paymentTerms: 'NET_30'
      });
      loadTabData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to create vendor');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <span className="p-2 bg-[#d4a437]/10 border border-[#d4a437]/20 rounded-xl text-[#d4a437]">
                <ShoppingCart className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-white tracking-tight">Procurement & Supplier Management</h1>
            </div>
            <p className="text-xs text-neutral-400">
              PR Requisitions, RFQ Comparisons, 3-Way Match GRN Inward & Quality Control Inspections
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {activeTab === 'requests' && (
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setShowRequestModal(true)}
                className="bg-[#d4a437] hover:bg-[#b88c2a] text-black font-semibold"
              >
                New Purchase Request
              </Button>
            )}
            {activeTab === 'orders' && (
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setShowPOModal(true)}
                className="bg-[#d4a437] hover:bg-[#b88c2a] text-black font-semibold"
              >
                New Purchase Order
              </Button>
            )}
            {activeTab === 'grn' && (
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setShowGRNModal(true)}
                className="bg-[#d4a437] hover:bg-[#b88c2a] text-black font-semibold"
              >
                Receive Goods (GRN)
              </Button>
            )}
            {activeTab === 'suppliers' && (
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setShowSupplierModal(true)}
                className="bg-[#d4a437] hover:bg-[#b88c2a] text-black font-semibold"
              >
                Add Vendor Master
              </Button>
            )}
          </div>
        </div>

        {/* Pipeline Step Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-white/[0.08] text-xs mt-4">
          <div className="bg-[#0c0c0e] p-2.5 rounded-xl border border-white/[0.06] flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-[#d4a437]/20 text-[#d4a437] font-bold flex items-center justify-center text-[10px]">1</span>
            <span className="text-neutral-300 font-semibold truncate">Requisition (PR)</span>
          </div>
          <div className="bg-[#0c0c0e] p-2.5 rounded-xl border border-white/[0.06] flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-[#e5a33d]/20 text-[#e5a33d] font-bold flex items-center justify-center text-[10px]">2</span>
            <span className="text-neutral-300 font-semibold truncate">Manager Approval</span>
          </div>
          <div className="bg-[#0c0c0e] p-2.5 rounded-xl border border-white/[0.06] flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-[#4d9de5]/20 text-[#4d9de5] font-bold flex items-center justify-center text-[10px]">3</span>
            <span className="text-neutral-300 font-semibold truncate">Purchase Order (PO)</span>
          </div>
          <div className="bg-[#0c0c0e] p-2.5 rounded-xl border border-white/[0.06] flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-[#3fbf6f]/20 text-[#3fbf6f] font-bold flex items-center justify-center text-[10px]">4</span>
            <span className="text-neutral-300 font-semibold truncate">3-Way Match & QC</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="bg-[#e5544d]/10 border border-[#e5544d]/20 rounded-2xl p-4 text-xs text-[#e5544d] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="bg-[#3fbf6f]/10 border border-[#3fbf6f]/20 rounded-2xl p-4 text-xs text-[#3fbf6f] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex items-center space-x-2 border-b border-white/[0.08] overflow-x-auto pb-1 text-xs font-semibold scrollbar-none">
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'requests'
              ? 'bg-[#d4a437] text-black shadow-lg font-bold'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Purchase Requests ({requests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'orders'
              ? 'bg-[#d4a437] text-black shadow-lg font-bold'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Purchase Orders ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('grn')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'grn'
              ? 'bg-[#d4a437] text-black shadow-lg font-bold'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>Goods Receive & 3-Way Match ({grns.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'suppliers'
              ? 'bg-[#d4a437] text-black shadow-lg font-bold'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Vendors & Statements ({suppliers.length})</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: PURCHASE REQUESTS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'requests' && (
        <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-white/[0.03] text-neutral-400 font-semibold border-b border-white/[0.08] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">PR Number</th>
                  <th className="p-4">Branch</th>
                  <th className="p-4">Requester</th>
                  <th className="p-4">Required Date</th>
                  <th className="p-4 text-center">Priority</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4">Items</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-neutral-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#d4a437]" />
                      Loading purchase requests...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-neutral-500">No purchase requests submitted.</td>
                  </tr>
                ) : (
                  requests.map((pr) => (
                    <tr key={pr.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-mono font-bold text-[#d4a437] text-sm">{pr.requestNumber}</td>
                      <td className="p-4 text-neutral-300">{pr.branch.name}</td>
                      <td className="p-4">
                        <p className="font-semibold text-white">{pr.requestedBy.firstName} {pr.requestedBy.lastName}</p>
                        <p className="text-[10px] text-neutral-400">{pr.requestedBy.email}</p>
                      </td>
                      <td className="p-4 font-mono text-neutral-300">{formatDateIN(pr.requiredDate)}</td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            pr.priority === 'URGENT' ? 'bg-[#e5544d]/20 text-[#e5544d] border border-[#e5544d]/30' :
                            pr.priority === 'HIGH' ? 'bg-[#e5a33d]/20 text-[#e5a33d] border border-[#e5a33d]/30' :
                            'bg-white/[0.06] text-neutral-300'
                          }`}
                        >
                          {pr.priority}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            pr.status === 'APPROVED' || pr.status === 'ORDERED' ? 'bg-[#3fbf6f]/20 text-[#3fbf6f] border border-[#3fbf6f]/30' :
                            pr.status === 'PENDING_APPROVAL' ? 'bg-[#e5a33d]/20 text-[#e5a33d] border border-[#e5a33d]/30' :
                            'bg-[#e5544d]/20 text-[#e5544d]'
                          }`}
                        >
                          {pr.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-neutral-200">{pr.items?.length || 0} items</td>
                      <td className="p-4 text-center">
                        {pr.status === 'PENDING_APPROVAL' ? (
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => { setSelectedPR(pr); setShowApproveModal(true); }}
                              className="px-2.5 py-1 bg-[#3fbf6f] hover:bg-[#349c5a] text-black font-bold rounded-lg text-[11px]"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => { setSelectedPR(pr); setShowRejectModal(true); }}
                              className="px-2.5 py-1 bg-[#e5544d]/20 hover:bg-[#e5544d]/30 text-[#e5544d] border border-[#e5544d]/40 rounded-lg text-[11px] font-semibold"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-neutral-500">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: PURCHASE ORDERS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'orders' && (
        <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-white/[0.03] text-neutral-400 font-semibold border-b border-white/[0.08] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">PO Number</th>
                  <th className="p-4">Vendor</th>
                  <th className="p-4">Branch</th>
                  <th className="p-4">Issue Date</th>
                  <th className="p-4">Expected Delivery</th>
                  <th className="p-4 text-right">Grand Total</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-neutral-500">No purchase orders created yet.</td>
                  </tr>
                ) : (
                  orders.map((po) => (
                    <tr key={po.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-mono font-bold text-[#d4a437] text-sm">{po.poNumber}</td>
                      <td className="p-4">
                        <p className="font-bold text-white">{po.supplier.name}</p>
                        <p className="text-[10px] text-neutral-400 font-mono">{po.supplier.code}</p>
                      </td>
                      <td className="p-4 text-neutral-300">{po.branch.name}</td>
                      <td className="p-4 font-mono text-neutral-300">{formatDateIN(po.issueDate)}</td>
                      <td className="p-4 font-mono text-neutral-400">{po.deliveryDate ? formatDateIN(po.deliveryDate) : 'N/A'}</td>
                      <td className="p-4 text-right font-mono font-bold text-[#3fbf6f] text-sm">
                        {formatINR(po.grandTotal)}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            po.status === 'RECEIVED' ? 'bg-[#3fbf6f]/20 text-[#3fbf6f] border border-[#3fbf6f]/30' :
                            po.status === 'PARTIALLY_RECEIVED' ? 'bg-[#e5a33d]/20 text-[#e5a33d] border border-[#e5a33d]/30' :
                            po.status === 'ISSUED' ? 'bg-[#4d9de5]/20 text-[#4d9de5] border border-[#4d9de5]/30' :
                            'bg-white/[0.06] text-neutral-300'
                          }`}
                        >
                          {po.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => { setSelectedPO(po); }}
                          className="px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200 border border-white/[0.08] rounded-lg text-[11px] flex items-center space-x-1 mx-auto"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#d4a437]" />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: GOODS RECEIVE NOTES (GRN) & 3-WAY MATCH */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'grn' && (
        <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between">
            <h3 className="font-bold text-white text-sm flex items-center space-x-2">
              <PackageCheck className="w-4 h-4 text-[#3fbf6f]" />
              <span>Goods Receive Notes (GRN), 3-Way Match & QC Inward</span>
            </h3>
            <span className="text-xs text-neutral-400">Strict invoice match & perpetual ledger update enforced</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-white/[0.03] text-neutral-400 font-semibold border-b border-white/[0.08] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">GRN Number</th>
                  <th className="p-4">Receive Date</th>
                  <th className="p-4">Warehouse</th>
                  <th className="p-4">Vendor</th>
                  <th className="p-4">Invoice #</th>
                  <th className="p-4 text-right">Total Amount</th>
                  <th className="p-4 text-center">Status / QC</th>
                  <th className="p-4">Receiver</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {grns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-neutral-500">No goods receipt records found.</td>
                  </tr>
                ) : (
                  grns.map((grn) => (
                    <tr key={grn.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-mono font-bold text-[#d4a437] text-sm">{grn.grnNumber}</td>
                      <td className="p-4 font-mono text-neutral-300">{formatDateIN(grn.receiveDate)}</td>
                      <td className="p-4">
                        <p className="font-bold text-white">{grn.warehouse?.name}</p>
                        <p className="text-[10px] text-neutral-400 font-mono">{grn.warehouse?.code}</p>
                      </td>
                      <td className="p-4 text-neutral-300">{grn.supplier?.name}</td>
                      <td className="p-4 font-mono text-neutral-400">{grn.invoiceNumber || 'N/A'}</td>
                      <td className="p-4 text-right font-mono font-bold text-[#3fbf6f] text-sm">
                        {formatINR(grn.totalAmount)}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                            grn.status === 'QC_PASSED'
                              ? 'bg-[#3fbf6f]/20 text-[#3fbf6f] border border-[#3fbf6f]/30'
                              : grn.status === 'REJECTED'
                              ? 'bg-[#e5544d]/20 text-[#e5544d] border border-[#e5544d]/30'
                              : 'bg-[#e5a33d]/20 text-[#e5a33d] border border-[#e5a33d]/30'
                          }`}
                        >
                          {grn.notes?.includes('PENDING_VARIANCE_APPROVAL')
                            ? 'PENDING VARIANCE'
                            : grn.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-neutral-400">
                        {grn.receivedBy ? `${grn.receivedBy.firstName} ${grn.receivedBy.lastName}` : 'System'}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setSelectedGRNDetails(grn)}
                          className="px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200 border border-white/[0.08] rounded-lg text-[11px] flex items-center space-x-1 mx-auto"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-[#3fbf6f]" />
                          <span>3-Way / QC</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: VENDORS & FINANCIAL STATEMENTS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {suppliers.length === 0 ? (
            <div className="col-span-3 p-12 text-center text-neutral-500 bg-[#17171b] border border-white/[0.08] rounded-3xl">
              No registered suppliers yet. Add your first vendor master to begin.
            </div>
          ) : (
            suppliers.map((sup) => (
              <div key={sup.id} className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-5 space-y-4 shadow-2xl hover:border-[#d4a437]/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base">{sup.name}</h3>
                    <span className="font-mono bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08] text-xs text-[#d4a437]">
                      {sup.code}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-[#3fbf6f]/10 text-[#3fbf6f] border border-[#3fbf6f]/20 rounded text-[10px] font-bold">
                    {sup.paymentTerms || 'NET_30'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-neutral-400 border-t border-white/[0.06] pt-3">
                  <p><span className="text-neutral-500">Contact:</span> {sup.contactPerson || 'N/A'}</p>
                  <p><span className="text-neutral-500">Phone:</span> {sup.phone || 'N/A'}</p>
                  <p><span className="text-neutral-500">Email:</span> {sup.email || 'N/A'}</p>
                  <p><span className="text-neutral-500">GSTIN / Tax:</span> <span className="font-mono text-neutral-300">{sup.taxNumber || 'Unregistered'}</span></p>
                  <p><span className="text-neutral-500">Address:</span> {sup.address || 'N/A'}</p>
                </div>

                <div className="bg-[#0c0c0e] p-3 rounded-2xl border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-neutral-400 uppercase font-semibold">Payables Outstanding</p>
                    <p className="text-base font-bold font-mono text-[#e5a33d]">{formatINR(sup.balance)}</p>
                  </div>
                  <button
                    onClick={() => handleViewSupplierLedger(sup)}
                    className="px-3 py-1.5 bg-white/[0.06] hover:bg-[#d4a437] hover:text-black text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    Statement
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CREATE PURCHASE REQUEST */}
      {/* ------------------------------------------------------------- */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-4">
              <h3 className="text-lg font-bold text-white">Create Purchase Requisition (PR)</h3>
              <button onClick={() => setShowRequestModal(false)}><X className="w-5 h-5 text-neutral-400 hover:text-white" /></button>
            </div>

            <form onSubmit={handleCreatePR} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Required By Date"
                  type="date"
                  value={prForm.requiredDate}
                  onChange={(e) => setPrForm({ ...prForm, requiredDate: e.target.value })}
                  required
                />
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">Priority</label>
                  <select
                    value={prForm.priority}
                    onChange={(e) => setPrForm({ ...prForm, priority: e.target.value as PRPriority })}
                    className="w-full bg-[#0c0c0e] border border-white/[0.1] text-white text-xs rounded-xl px-3 py-2.5 focus:border-[#d4a437] outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Request Items</span>
                  <button
                    type="button"
                    onClick={() => setPrForm({ ...prForm, items: [...prForm.items, { itemId: '', requestedQty: 10, estimatedPrice: 0, notes: '' }] })}
                    className="text-xs text-[#d4a437] hover:underline font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {prForm.items.map((line, idx) => (
                  <div key={idx} className="flex items-center space-x-2 bg-[#0c0c0e] p-2.5 rounded-xl border border-white/[0.06]">
                    <select
                      value={line.itemId}
                      onChange={(e) => {
                        const copy = [...prForm.items];
                        copy[idx].itemId = e.target.value;
                        const it = items.find((i) => i.id === e.target.value);
                        if (it) copy[idx].estimatedPrice = Number(it.costPrice);
                        setPrForm({ ...prForm, items: copy });
                      }}
                      required
                      className="flex-1 bg-[#17171b] border border-white/[0.1] text-white text-xs rounded-lg px-2.5 py-1.5 focus:border-[#d4a437] outline-none"
                    >
                      <option value="">Select Raw Material / Supply</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} ({it.code})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="Qty"
                      value={line.requestedQty}
                      onChange={(e) => {
                        const copy = [...prForm.items];
                        copy[idx].requestedQty = parseFloat(e.target.value) || 0;
                        setPrForm({ ...prForm, items: copy });
                      }}
                      required
                      className="w-24 bg-[#17171b] border border-white/[0.1] text-white text-xs rounded-lg px-2 py-1.5 font-mono text-right"
                    />

                    {prForm.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPrForm({ ...prForm, items: prForm.items.filter((_, i) => i !== idx) })}
                        className="p-1 text-neutral-500 hover:text-[#e5544d]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <Input
                label="Notes / Business Justification"
                value={prForm.notes}
                onChange={(e) => setPrForm({ ...prForm, notes: e.target.value })}
                placeholder="e.g. Banquet hall catering provisioning"
              />

              <div className="flex justify-end space-x-3 pt-4 border-t border-white/[0.08]">
                <Button type="button" variant="ghost" onClick={() => setShowRequestModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" className="bg-[#d4a437] hover:bg-[#b88c2a] text-black font-semibold">Submit Requisition</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: DIRECT NEW PURCHASE ORDER */}
      {/* ------------------------------------------------------------- */}
      {showPOModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-4">
              <h3 className="text-lg font-bold text-white">Create Purchase Order (PO)</h3>
              <button onClick={() => setShowPOModal(false)}><X className="w-5 h-5 text-neutral-400 hover:text-white" /></button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Vendor
                  </label>
                  <select
                    value={poForm.supplierId}
                    onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}
                    required
                    className="w-full bg-[#0c0c0e] border border-white/[0.1] text-white text-xs rounded-xl px-3 py-2.5 focus:border-[#d4a437] outline-none"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Expected Delivery Date"
                  type="date"
                  value={poForm.deliveryDate}
                  onChange={(e) => setPoForm({ ...poForm, deliveryDate: e.target.value })}
                  required
                />
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Order Line Items</span>
                  <button
                    type="button"
                    onClick={() => setPoForm({ ...poForm, items: [...poForm.items, { itemId: '', orderedQty: 10, unitPrice: 0, notes: '' }] })}
                    className="text-xs text-[#d4a437] hover:underline font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {poForm.items.map((line, idx) => (
                  <div key={idx} className="flex items-center space-x-2 bg-[#0c0c0e] p-2.5 rounded-xl border border-white/[0.06]">
                    <select
                      value={line.itemId}
                      onChange={(e) => {
                        const copy = [...poForm.items];
                        copy[idx].itemId = e.target.value;
                        const it = items.find((i) => i.id === e.target.value);
                        if (it) copy[idx].unitPrice = Number(it.costPrice);
                        setPoForm({ ...poForm, items: copy });
                      }}
                      required
                      className="flex-1 bg-[#17171b] border border-white/[0.1] text-white text-xs rounded-lg px-2.5 py-1.5 focus:border-[#d4a437] outline-none"
                    >
                      <option value="">Select Item</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} ({it.code})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="Qty"
                      value={line.orderedQty}
                      onChange={(e) => {
                        const copy = [...poForm.items];
                        copy[idx].orderedQty = parseFloat(e.target.value) || 0;
                        setPoForm({ ...poForm, items: copy });
                      }}
                      required
                      className="w-24 bg-[#17171b] border border-white/[0.1] text-white text-xs rounded-lg px-2 py-1.5 font-mono text-right"
                    />

                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="Unit Price (₹)"
                      value={line.unitPrice}
                      onChange={(e) => {
                        const copy = [...poForm.items];
                        copy[idx].unitPrice = parseFloat(e.target.value) || 0;
                        setPoForm({ ...poForm, items: copy });
                      }}
                      required
                      className="w-28 bg-[#17171b] border border-white/[0.1] text-white text-xs rounded-lg px-2 py-1.5 font-mono text-right text-[#3fbf6f]"
                    />

                    {poForm.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPoForm({ ...poForm, items: poForm.items.filter((_, i) => i !== idx) })}
                        className="p-1 text-neutral-500 hover:text-[#e5544d]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <Input
                label="Delivery Instructions"
                value={poForm.notes}
                onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                placeholder="e.g. Direct inward delivery to Central Warehouse receiving dock"
              />

              <div className="flex justify-end space-x-3 pt-4 border-t border-white/[0.08]">
                <Button type="button" variant="ghost" onClick={() => setShowPOModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" className="bg-[#d4a437] hover:bg-[#b88c2a] text-black font-semibold">Issue Purchase Order</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: VIEW PO DETAILS */}
      {/* ------------------------------------------------------------- */}
      {selectedPO && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div>
                <h3 className="text-base font-bold text-white">Purchase Order: {selectedPO.poNumber}</h3>
                <p className="text-xs text-neutral-400">Vendor: {selectedPO.supplier.name} | Status: {selectedPO.status}</p>
              </div>
              <button onClick={() => setSelectedPO(null)}><X className="w-5 h-5 text-neutral-400 hover:text-white" /></button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-white/[0.03] text-neutral-400 font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="p-3">Item</th>
                    <th className="p-3 text-right">Ordered</th>
                    <th className="p-3 text-right">Received</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Total Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] font-mono">
                  {selectedPO.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="p-3 font-sans text-white font-medium">{item.item.name}</td>
                      <td className="p-3 text-right text-neutral-200">{Number(item.orderedQty)} {item.item.unit?.symbol}</td>
                      <td className="p-3 text-right text-[#3fbf6f]">{Number(item.receivedQty)} {item.item.unit?.symbol}</td>
                      <td className="p-3 text-right text-neutral-300">{formatINR(item.unitPrice)}</td>
                      <td className="p-3 text-right font-bold text-[#d4a437]">{formatINR(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3 border-t border-white/[0.08]">
              <Button variant="outline" size="sm" onClick={() => setSelectedPO(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: VIEW GRN DETAILS & 3-WAY MATCH INSPECTION */}
      {/* ------------------------------------------------------------- */}
      {selectedGRNDetails && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>Goods Receive Note: {selectedGRNDetails.grnNumber}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedGRNDetails.status === 'QC_PASSED'
                        ? 'bg-[#3fbf6f]/20 text-[#3fbf6f] border border-[#3fbf6f]/30'
                        : selectedGRNDetails.status === 'REJECTED'
                        ? 'bg-[#e5544d]/20 text-[#e5544d] border border-[#e5544d]/30'
                        : 'bg-[#e5a33d]/20 text-[#e5a33d] border border-[#e5a33d]/30'
                    }`}
                  >
                    {selectedGRNDetails.notes?.includes('PENDING_VARIANCE_APPROVAL')
                      ? 'PENDING VARIANCE APPROVAL'
                      : selectedGRNDetails.status.replace('_', ' ')}
                  </span>
                </h3>
                <p className="text-xs text-neutral-400">
                  PO: {selectedGRNDetails.po?.poNumber || 'Direct GRN'} | Vendor: {selectedGRNDetails.supplier?.name} | Outlet: {selectedGRNDetails.branch?.name || selectedBranchId || 'Central Resort Store'}
                </p>
              </div>
              <button onClick={() => setSelectedGRNDetails(null)}><X className="w-5 h-5 text-neutral-400 hover:text-white" /></button>
            </div>

            {/* Financial & 3-Way Match Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0c0c0e] p-4 rounded-2xl border border-white/[0.06]">
              <div>
                <p className="text-[10px] uppercase font-bold text-neutral-400">PO Expected Amount</p>
                <p className="text-sm font-mono font-bold text-white">{formatINR(selectedGRNDetails.po?.totalAmount || selectedGRNDetails.totalAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-neutral-400">Claimed Invoice Amount</p>
                <p className="text-sm font-mono font-bold text-[#3fbf6f]">{formatINR(selectedGRNDetails.totalAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-neutral-400">Invoice Number</p>
                <p className="text-sm font-mono text-neutral-200">{selectedGRNDetails.invoiceNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-neutral-400">Warehouse</p>
                <p className="text-sm text-neutral-200">{selectedGRNDetails.warehouse?.name || 'Inward Store'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-neutral-400">Receive Date</p>
                <p className="text-xs font-mono text-neutral-300">{formatDateIN(selectedGRNDetails.receiveDate)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-neutral-400">Authorized Receiver</p>
                <p className="text-xs text-neutral-300">{selectedGRNDetails.receivedBy ? `${selectedGRNDetails.receivedBy.firstName} ${selectedGRNDetails.receivedBy.lastName}` : 'Authorized Receiver'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] uppercase font-bold text-neutral-400">3-Way Verification Notes</p>
                <p className="text-xs text-neutral-300 italic">{selectedGRNDetails.notes || 'Normal stock verification completed'}</p>
              </div>
            </div>

            {/* GRN Line Items & Quality Control */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Line Items & Quality Inspection</span>
              <div className="overflow-x-auto border border-white/[0.08] rounded-2xl">
                <table className="w-full text-left text-xs text-neutral-300">
                  <thead className="bg-white/[0.03] text-neutral-400 font-semibold border-b border-white/[0.08] text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Item</th>
                      <th className="p-3 text-right">Received</th>
                      <th className="p-3 text-right">Accepted</th>
                      <th className="p-3 text-right">Rejected</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-center">Batch / Expiry</th>
                      <th className="p-3 text-center">QC Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] font-mono">
                    {selectedGRNDetails.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="p-3 font-sans text-white font-medium">{item.item?.name || 'Raw Material'}</td>
                        <td className="p-3 text-right text-neutral-200">{Number(item.receivedQty)} {item.item?.unit?.symbol}</td>
                        <td className="p-3 text-right text-[#3fbf6f] font-bold">{Number(item.acceptedQty)} {item.item?.unit?.symbol}</td>
                        <td className="p-3 text-right text-[#e5544d]">{Number(item.rejectedQty || 0)} {item.item?.unit?.symbol}</td>
                        <td className="p-3 text-right text-neutral-200">{formatINR(item.unitPrice)}</td>
                        <td className="p-3 text-center text-neutral-400 text-[11px]">
                          {item.batchNumber || 'N/A'} {item.expiryDate ? `(${formatDateIN(item.expiryDate)})` : ''}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.qcStatus === 'PASSED'
                                ? 'bg-[#3fbf6f]/20 text-[#3fbf6f]'
                                : 'bg-[#e5544d]/20 text-[#e5544d]'
                            }`}
                          >
                            {item.qcStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions for Variance Approval */}
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.08]">
              {selectedGRNDetails.status === 'RECEIVED' ? (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleApproveVariance(selectedGRNDetails.id)}
                    className="bg-[#3fbf6f] text-black font-semibold"
                  >
                    Approve Variance & Post Stock
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleRejectVariance(selectedGRNDetails.id)}
                  >
                    Reject Variance
                  </Button>
                </div>
              ) : (
                <div />
              )}
              <Button variant="outline" size="sm" onClick={() => setSelectedGRNDetails(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: APPROVE PR & CREATE PO */}
      {/* ------------------------------------------------------------- */}
      {showApproveModal && selectedPR && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Approve Purchase Request</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Requisition <span className="font-mono font-bold text-[#d4a437]">{selectedPR.requestNumber}</span> ({selectedPR.items?.length} items)
            </p>

            <div className="space-y-4">
              <label className="flex items-center space-x-2 cursor-pointer text-xs font-semibold text-neutral-300">
                <input
                  type="checkbox"
                  checked={approveForm.autoCreatePO}
                  onChange={(e) => setApproveForm({ ...approveForm, autoCreatePO: e.target.checked })}
                  className="rounded border-white/20 bg-[#0c0c0e] text-[#d4a437]"
                />
                <span>Automatically issue Purchase Order (PO) to Vendor</span>
              </label>

              {approveForm.autoCreatePO && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Assign Vendor
                  </label>
                  <select
                    value={approveForm.supplierId}
                    onChange={(e) => setApproveForm({ ...approveForm, supplierId: e.target.value })}
                    required
                    className="w-full bg-[#0c0c0e] border border-white/[0.1] text-white text-xs rounded-xl px-3 py-2.5 focus:border-[#d4a437] outline-none"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-white/[0.08]">
                <Button variant="ghost" onClick={() => setShowApproveModal(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleApprovePR} className="bg-[#3fbf6f] text-black font-semibold">Confirm Approval</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: REJECT PR */}
      {/* ------------------------------------------------------------- */}
      {showRejectModal && selectedPR && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Reject Purchase Request</h3>
            <p className="text-xs text-neutral-400 mb-4">Request: {selectedPR.requestNumber}</p>
            <div className="space-y-4">
              <Input
                label="Rejection Reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Budget ceiling reached or duplicate requisition"
                required
              />
              <div className="flex justify-end space-x-3 pt-2">
                <Button variant="ghost" onClick={() => setShowRejectModal(false)}>Cancel</Button>
                <Button variant="danger" onClick={handleRejectPR}>Reject Request</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: GOODS RECEIPT (GRN) */}
      {/* ------------------------------------------------------------- */}
      {showGRNModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Receive Goods Note (GRN)</h3>
                <p className="text-xs text-neutral-400">Posts to Stock Ledger, updates Stock Balances, and records AP Entry</p>
              </div>
              <button onClick={() => setShowGRNModal(false)}><X className="w-5 h-5 text-neutral-400 hover:text-white" /></button>
            </div>

            <form onSubmit={handleCreateGRN} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">Receiving Store</label>
                  <select
                    value={grnForm.warehouseId}
                    onChange={(e) => setGrnForm({ ...grnForm, warehouseId: e.target.value })}
                    required
                    className="w-full bg-[#0c0c0e] border border-white/[0.1] text-white text-xs rounded-xl px-3 py-2 focus:border-[#d4a437] outline-none"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">Vendor</label>
                  <select
                    value={grnForm.supplierId}
                    onChange={(e) => setGrnForm({ ...grnForm, supplierId: e.target.value })}
                    required
                    className="w-full bg-[#0c0c0e] border border-white/[0.1] text-white text-xs rounded-xl px-3 py-2 focus:border-[#d4a437] outline-none"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Vendor Invoice #"
                  value={grnForm.invoiceNumber}
                  onChange={(e) => setGrnForm({ ...grnForm, invoiceNumber: e.target.value })}
                  placeholder="e.g. INV-2026-8801"
                />
              </div>

              {/* Invoice Financial Details & Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06]">
                <Input
                  label="Invoice Date"
                  type="date"
                  value={grnForm.invoiceDate || grnForm.receiveDate}
                  onChange={(e) => setGrnForm({ ...grnForm, invoiceDate: e.target.value })}
                />
                <Input
                  label="Claimed Amount (₹)"
                  type="number"
                  min="0"
                  step="any"
                  value={grnForm.invoiceAmount || ''}
                  onChange={(e) => setGrnForm({ ...grnForm, invoiceAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g. 15000"
                />
                <Input
                  label="Tax / GST (₹)"
                  type="number"
                  min="0"
                  step="any"
                  value={grnForm.taxAmount || ''}
                  onChange={(e) => setGrnForm({ ...grnForm, taxAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g. 1800"
                />
              </div>

              {/* Invoice Evidence Attachment */}
              <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">Invoice Document / Receipt Photo</p>
                    <p className="text-[11px] text-neutral-400">Attach photo via Camera or upload PDF/Image for 3-way match validation</p>
                  </div>
                  {grnForm.invoiceAttachment && (
                    <span className="text-[10px] font-mono bg-[#3fbf6f]/20 text-[#3fbf6f] border border-[#3fbf6f]/30 px-2 py-0.5 rounded-full">
                      ✓ Attached: {grnForm.invoiceAttachment.fileName} ({Math.round(grnForm.invoiceAttachment.fileSize / 1024)} KB)
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-3 pt-1">
                  <label className="cursor-pointer inline-flex items-center space-x-2 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.1] rounded-xl text-xs font-semibold transition-colors">
                    <Camera className="w-4 h-4 text-[#d4a437]" />
                    <span>Take Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleInvoiceFileUpload}
                    />
                  </label>

                  <label className="cursor-pointer inline-flex items-center space-x-2 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.1] rounded-xl text-xs font-semibold transition-colors">
                    <Upload className="w-4 h-4 text-[#3fbf6f]" />
                    <span>Upload Document</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={handleInvoiceFileUpload}
                    />
                  </label>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Received Line Items</span>
                  <button
                    type="button"
                    onClick={() => setGrnForm({
                      ...grnForm,
                      items: [...grnForm.items, { itemId: '', receivedQty: 10, acceptedQty: 10, unitPrice: 0, batchNumber: `BAT-${Math.floor(1000 + Math.random() * 9000)}`, expiryDate: '' }]
                    })}
                    className="text-xs text-[#d4a437] hover:underline font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {grnForm.items.map((line, idx) => (
                  <div key={idx} className="p-3 bg-[#0c0c0e] rounded-2xl border border-white/[0.06] space-y-2">
                    <div className="flex items-center space-x-2">
                      <select
                        value={line.itemId}
                        onChange={(e) => {
                          const copy = [...grnForm.items];
                          copy[idx].itemId = e.target.value;
                          const it = items.find((i) => i.id === e.target.value);
                          if (it) copy[idx].unitPrice = Number(it.costPrice);
                          setGrnForm({ ...grnForm, items: copy });
                        }}
                        required
                        className="flex-1 bg-[#17171b] border border-white/[0.1] text-white text-xs rounded-lg px-2.5 py-1.5 focus:border-[#d4a437] outline-none"
                      >
                        <option value="">Select Item</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>{it.name} ({it.code})</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        placeholder="Accepted Qty"
                        value={line.acceptedQty}
                        onChange={(e) => {
                          const copy = [...grnForm.items];
                          copy[idx].acceptedQty = parseFloat(e.target.value) || 0;
                          copy[idx].receivedQty = parseFloat(e.target.value) || 0;
                          setGrnForm({ ...grnForm, items: copy });
                        }}
                        required
                        className="w-28 bg-[#17171b] border border-white/[0.1] text-white text-xs rounded-lg px-2 py-1.5 font-mono text-right"
                      />

                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        placeholder="Unit Price (₹)"
                        value={line.unitPrice}
                        onChange={(e) => {
                          const copy = [...grnForm.items];
                          copy[idx].unitPrice = parseFloat(e.target.value) || 0;
                          setGrnForm({ ...grnForm, items: copy });
                        }}
                        required
                        className="w-28 bg-[#17171b] border border-white/[0.1] text-white text-xs rounded-lg px-2 py-1.5 font-mono text-right text-[#3fbf6f]"
                      />

                      {grnForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setGrnForm({ ...grnForm, items: grnForm.items.filter((_, i) => i !== idx) })}
                          className="p-1 text-neutral-500 hover:text-[#e5544d]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-white/[0.08]">
                <Button type="button" variant="ghost" onClick={() => setShowGRNModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" className="bg-[#d4a437] hover:bg-[#b88c2a] text-black font-semibold">Confirm Receipt & Post Stock</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: VENDOR LEDGER STATEMENT */}
      {/* ------------------------------------------------------------- */}
      {showLedgerModal && selectedSupplierLedger && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div>
                <h3 className="text-base font-bold text-white">{selectedSupplierLedger.supplier.name}</h3>
                <p className="text-xs text-neutral-400">Vendor Statement & Accounts Payable Ledger</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-neutral-400 uppercase font-semibold">Total Payable</p>
                <p className="text-lg font-bold font-mono text-[#e5a33d]">
                  {formatINR(selectedSupplierLedger.supplier.balance)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-white/[0.03] text-neutral-400 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Reference</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Debit (₹)</th>
                    <th className="p-3 text-right">Credit (₹)</th>
                    <th className="p-3 text-right">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] font-mono">
                  {selectedSupplierLedger.entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-neutral-500 font-sans">No transactions recorded for this vendor.</td>
                    </tr>
                  ) : (
                    selectedSupplierLedger.entries.map((ent) => (
                      <tr key={ent.id} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-sans text-neutral-400">{formatDateIN(ent.createdAt)}</td>
                        <td className="p-3 text-[#d4a437]">{ent.referenceId || ent.referenceType}</td>
                        <td className="p-3 text-neutral-400 font-sans">{ent.description || '-'}</td>
                        <td className="p-3 text-right text-[#3fbf6f]">{Number(ent.debit) > 0 ? formatINR(ent.debit) : '-'}</td>
                        <td className="p-3 text-right text-[#e5544d]">{Number(ent.credit) > 0 ? formatINR(ent.credit) : '-'}</td>
                        <td className="p-3 text-right font-bold text-white">{formatINR(ent.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3 border-t border-white/[0.08]">
              <Button variant="outline" size="sm" onClick={() => setShowLedgerModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CREATE SUPPLIER */}
      {/* ------------------------------------------------------------- */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
              <h3 className="text-base font-bold text-white">Register Vendor Master</h3>
              <button onClick={() => setShowSupplierModal(false)}><X className="w-5 h-5 text-neutral-400 hover:text-white" /></button>
            </div>
            <form onSubmit={handleCreateSupplier} className="space-y-4">
              <Input
                label="Vendor Enterprise Name"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                placeholder="e.g. Royal Organic Spice Suppliers Ltd"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Vendor Code"
                  value={supplierForm.code}
                  onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })}
                  placeholder="SUP-001"
                  required
                />
                <Input
                  label="Contact Person"
                  value={supplierForm.contactPerson}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                  placeholder="Harish Mehta"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Email"
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  placeholder="orders@supplier.com"
                />
                <Input
                  label="Phone"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  placeholder="+91 98200 44556"
                />
              </div>
              <Input
                label="GSTIN / Tax Registration"
                value={supplierForm.taxNumber}
                onChange={(e) => setSupplierForm({ ...supplierForm, taxNumber: e.target.value })}
                placeholder="GSTIN27AABCU9603R1ZM"
              />
              <Input
                label="Registered Business Address"
                value={supplierForm.address}
                onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                placeholder="Plot 45, Industrial Estate, Sector 3"
              />
              <div className="flex justify-end space-x-3 pt-3 border-t border-white/[0.08]">
                <Button type="button" variant="ghost" onClick={() => setShowSupplierModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" className="bg-[#d4a437] hover:bg-[#b88c2a] text-black font-semibold">Save Vendor Master</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchasingPage;
