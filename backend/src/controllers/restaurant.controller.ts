import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { RestaurantService } from '../services/restaurant.service';
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

export class RestaurantController {
  // Menus & Categories
  public static async getMenus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = req.query.branchId as string;
      const menus = await RestaurantService.getMenus(companyId, branchId);
      return sendSuccess(res, menus, 'Menus retrieved');
    } catch (error) {
      next(error);
    }
  }

  public static async createMenu(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const menu = await RestaurantService.createMenu(
        companyId,
        req.body,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, menu, 'Menu created', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async createMenuCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const category = await RestaurantService.createMenuCategory(
        companyId,
        req.body,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, category, 'Menu category created', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async getMenuItems(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { menuId, categoryId, search, station } = req.query;
      const items = await RestaurantService.getMenuItems(companyId, {
        menuId: menuId as string,
        categoryId: categoryId as string,
        search: search as string,
        station: station as any
      });
      return sendSuccess(res, items, 'Menu items retrieved');
    } catch (error) {
      next(error);
    }
  }

  public static async createMenuItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const item = await RestaurantService.createMenuItem(
        companyId,
        req.body,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, item, 'Menu item created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // Table Management
  public static async getTables(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || '';
      if (!branchId) throw new AppError('Branch ID is required', 400);

      const tables = await RestaurantService.getTables(companyId, branchId);
      return sendSuccess(res, tables, 'Tables retrieved');
    } catch (error) {
      next(error);
    }
  }

  public static async createTable(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const table = await RestaurantService.createTable(
        companyId,
        req.body,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, table, 'Dining table created', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async updateTableStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await RestaurantService.updateTableStatus(
        companyId,
        id,
        req.body.status,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, updated, 'Table status updated');
    } catch (error) {
      next(error);
    }
  }

  public static async mergeTables(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const result = await RestaurantService.mergeTables(
        companyId,
        req.body.sourceTableId,
        req.body.targetTableId,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, result, 'Tables merged');
    } catch (error) {
      next(error);
    }
  }

  // POS Fast Ordering
  public static async createOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const order = await RestaurantService.createOrder(
        companyId,
        req.body.branchId,
        req.body,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, order, 'Order created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async sendOrderToKitchen(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await RestaurantService.sendOrderToKitchen(
        companyId,
        id,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, result, 'Order sent to Kitchen Display Stations');
    } catch (error) {
      next(error);
    }
  }

  // KDS Screen Tickets
  public static async getKitchenTickets(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId, station, status } = req.query;
      const tickets = await RestaurantService.getKitchenTickets(companyId, {
        branchId: branchId as string,
        station: station as any,
        status: status as any
      });
      return sendSuccess(res, tickets, 'Kitchen tickets retrieved');
    } catch (error) {
      next(error);
    }
  }

  public static async updateKitchenTicketStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ticket = await RestaurantService.updateKitchenTicketStatus(
        companyId,
        id,
        req.body.status,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, ticket, 'Kitchen ticket updated');
    } catch (error) {
      next(error);
    }
  }

  // Discounts
  public static async applyDiscount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await RestaurantService.applyDiscount(
        companyId,
        id,
        req.body,
        req.user?.userId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // POS Checkout & Settlement
  public static async completeOrderCheckout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const ipAddress = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await RestaurantService.completeOrderCheckout({
        companyId,
        orderId: id,
        paymentMethod: req.body.paymentMethod,
        amount: Number(req.body.amount),
        receivedAmount: req.body.receivedAmount ? Number(req.body.receivedAmount) : undefined,
        transactionRef: req.body.transactionRef,
        cardLast4: req.body.cardLast4,
        notes: req.body.notes,
        cashierId: req.user?.userId,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, result, result.message, 201);
    } catch (error) {
      next(error);
    }
  }

  // Sales Reports & Analytics
  public static async getSalesAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId, startDate, endDate } = req.query;
      const analytics = await RestaurantService.getSalesAnalytics(companyId, {
        branchId: branchId as string,
        startDate: startDate as string,
        endDate: endDate as string
      });
      return sendSuccess(res, analytics, 'Sales analytics retrieved');
    } catch (error) {
      next(error);
    }
  }
}
