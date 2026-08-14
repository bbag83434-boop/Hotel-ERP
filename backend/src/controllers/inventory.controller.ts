import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { InventoryService } from '../services/inventory.service';
import { UnitConversionService } from '../services/unitConversion.service';
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

export class InventoryController {
  // Categories & Units
  public static async getCategories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const categories = await InventoryService.getCategories(companyId);
      return sendSuccess(res, categories, 'Categories retrieved');
    } catch (error) {
      next(error);
    }
  }

  public static async createCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const category = await InventoryService.createCategory(
        companyId,
        req.body,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, category, 'Category created', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async getUnits(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const units = await InventoryService.getUnits(companyId);
      return sendSuccess(res, units, 'Units retrieved');
    } catch (error) {
      next(error);
    }
  }

  public static async createUnit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const unit = await InventoryService.createUnit(
        companyId,
        req.body,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, unit, 'Unit created', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async convertUnit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { amount, fromUnit, toUnit, customPackFactor } = req.body;
      const result = UnitConversionService.convert(
        Number(amount),
        String(fromUnit),
        String(toUnit),
        customPackFactor ? Number(customPackFactor) : undefined
      );
      return sendSuccess(res, result, 'Unit converted successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getSupportedUnits(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const units = UnitConversionService.getSupportedUnits();
      return sendSuccess(res, units, 'Supported conversion dictionary retrieved');
    } catch (error) {
      next(error);
    }
  }



  // Items / Products Master
  public static async getItems(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { search, categoryId, type, isActive, page, limit } = req.query;
      const result = await InventoryService.getItems(companyId, {
        search: search as string,
        categoryId: categoryId as string,
        type: type as any,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
      });
      return sendSuccess(res, result.items, 'Items retrieved', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  public static async getItemById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const item = await InventoryService.getItemById(companyId, id);
      return sendSuccess(res, item, 'Item retrieved');
    } catch (error) {
      next(error);
    }
  }

  public static async createItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const item = await InventoryService.createItem(
        companyId,
        req.body,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, item, 'Item created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async updateItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const item = await InventoryService.updateItem(
        companyId,
        id,
        req.body,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, item, 'Item updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // Warehouses
  public static async getWarehouses(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = req.query.branchId as string;
      const warehouses = await InventoryService.getWarehouses(companyId, branchId);
      return sendSuccess(res, warehouses, 'Warehouses retrieved');
    } catch (error) {
      next(error);
    }
  }

  public static async createWarehouse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const warehouse = await InventoryService.createWarehouse(
        companyId,
        req.body,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, warehouse, 'Warehouse created', 201);
    } catch (error) {
      next(error);
    }
  }

  // Stock Balances & Alerts
  public static async getStockBalances(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { warehouseId, branchId, lowStockOnly, search, page, limit } = req.query;
      const result = await InventoryService.getStockBalances(companyId, {
        warehouseId: warehouseId as string,
        branchId: branchId as string,
        lowStockOnly: lowStockOnly === 'true',
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 25
      });
      return sendSuccess(res, result.balances, 'Stock balances retrieved', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  // Stock Ledger
  public static async getStockLedger(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { warehouseId, itemId, movementType, page, limit } = req.query;
      const result = await InventoryService.getStockLedger(companyId, {
        warehouseId: warehouseId as string,
        itemId: itemId as string,
        movementType: movementType as any,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 30
      });
      return sendSuccess(res, result.entries, 'Stock ledger entries retrieved', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  // Stock Transfer
  public static async transferStock(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const transfer = await InventoryService.transferStock({
        companyId,
        fromWarehouseId: req.body.fromWarehouseId,
        toWarehouseId: req.body.toWarehouseId,
        transferDate: req.body.transferDate,
        notes: req.body.notes,
        items: req.body.items,
        actorId: req.user?.userId,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, transfer, 'Stock transferred successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // Stock Adjustment
  public static async adjustStock(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const balance = await InventoryService.adjustStock({
        companyId,
        warehouseId: req.body.warehouseId,
        itemId: req.body.itemId,
        newQuantity: req.body.newQuantity,
        reason: req.body.reason,
        actorId: req.user?.userId,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, balance, 'Stock adjusted successfully');
    } catch (error) {
      next(error);
    }
  }

  // Store Requisitions & Multi-Stage Warehouse Transfers (Part 4)
  public static async createRequisition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const requisition = await InventoryService.createRequisition({
        companyId,
        fromWarehouseId: req.body.fromWarehouseId,
        toWarehouseId: req.body.toWarehouseId,
        departmentId: req.body.departmentId,
        section: req.body.section,
        priority: req.body.priority,
        notes: req.body.notes,
        submitImmediately: req.body.submitImmediately,
        items: req.body.items,
        actorId: req.user?.userId,
        actorRole: req.user?.role,
        userBranchIds: (req.user as any)?.branchIds,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, requisition, 'Store requisition created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async getRequisitions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId, warehouseId, stage, search, page, limit } = req.query;
      const result = await InventoryService.getRequisitions(companyId, {
        branchId: branchId ? String(branchId) : undefined,
        warehouseId: warehouseId ? String(warehouseId) : undefined,
        stage: stage ? String(stage) : undefined,
        search: search ? String(search) : undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        userBranchIds: (req.user as any)?.branchIds
      });
      return sendSuccess(res, result, 'Store requisitions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getRequisitionById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const requisition = await InventoryService.getRequisitionById(companyId, req.params.id);
      return sendSuccess(res, requisition, 'Requisition retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async submitRequisition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const result = await InventoryService.submitRequisition({
        companyId,
        requisitionId: req.params.id,
        notes: req.body?.notes,
        actorId: req.user?.userId,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, result, 'Requisition submitted for approval');
    } catch (error) {
      next(error);
    }
  }

  public static async approveRequisition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const result = await InventoryService.approveRequisition({
        companyId,
        requisitionId: req.params.id,
        approverId: req.user?.userId || '',
        approverRole: req.user?.role,
        comment: req.body?.comment,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, result, 'Requisition approved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async rejectRequisition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const result = await InventoryService.rejectRequisition({
        companyId,
        requisitionId: req.params.id,
        rejecterId: req.user?.userId || '',
        rejecterRole: req.user?.role,
        reason: req.body.reason,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, result, 'Requisition rejected');
    } catch (error) {
      next(error);
    }
  }

  public static async pickAndVerifyRequisition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const result = await InventoryService.pickAndVerifyRequisition({
        companyId,
        requisitionId: req.params.id
      });
      return sendSuccess(res, result, 'Stock pick availability verified');
    } catch (error) {
      next(error);
    }
  }

  public static async dispatchRequisition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const result = await InventoryService.dispatchRequisition({
        companyId,
        requisitionId: req.params.id,
        dispatcherId: req.user?.userId || '',
        actorRole: req.user?.role,
        userBranchIds: (req.user as any)?.branchIds,
        notes: req.body?.notes,
        items: req.body?.items,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, result, 'Transfer dispatched and marked in-transit');
    } catch (error) {
      next(error);
    }
  }

  public static async receiveTransfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const result = await InventoryService.receiveTransfer({
        companyId,
        transferId: req.params.id,
        receiverId: req.user?.userId || '',
        actorRole: req.user?.role,
        userBranchIds: (req.user as any)?.branchIds,
        notes: req.body?.notes,
        items: req.body?.items,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, result, 'Transfer received and destination stock incremented');
    } catch (error) {
      next(error);
    }
  }
}
