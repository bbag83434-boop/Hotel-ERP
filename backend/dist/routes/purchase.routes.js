"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const purchase_controller_1 = require("../controllers/purchase.controller");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const purchase_schema_1 = require("../schemas/purchase.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Suppliers
router.get('/suppliers', purchase_controller_1.PurchaseController.getSuppliers);
router.post('/suppliers', (0, validate_middleware_1.validate)(purchase_schema_1.createSupplierSchema), purchase_controller_1.PurchaseController.createSupplier);
router.put('/suppliers/:id', (0, validate_middleware_1.validate)(purchase_schema_1.updateSupplierSchema), purchase_controller_1.PurchaseController.updateSupplier);
router.get('/suppliers/:id/ledger', purchase_controller_1.PurchaseController.getSupplierLedger);
// Purchase Requests
router.get('/requests', purchase_controller_1.PurchaseController.getPurchaseRequests);
router.post('/requests', (0, validate_middleware_1.validate)(purchase_schema_1.createPurchaseRequestSchema), purchase_controller_1.PurchaseController.createPurchaseRequest);
router.post('/requests/:id/approve', (0, validate_middleware_1.validate)(purchase_schema_1.approvePurchaseRequestSchema), purchase_controller_1.PurchaseController.approvePurchaseRequest);
router.post('/requests/:id/reject', (0, validate_middleware_1.validate)(purchase_schema_1.rejectPurchaseRequestSchema), purchase_controller_1.PurchaseController.rejectPurchaseRequest);
// Purchase Orders
router.get('/orders', purchase_controller_1.PurchaseController.getPurchaseOrders);
router.get('/orders/:id', purchase_controller_1.PurchaseController.getPurchaseOrderById);
router.post('/orders', (0, validate_middleware_1.validate)(purchase_schema_1.createPurchaseOrderSchema), purchase_controller_1.PurchaseController.createPurchaseOrder);
// Goods Receive Notes (GRN)
router.get('/grn', purchase_controller_1.PurchaseController.getGoodsReceiveNotes);
router.post('/grn', (0, validate_middleware_1.validate)(purchase_schema_1.createGoodsReceiveSchema), purchase_controller_1.PurchaseController.createGoodsReceiveNote);
exports.default = router;
