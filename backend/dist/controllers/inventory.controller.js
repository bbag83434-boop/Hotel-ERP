"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryController = void 0;
const inventory_service_1 = require("../services/inventory.service");
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
class InventoryController {
    // Categories & Units
    static async getCategories(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const categories = await inventory_service_1.InventoryService.getCategories(companyId);
            return (0, response_utils_1.sendSuccess)(res, categories, 'Categories retrieved');
        }
        catch (error) {
            next(error);
        }
    }
    static async createCategory(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const category = await inventory_service_1.InventoryService.createCategory(companyId, req.body, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, category, 'Category created', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async getUnits(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const units = await inventory_service_1.InventoryService.getUnits(companyId);
            return (0, response_utils_1.sendSuccess)(res, units, 'Units retrieved');
        }
        catch (error) {
            next(error);
        }
    }
    static async createUnit(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const unit = await inventory_service_1.InventoryService.createUnit(companyId, req.body, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, unit, 'Unit created', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // Items / Products Master
    static async getItems(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { search, categoryId, type, isActive, page, limit } = req.query;
            const result = await inventory_service_1.InventoryService.getItems(companyId, {
                search: search,
                categoryId: categoryId,
                type: type,
                isActive: isActive !== undefined ? isActive === 'true' : undefined,
                page: page ? parseInt(page, 10) : 1,
                limit: limit ? parseInt(limit, 10) : 20
            });
            return (0, response_utils_1.sendSuccess)(res, result.items, 'Items retrieved', 200, result.pagination);
        }
        catch (error) {
            next(error);
        }
    }
    static async getItemById(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const item = await inventory_service_1.InventoryService.getItemById(companyId, id);
            return (0, response_utils_1.sendSuccess)(res, item, 'Item retrieved');
        }
        catch (error) {
            next(error);
        }
    }
    static async createItem(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const item = await inventory_service_1.InventoryService.createItem(companyId, req.body, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, item, 'Item created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async updateItem(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const item = await inventory_service_1.InventoryService.updateItem(companyId, id, req.body, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, item, 'Item updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // Warehouses
    static async getWarehouses(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId;
            const warehouses = await inventory_service_1.InventoryService.getWarehouses(companyId, branchId);
            return (0, response_utils_1.sendSuccess)(res, warehouses, 'Warehouses retrieved');
        }
        catch (error) {
            next(error);
        }
    }
    static async createWarehouse(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const warehouse = await inventory_service_1.InventoryService.createWarehouse(companyId, req.body, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, warehouse, 'Warehouse created', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // Stock Balances & Alerts
    static async getStockBalances(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { warehouseId, branchId, lowStockOnly, search, page, limit } = req.query;
            const result = await inventory_service_1.InventoryService.getStockBalances(companyId, {
                warehouseId: warehouseId,
                branchId: branchId,
                lowStockOnly: lowStockOnly === 'true',
                search: search,
                page: page ? parseInt(page, 10) : 1,
                limit: limit ? parseInt(limit, 10) : 25
            });
            return (0, response_utils_1.sendSuccess)(res, result.balances, 'Stock balances retrieved', 200, result.pagination);
        }
        catch (error) {
            next(error);
        }
    }
    // Stock Ledger
    static async getStockLedger(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { warehouseId, itemId, movementType, page, limit } = req.query;
            const result = await inventory_service_1.InventoryService.getStockLedger(companyId, {
                warehouseId: warehouseId,
                itemId: itemId,
                movementType: movementType,
                page: page ? parseInt(page, 10) : 1,
                limit: limit ? parseInt(limit, 10) : 30
            });
            return (0, response_utils_1.sendSuccess)(res, result.entries, 'Stock ledger entries retrieved', 200, result.pagination);
        }
        catch (error) {
            next(error);
        }
    }
    // Stock Transfer
    static async transferStock(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const transfer = await inventory_service_1.InventoryService.transferStock({
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
            return (0, response_utils_1.sendSuccess)(res, transfer, 'Stock transferred successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // Stock Adjustment
    static async adjustStock(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const balance = await inventory_service_1.InventoryService.adjustStock({
                companyId,
                warehouseId: req.body.warehouseId,
                itemId: req.body.itemId,
                newQuantity: req.body.newQuantity,
                reason: req.body.reason,
                actorId: req.user?.userId,
                ipAddress,
                userAgent
            });
            return (0, response_utils_1.sendSuccess)(res, balance, 'Stock adjusted successfully');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.InventoryController = InventoryController;
