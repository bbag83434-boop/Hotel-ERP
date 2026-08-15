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
            const isAdmin = req.user?.role?.toUpperCase().includes('ADMIN');
            const userBranchIds = isAdmin ? undefined : req.user?.branchIds;
            const idempotencyKey = req.body.idempotencyKey || req.headers['x-idempotency-key'];
            const po = await purchase_service_1.PurchaseService.createPurchaseOrder(companyId, req.body.branchId, { ...req.body, idempotencyKey }, req.user?.userId, userBranchIds, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, po, 'Purchase order created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async updatePurchaseOrder(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const isAdmin = req.user?.role?.toUpperCase().includes('ADMIN');
            const userBranchIds = isAdmin ? undefined : req.user?.branchIds;
            const po = await purchase_service_1.PurchaseService.updatePurchaseOrder(companyId, id, req.body, req.user?.userId, userBranchIds, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, po, 'Draft Purchase Order updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async updatePurchaseOrderStatus(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const isAdmin = req.user?.role?.toUpperCase().includes('ADMIN');
            const userBranchIds = isAdmin ? undefined : req.user?.branchIds;
            const po = await purchase_service_1.PurchaseService.updatePurchaseOrderStatus(companyId, id, req.body.status, req.body.reason, req.user?.userId, userBranchIds, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, po, `Purchase order status updated to ${req.body.status}`);
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
            const isAdmin = req.user?.role?.toUpperCase().includes('ADMIN');
            const userBranchIds = isAdmin ? undefined : req.user?.branchIds;
            const idempotencyKey = req.body.idempotencyKey || req.headers['x-idempotency-key'];
            const grn = await purchase_service_1.PurchaseService.createGoodsReceiveNote({
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
                idempotencyKey,
                invoiceAttachment: req.body.invoiceAttachment,
                notes: req.body.notes,
                status: req.body.status,
                items: req.body.items,
                receiverId: req.user?.userId,
                userBranchIds,
                ipAddress,
                userAgent
            });
            return (0, response_utils_1.sendSuccess)(res, grn, 'Goods Receive Note created & stock updated automatically', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async uploadSupplierInvoice(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const isAdmin = req.user?.role?.toUpperCase().includes('ADMIN');
            const userBranchIds = isAdmin ? undefined : req.user?.branchIds;
            const metadata = await purchase_service_1.PurchaseService.uploadSupplierInvoice({
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
            return (0, response_utils_1.sendSuccess)(res, metadata, 'Supplier invoice uploaded and linked successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async approveGoodsReceiveVariance(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const isAdmin = req.user?.role?.toUpperCase().includes('ADMIN') || req.user?.role?.toUpperCase().includes('MANAGER');
            const userBranchIds = isAdmin ? undefined : req.user?.branchIds;
            const grn = await purchase_service_1.PurchaseService.approveGoodsReceiveVariance(companyId, id, req.user?.userId, userBranchIds, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, grn, 'Price variance approved & GRN confirmed successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async rejectGoodsReceiveVariance(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const isAdmin = req.user?.role?.toUpperCase().includes('ADMIN') || req.user?.role?.toUpperCase().includes('MANAGER');
            const userBranchIds = isAdmin ? undefined : req.user?.branchIds;
            const grn = await purchase_service_1.PurchaseService.rejectGoodsReceiveVariance(companyId, id, req.body.reason || 'Excess price variance rejected by manager', req.user?.userId, userBranchIds, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, grn, 'Price variance rejected. Excess amount was not finalized.');
        }
        catch (error) {
            next(error);
        }
    }
    static async confirmGoodsReceiveNote(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const isAdmin = req.user?.role?.toUpperCase().includes('ADMIN');
            const userBranchIds = isAdmin ? undefined : req.user?.branchIds;
            const grn = await purchase_service_1.PurchaseService.confirmGoodsReceiveNote(companyId, id, req.user?.userId, userBranchIds, ipAddress, userAgent);
            return (0, response_utils_1.sendSuccess)(res, grn, 'Goods Receive Note confirmed & warehouse stock increased successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async getGoodsReceiveNoteById(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const grn = await purchase_service_1.PurchaseService.getGoodsReceiveNoteById(companyId, id);
            return (0, response_utils_1.sendSuccess)(res, grn, 'Goods receive note details');
        }
        catch (error) {
            next(error);
        }
    }
    static async getGoodsReceiveNotes(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { branchId, warehouseId, supplierId, poId, page, limit } = req.query;
            const result = await purchase_service_1.PurchaseService.getGoodsReceiveNotes(companyId, {
                branchId: branchId,
                warehouseId: warehouseId,
                supplierId: supplierId,
                poId: poId,
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
