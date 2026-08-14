import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { PurchaseService } from '../services/purchase.service';
import { sendSuccess, AppError } from '../utils/response.utils';
import { prisma } from '../config/database';

const resolveCompanyId = async (req: AuthenticatedRequest): Promise<string> => {
  if (req.user?.companyId) return req.user.companyId;
  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new AppError('No active company found in system', 400);
  return company.id;
};

const getClientIp = (req: AuthenticatedRequest): string => {
  const xf = req.headers['x-forwarded-for'];
  if (Array.isArray(xf)) return xf[0] || '';
  if (typeof xf === 'string') return xf.split(',')[0].trim();
  return req.ip || '';
};

export class PurchaseController {
  // Suppliers
  public static async getSuppliers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { search, isActive, page, limit } = req.query;
      const result = await PurchaseService.getSuppliers(companyId, {
        search: search as string,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
      });
      return sendSuccess(res, result.suppliers, 'Suppliers retrieved', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  public static async createSupplier(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const supplier = await PurchaseService.createSupplier(
        companyId,
        req.body,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, supplier, 'Supplier created', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async updateSupplier(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const supplier = await PurchaseService.updateSupplier(
        companyId,
        id,
        req.body,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, supplier, 'Supplier updated');
    } catch (error) {
      next(error);
    }
  }

  public static async getSupplierLedger(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { page, limit } = req.query;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await PurchaseService.getSupplierLedger(companyId, id, {
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 30
      });
      return sendSuccess(res, result.entries, 'Supplier ledger retrieved', 200, {
        ...result.pagination,
        supplier: result.supplier
      });
    } catch (error) {
      next(error);
    }
  }

  // Purchase Requests
  public static async getPurchaseRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId, status, page, limit } = req.query;
      const result = await PurchaseService.getPurchaseRequests(companyId, {
        branchId: branchId as string,
        status: status as any,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
      });
      return sendSuccess(res, result.requests, 'Purchase requests retrieved', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  public static async createPurchaseRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const request = await PurchaseService.createPurchaseRequest(
        companyId,
        req.body.branchId,
        req.body,
        req.user!.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, request, 'Purchase request submitted', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async approvePurchaseRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await PurchaseService.approvePurchaseRequest(
        companyId,
        id,
        req.user!.userId,
        req.body,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, result, 'Purchase request approved');
    } catch (error) {
      next(error);
    }
  }

