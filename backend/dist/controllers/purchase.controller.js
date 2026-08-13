"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseController = void 0;
const purchase_service_1 = require("../services/purchase.service");
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
class PurchaseController {
    // Suppliers
    static async getSuppliers(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { search, isActive, page, limit } = req.query;
            const result = await purchase_service_1.PurchaseService.getSuppliers(companyId, {
                search: search,
                isActive: isActive !== undefined ? isActive === 'true' : undefined,
                page: page ? parseInt(page, 10) : 1,
                limit: limit ? parseInt(limit, 10) : 20
            });
            return (0, response_utils_1.sendSuccess)(res, result.suppliers, 'Suppliers retrieved', 200, result.pagination);
        }
        catch (error) {
            next(error);
        }
    }
    static async createSupplier(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const supplier = await purchase_service_1.PurchaseService.createSupplier(companyId, req.body, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, supplier, 'Supplier created', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async updateSupplier(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const supplier = await purchase_service_1.PurchaseService.updateSupplier(companyId, id, req.body, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, supplier, 'Supplier updated');
        }
        catch (error) {
            next(error);
        }
    }
    static async getSupplierLedger(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { page, limit } = req.query;
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await purchase_service_1.PurchaseService.getSupplierLedger(companyId, id, {
                page: page ? parseInt(page, 10) : 1,
                limit: limit ? parseInt(limit, 10) : 30
            });
            return (0, response_utils_1.sendSuccess)(res, result.entries, 'Supplier ledger retrieved', 200, {
                ...result.pagination,
                supplier: result.supplier
            });
        }
        catch (error) {
            next(error);
        }
    }
    // Purchase Requests
    static async getPurchaseRequests(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { branchId, status, page, limit } = req.query;
            const result = await purchase_service_1.PurchaseService.getPurchaseRequests(companyId, {
                branchId: branchId,
                status: status,
                page: page ? parseInt(page, 10) : 1,
                limit: limit ? parseInt(limit, 10) : 20
            });
            return (0, response_utils_1.sendSuccess)(res, result.requests, 'Purchase requests retrieved', 200, result.pagination);
        }
        catch (error) {
            next(error);
        }
    }
    static async createPurchaseRequest(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const request = await purchase_service_1.PurchaseService.createPurchaseRequest(companyId, req.body.branchId, req.body, req.user.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, request, 'Purchase request submitted', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async approvePurchaseRequest(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await purchase_service_1.PurchaseService.approvePurchaseRequest(companyId, id, req.user.userId, req.body, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, result, 'Purchase request approved');
        }
        catch (error) {
            next(error);
        }
    }
    static async rejectPurchaseRequest(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await purchase_service_1.PurchaseService.rejectPurchaseRequest(companyId, id, req.user.userId, req.body.reason, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, result, 'Purchase request rejected');
        }
        catch (error) {
            next(error);
        }
    }
    // Purchase Orders
    static async getPurchaseOrders(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { branchId, supplierId, status, page, limit } = req.query;
            const result = await purchase_service_1.PurchaseService.getPurchaseOrders(companyId, {
                branchId: branchId,
                supplierId: supplierId,
                status: status,
                page: page ? parseInt(page, 10) : 1,
                limit: limit ? parseInt(limit, 10) : 20
            });
            return (0, response_utils_1.sendSuccess)(res, result.orders, 'Purchase orders retrieved', 200, result.pagination);
        }
        catch (error) {
            next(error);
        }
    }
    static async getPurchaseOrderById(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const order = await purchase_service_1.PurchaseService.getPurchaseOrderById(companyId, id);
            return (0, response_utils_1.sendSuccess)(res, order, 'Purchase order details');
        }
        catch (error) {
            next(error);
        }
    }
    static async createPurchaseOrder(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const po = await purchase_service_1.PurchaseService.createPurchaseOrder(companyId, req.body.branchId, req.body, req.user?.userId, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, po, 'Purchase order created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // Goods Receive Note (GRN)
    static async createGoodsReceiveNote(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const grn = await purchase_service_1.PurchaseService.createGoodsReceiveNote({
                companyId,
                branchId: req.body.branchId,
                warehouseId: req.body.warehouseId,
                supplierId: req.body.supplierId,
                poId: req.body.poId,
                receiveDate: req.body.receiveDate,
                invoiceNumber: req.body.invoiceNumber,
                notes: req.body.notes,
                items: req.body.items,
                receiverId: req.user?.userId,
                ipAddress,
                userAgent
            });
            return (0, response_utils_1.sendSuccess)(res, grn, 'Goods Receive Note created & stock updated automatically', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async getGoodsReceiveNotes(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { branchId, warehouseId, supplierId, page, limit } = req.query;
            const result = await purchase_service_1.PurchaseService.getGoodsReceiveNotes(companyId, {
                branchId: branchId,
                warehouseId: warehouseId,
                supplierId: supplierId,
                page: page ? parseInt(page, 10) : 1,
                limit: limit ? parseInt(limit, 10) : 20
            });
            return (0, response_utils_1.sendSuccess)(res, result.grns, 'Goods receive notes retrieved', 200, result.pagination);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.PurchaseController = PurchaseController;
