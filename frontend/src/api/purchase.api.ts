import { apiClient } from './axios';
import {
  Supplier,
  SupplierLedgerEntry,
  PurchaseRequest,
  PurchaseOrder,
  GoodsReceiveNote,
  PRStatus,
  POStatus
} from '../types/purchase.types';

export const purchaseApi = {
  // Suppliers
  getSuppliers: async (params?: {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ suppliers: Supplier[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    const res = await apiClient.get('/purchasing/suppliers', { params });
    return { suppliers: res.data.data, pagination: res.data.meta };
  },
  createSupplier: async (data: Partial<Supplier>): Promise<Supplier> => {
    const res = await apiClient.post('/purchasing/suppliers', data);
    return res.data.data;
  },
  updateSupplier: async (id: string, data: Partial<Supplier>): Promise<Supplier> => {
    const res = await apiClient.put(`/purchasing/suppliers/${id}`, data);
    return res.data.data;
  },
  getSupplierLedger: async (
    supplierId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{ supplier: Supplier; entries: SupplierLedgerEntry[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    const res = await apiClient.get(`/purchasing/suppliers/${supplierId}/ledger`, { params });
    return {
      supplier: res.data.meta?.supplier,
      entries: res.data.data,
      pagination: res.data.meta
    };
  },

  // Purchase Requests
  getPurchaseRequests: async (params?: {
    branchId?: string;
    status?: PRStatus;
    page?: number;
    limit?: number;
  }): Promise<{ requests: PurchaseRequest[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    const res = await apiClient.get('/purchasing/requests', { params });
    return { requests: res.data.data, pagination: res.data.meta };
  },
  createPurchaseRequest: async (data: {
    branchId: string;
    requiredDate: string;
    priority?: string;
    notes?: string;
    items: Array<{ itemId: string; requestedQty: number; estimatedPrice?: number; notes?: string }>;
  }): Promise<PurchaseRequest> => {
    const res = await apiClient.post('/purchasing/requests', data);
    return res.data.data;
  },
  approvePurchaseRequest: async (
    id: string,
    data: { autoCreatePO?: boolean; supplierId?: string; notes?: string }
  ): Promise<{ purchaseRequest: PurchaseRequest; purchaseOrder?: PurchaseOrder }> => {
    const res = await apiClient.post(`/purchasing/requests/${id}/approve`, data);
    return res.data.data;
  },
  rejectPurchaseRequest: async (id: string, reason: string): Promise<PurchaseRequest> => {
    const res = await apiClient.post(`/purchasing/requests/${id}/reject`, { reason });
    return res.data.data;
  },

  // Purchase Orders
  getPurchaseOrders: async (params?: {
    branchId?: string;
    supplierId?: string;
    status?: POStatus;
    page?: number;
    limit?: number;
  }): Promise<{ orders: PurchaseOrder[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    const res = await apiClient.get('/purchasing/orders', { params });
    return { orders: res.data.data, pagination: res.data.meta };
  },
  getPurchaseOrderById: async (id: string): Promise<PurchaseOrder> => {
    const res = await apiClient.get(`/purchasing/orders/${id}`);
    return res.data.data;
  },
  createPurchaseOrder: async (data: {
    branchId: string;
    supplierId: string;
    requestId?: string | null;
    deliveryDate?: string;
    taxAmount?: number;
    notes?: string;
    status?: POStatus;
    idempotencyKey?: string;
    items: Array<{ itemId: string; orderedQty: number; unitPrice: number; notes?: string }>;
  }): Promise<PurchaseOrder> => {
    const res = await apiClient.post('/purchasing/orders', data);
    return res.data.data;
  },
  updatePurchaseOrder: async (
    id: string,
    data: {
      supplierId?: string;
      deliveryDate?: string;
      taxAmount?: number;
      notes?: string;
      items?: Array<{ itemId: string; orderedQty: number; unitPrice: number; notes?: string }>;
    }
  ): Promise<PurchaseOrder> => {
    const res = await apiClient.put(`/purchasing/orders/${id}`, data);
    return res.data.data;
  },
  updatePurchaseOrderStatus: async (id: string, data: { status: POStatus; reason?: string }): Promise<PurchaseOrder> => {
    const res = await apiClient.post(`/purchasing/orders/${id}/status`, data);
    return res.data.data;
  },

  // Goods Receive Notes
  getGoodsReceiveNotes: async (params?: {
    branchId?: string;
    warehouseId?: string;
    supplierId?: string;
    poId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ grns: GoodsReceiveNote[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    const res = await apiClient.get('/purchasing/grn', { params });
    return { grns: res.data.data, pagination: res.data.meta };
  },
  getGoodsReceiveNoteById: async (id: string): Promise<GoodsReceiveNote> => {
    const res = await apiClient.get(`/purchasing/grn/${id}`);
    return res.data.data;
  },
  createGoodsReceiveNote: async (data: {
    branchId: string;
    warehouseId: string;
    supplierId?: string;
    poId?: string | null;
    receiveDate?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    invoiceAmount?: number;
    taxAmount?: number;
    freightAmount?: number;
    allowPriceVariance?: boolean;
    idempotencyKey?: string;
    invoiceAttachment?: {
      fileName: string;
      fileType: string;
      fileBase64: string;
      fileSize?: number;
    };
    notes?: string;
    status?: string;
    items: Array<{
      poItemId?: string | null;
      itemId: string;
      receivedQty: number;
      acceptedQty: number;
      rejectedQty?: number;
      unitPrice: number;
      batchNumber?: string;
      expiryDate?: string;
      qcStatus?: string;
      qcNotes?: string;
    }>;
  }): Promise<GoodsReceiveNote> => {
    const res = await apiClient.post('/purchasing/grn', data);
    return res.data.data;
  },
  confirmGoodsReceiveNote: async (id: string): Promise<GoodsReceiveNote> => {
    const res = await apiClient.post(`/purchasing/grn/${id}/confirm`);
    return res.data.data;
  },
  approveGoodsReceiveVariance: async (id: string): Promise<GoodsReceiveNote> => {
    const res = await apiClient.post(`/purchasing/grn/${id}/approve-variance`);
    return res.data.data;
  },
  rejectGoodsReceiveVariance: async (id: string, reason?: string): Promise<GoodsReceiveNote> => {
    const res = await apiClient.post(`/purchasing/grn/${id}/reject-variance`, { reason });
    return res.data.data;
  },
  uploadSupplierInvoice: async (data: {
    branchId: string;
    warehouseId: string;
    supplierId: string;
    poId?: string | null;
    invoiceNumber: string;
    invoiceDate?: string;
    invoiceAmount: number;
    fileName: string;
    fileType: string;
    fileBase64: string;
  }) => {
    const res = await apiClient.post('/purchasing/invoices/upload', data);
    return res.data.data;
  }
};