  public static async rejectPurchaseRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await PurchaseService.rejectPurchaseRequest(
        companyId,
        id,
        req.user!.userId,
        req.body.reason,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, result, 'Purchase request rejected');
    } catch (error) {
      next(error);
    }
  }

  // Purchase Orders
  public static async getPurchaseOrders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId, supplierId, status, page, limit } = req.query;
      const result = await PurchaseService.getPurchaseOrders(companyId, {
        branchId: branchId as string,
        supplierId: supplierId as string,
        status: status as any,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
      });
      return sendSuccess(res, result.orders, 'Purchase orders retrieved', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  public static async getPurchaseOrderById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const order = await PurchaseService.getPurchaseOrderById(companyId, id);
      return sendSuccess(res, order, 'Purchase order details');
    } catch (error) {
      next(error);
    }
  }

  public static async createPurchaseOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const isAdmin = req.user?.role?.toUpperCase().includes('ADMIN');
      const userBranchIds = isAdmin ? undefined : (req.user as any)?.branchIds;
      const po = await PurchaseService.createPurchaseOrder(
        companyId,
        req.body.branchId,
        req.body,
        req.user?.userId,
        userBranchIds,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, po, 'Purchase order created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async updatePurchaseOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const isAdmin = req.user?.role?.toUpperCase().includes('ADMIN');
      const userBranchIds = isAdmin ? undefined : (req.user as any)?.branchIds;
      const po = await PurchaseService.updatePurchaseOrder(
        companyId,
        id,
        req.body,
        req.user?.userId,
        userBranchIds,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, po, 'Draft Purchase Order updated successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async updatePurchaseOrderStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const isAdmin = req.user?.role?.toUpperCase().includes('ADMIN');
      const userBranchIds = isAdmin ? undefined : (req.user as any)?.branchIds;
      const po = await PurchaseService.updatePurchaseOrderStatus(
        companyId,
        id,
        req.body.status,
        req.body.reason,
        req.user?.userId,
        userBranchIds,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, po, `Purchase order status updated to ${req.body.status}`);
    } catch (error) {
      next(error);
    }
  }

  // Goods Receive Note (GRN)
  public static async createGoodsReceiveNote(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const isAdmin = req.user?.role?.toUpperCase().includes('ADMIN');
      const userBranchIds = isAdmin ? undefined : (req.user as any)?.branchIds;
      const grn = await PurchaseService.createGoodsReceiveNote({
        companyId,
        branchId: req.body.branchId,
        warehouseId: req.body.warehouseId,
        supplierId: req.body.supplierId,
        poId: req.body.poId,
        receiveDate: req.body.receiveDate,
        invoiceNumber: req.body.invoiceNumber,
        invoiceDate: req.body.invoiceDate,
        invoiceAmount: req.body.invoiceAmount,
        taxAmount: req.body.taxAmount,
        freightAmount: req.body.freightAmount,
        allowPriceVariance: req.body.allowPriceVariance,
        invoiceAttachment: req.body.invoiceAttachment,
        notes: req.body.notes,
        status: req.body.status,
        items: req.body.items,
        receiverId: req.user?.userId,
        userBranchIds,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, grn, 'Goods Receive Note created & stock updated automatically', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async uploadSupplierInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const isAdmin = req.user?.role?.toUpperCase().includes('ADMIN');
      const userBranchIds = isAdmin ? undefined : (req.user as any)?.branchIds;

      const metadata = await PurchaseService.uploadSupplierInvoice({
        companyId,
        branchId: req.body.branchId,
        warehouseId: req.body.warehouseId,
        supplierId: req.body.supplierId,
        poId: req.body.poId,
        invoiceNumber: req.body.invoiceNumber,
        invoiceDate: req.body.invoiceDate,
        invoiceAmount: req.body.invoiceAmount,
        fileName: req.body.fileName,
        fileType: req.body.fileType,
        fileBase64: req.body.fileBase64,
        actorId: req.user?.userId,
        userBranchIds,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, metadata, 'Supplier invoice uploaded and linked successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async approveGoodsReceiveVariance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const isAdmin = req.user?.role?.toUpperCase().includes('ADMIN') || req.user?.role?.toUpperCase().includes('MANAGER');
      const userBranchIds = isAdmin ? undefined : (req.user as any)?.branchIds;
      const grn = await PurchaseService.approveGoodsReceiveVariance(
        companyId,
        id,
        req.user?.userId,
        userBranchIds,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, grn, 'Price variance approved & GRN confirmed successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async rejectGoodsReceiveVariance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const isAdmin = req.user?.role?.toUpperCase().includes('ADMIN') || req.user?.role?.toUpperCase().includes('MANAGER');
      const userBranchIds = isAdmin ? undefined : (req.user as any)?.branchIds;
      const grn = await PurchaseService.rejectGoodsReceiveVariance(
        companyId,
        id,
        req.body.reason || 'Excess price variance rejected by manager',
        req.user?.userId,
        userBranchIds,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, grn, 'Price variance rejected. Excess amount was not finalized.');
    } catch (error) {
      next(error);
    }
  }

  public static async confirmGoodsReceiveNote(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const isAdmin = req.user?.role?.toUpperCase().includes('ADMIN');
      const userBranchIds = isAdmin ? undefined : (req.user as any)?.branchIds;
      const grn = await PurchaseService.confirmGoodsReceiveNote(
        companyId,
        id,
        req.user?.userId,
        userBranchIds,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, grn, 'Goods Receive Note confirmed & warehouse stock increased successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getGoodsReceiveNoteById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const grn = await PurchaseService.getGoodsReceiveNoteById(companyId, id);
      return sendSuccess(res, grn, 'Goods receive note details');
    } catch (error) {
      next(error);
    }
  }

  public static async getGoodsReceiveNotes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId, warehouseId, supplierId, poId, page, limit } = req.query;
      const result = await PurchaseService.getGoodsReceiveNotes(companyId, {
        branchId: branchId as string,
        warehouseId: warehouseId as string,
        supplierId: supplierId as string,
        poId: poId as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
      });
      return sendSuccess(res, result.grns, 'Goods receive notes retrieved', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }
}
