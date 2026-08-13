"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestaurantController = void 0;
const restaurant_service_1 = require("../services/restaurant.service");
const response_utils_1 = require("../utils/response.utils");
const database_1 = require("../config/database");
const resolveCompanyId = async (req) => {
    if (req.user?.companyId)
        return req.user.companyId;
    const company = await database_1.prisma.company.findFirst({ where: { isActive: true } });
    if (!company)
        throw new response_utils_1.AppError('No active company found in system', 400);
    return company.id;
};
const getClientIp = (req) => {
    const xf = req.headers['x-forwarded-for'];
    if (Array.isArray(xf))
        return xf[0] || '';
    if (typeof xf === 'string')
        return xf.split(',')[0].trim();
    return req.ip || '';
};
class RestaurantController {
    // Menus & Categories
    static async getMenus(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId;
            const menus = await restaurant_service_1.RestaurantService.getMenus(companyId, branchId);
            return (0, response_utils_1.sendSuccess)(res, menus, 'Menus retrieved');
        }
        catch (error) {
            next(error);
        }
    }
    static async createMenu(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const menu = await restaurant_service_1.RestaurantService.createMenu(companyId, req.body, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, menu, 'Menu created', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async createMenuCategory(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const category = await restaurant_service_1.RestaurantService.createMenuCategory(companyId, req.body, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, category, 'Menu category created', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async getMenuItems(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { menuId, categoryId, search, station } = req.query;
            const items = await restaurant_service_1.RestaurantService.getMenuItems(companyId, {
                menuId: menuId,
                categoryId: categoryId,
                search: search,
                station: station
            });
            return (0, response_utils_1.sendSuccess)(res, items, 'Menu items retrieved');
        }
        catch (error) {
            next(error);
        }
    }
    static async createMenuItem(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const item = await restaurant_service_1.RestaurantService.createMenuItem(companyId, req.body, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, item, 'Menu item created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // Table Management
    static async getTables(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId || '';
            if (!branchId)
                throw new response_utils_1.AppError('Branch ID is required', 400);
            const tables = await restaurant_service_1.RestaurantService.getTables(companyId, branchId);
            return (0, response_utils_1.sendSuccess)(res, tables, 'Tables retrieved');
        }
        catch (error) {
            next(error);
        }
    }
    static async createTable(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const table = await restaurant_service_1.RestaurantService.createTable(companyId, req.body, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, table, 'Dining table created', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async updateTableStatus(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const updated = await restaurant_service_1.RestaurantService.updateTableStatus(companyId, id, req.body.status, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, updated, 'Table status updated');
        }
        catch (error) {
            next(error);
        }
    }
    static async mergeTables(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const result = await restaurant_service_1.RestaurantService.mergeTables(companyId, req.body.sourceTableId, req.body.targetTableId, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, result, 'Tables merged');
        }
        catch (error) {
            next(error);
        }
    }
    // POS Fast Ordering
    static async createOrder(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const order = await restaurant_service_1.RestaurantService.createOrder(companyId, req.body.branchId, req.body, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, order, 'Order created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async sendOrderToKitchen(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await restaurant_service_1.RestaurantService.sendOrderToKitchen(companyId, id, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, result, 'Order sent to Kitchen Display Stations');
        }
        catch (error) {
            next(error);
        }
    }
    // KDS Screen Tickets
    static async getKitchenTickets(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { branchId, station, status } = req.query;
            const tickets = await restaurant_service_1.RestaurantService.getKitchenTickets(companyId, {
                branchId: branchId,
                station: station,
                status: status
            });
            return (0, response_utils_1.sendSuccess)(res, tickets, 'Kitchen tickets retrieved');
        }
        catch (error) {
            next(error);
        }
    }
    static async updateKitchenTicketStatus(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const ticket = await restaurant_service_1.RestaurantService.updateKitchenTicketStatus(companyId, id, req.body.status, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, ticket, 'Kitchen ticket updated');
        }
        catch (error) {
            next(error);
        }
    }
    // Discounts
    static async applyDiscount(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await restaurant_service_1.RestaurantService.applyDiscount(companyId, id, req.body, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // POS Checkout & Settlement
    static async completeOrderCheckout(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await restaurant_service_1.RestaurantService.completeOrderCheckout({
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
            return (0, response_utils_1.sendSuccess)(res, result, result.message, 201);
        }
        catch (error) {
            next(error);
        }
    }
    // Sales Reports & Analytics
    static async getSalesAnalytics(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { branchId, startDate, endDate } = req.query;
            const analytics = await restaurant_service_1.RestaurantService.getSalesAnalytics(companyId, {
                branchId: branchId,
                startDate: startDate,
                endDate: endDate
            });
            return (0, response_utils_1.sendSuccess)(res, analytics, 'Sales analytics retrieved');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.RestaurantController = RestaurantController;
