import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { ProductionService } from '../services/production.service';
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

export class ProductionController {
  // Recipes
  public static async getRecipes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { search, isActive, page, limit } = req.query;
      const result = await ProductionService.getRecipes(companyId, {
        search: search as string,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
      });
      return sendSuccess(res, result.recipes, 'Recipes retrieved', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  public static async getRecipeById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const recipe = await ProductionService.getRecipeById(companyId, id);
      return sendSuccess(res, recipe, 'Recipe details');
    } catch (error) {
      next(error);
    }
  }

  public static async createRecipe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const recipe = await ProductionService.createRecipe(
        companyId,
        req.body,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, recipe, 'Recipe created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async updateRecipe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const recipe = await ProductionService.updateRecipe(
        companyId,
        id,
        req.body,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, recipe, 'Recipe updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // Preview Production Consumption
  public static async previewProduction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { recipeId, plannedQty, kitchenWarehouseId } = req.body;
      const preview = await ProductionService.previewProduction(
        companyId,
        recipeId,
        Number(plannedQty),
        kitchenWarehouseId
      );
      return sendSuccess(res, preview, 'Production consumption preview generated');
    } catch (error) {
      next(error);
    }
  }

  // Production Orders & Execution
  public static async executeProductionOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const result = await ProductionService.executeProductionOrder({
        companyId,
        branchId: req.body.branchId,
        kitchenWarehouseId: req.body.kitchenWarehouseId,
        recipeId: req.body.recipeId,
        plannedQty: req.body.plannedQty,
        actualYieldQty: req.body.actualYieldQty,
        wastageQty: req.body.wastageQty,
        plannedDate: req.body.plannedDate,
        notes: req.body.notes,
        actorId: req.user?.userId,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, result, 'Production completed and stock/costs updated', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async getProductionOrders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId, kitchenWarehouseId, page, limit } = req.query;
      const result = await ProductionService.getProductionOrders(companyId, {
        branchId: branchId as string,
        kitchenWarehouseId: kitchenWarehouseId as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
      });
      return sendSuccess(res, result.orders, 'Production orders retrieved', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }
}
