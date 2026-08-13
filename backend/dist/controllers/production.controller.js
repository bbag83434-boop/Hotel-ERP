"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionController = void 0;
const production_service_1 = require("../services/production.service");
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
class ProductionController {
    // Recipes
    static async getRecipes(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { search, isActive, page, limit } = req.query;
            const result = await production_service_1.ProductionService.getRecipes(companyId, {
                search: search,
                isActive: isActive !== undefined ? isActive === 'true' : undefined,
                page: page ? parseInt(page, 10) : 1,
                limit: limit ? parseInt(limit, 10) : 20
            });
            return (0, response_utils_1.sendSuccess)(res, result.recipes, 'Recipes retrieved', 200, result.pagination);
        }
        catch (error) {
            next(error);
        }
    }
    static async getRecipeById(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const recipe = await production_service_1.ProductionService.getRecipeById(companyId, id);
            return (0, response_utils_1.sendSuccess)(res, recipe, 'Recipe details');
        }
        catch (error) {
            next(error);
        }
    }
    static async createRecipe(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const recipe = await production_service_1.ProductionService.createRecipe(companyId, req.body, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, recipe, 'Recipe created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async updateRecipe(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const recipe = await production_service_1.ProductionService.updateRecipe(companyId, id, req.body, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, recipe, 'Recipe updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // Preview Production Consumption
    static async previewProduction(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { recipeId, plannedQty, kitchenWarehouseId } = req.body;
            const preview = await production_service_1.ProductionService.previewProduction(companyId, recipeId, Number(plannedQty), kitchenWarehouseId);
            return (0, response_utils_1.sendSuccess)(res, preview, 'Production consumption preview generated');
        }
        catch (error) {
            next(error);
        }
    }
    // Production Orders & Execution
    static async executeProductionOrder(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const result = await production_service_1.ProductionService.executeProductionOrder({
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
            return (0, response_utils_1.sendSuccess)(res, result, 'Production completed and stock/costs updated', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async getProductionOrders(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { branchId, kitchenWarehouseId, page, limit } = req.query;
            const result = await production_service_1.ProductionService.getProductionOrders(companyId, {
                branchId: branchId,
                kitchenWarehouseId: kitchenWarehouseId,
                page: page ? parseInt(page, 10) : 1,
                limit: limit ? parseInt(limit, 10) : 20
            });
            return (0, response_utils_1.sendSuccess)(res, result.orders, 'Production orders retrieved', 200, result.pagination);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ProductionController = ProductionController;
