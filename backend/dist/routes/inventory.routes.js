"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventory_controller_1 = require("../controllers/inventory.controller");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const inventory_schema_1 = require("../schemas/inventory.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Categories
router.get('/categories', inventory_controller_1.InventoryController.getCategories);
router.post('/categories', (0, validate_middleware_1.validate)(inventory_schema_1.createCategorySchema), inventory_controller_1.InventoryController.createCategory);
// Units
router.get('/units', inventory_controller_1.InventoryController.getUnits);
router.post('/units', (0, validate_middleware_1.validate)(inventory_schema_1.createUnitSchema), inventory_controller_1.InventoryController.createUnit);
router.post('/units/convert', inventory_controller_1.InventoryController.convertUnit);
router.get('/units/supported', inventory_controller_1.InventoryController.getSupportedUnits);
// Items Master
router.get('/items', inventory_controller_1.InventoryController.getItems);
router.get('/items/:id', inventory_controller_1.InventoryController.getItemById);
router.post('/items', (0, validate_middleware_1.validate)(inventory_schema_1.createItemSchema), inventory_controller_1.InventoryController.createItem);
router.put('/items/:id', (0, validate_middleware_1.validate)(inventory_schema_1.updateItemSchema), inventory_controller_1.InventoryController.updateItem);
// Warehouses
router.get('/warehouses', inventory_controller_1.InventoryController.getWarehouses);
router.post('/warehouses', (0, validate_middleware_1.validate)(inventory_schema_1.createWarehouseSchema), inventory_controller_1.InventoryController.createWarehouse);
// Stock Balances & Alerts
router.get('/stocks', inventory_controller_1.InventoryController.getStockBalances);
// Stock Ledger
router.get('/ledger', inventory_controller_1.InventoryController.getStockLedger);
// Stock Transfers & Adjustments
router.post('/transfer', (0, validate_middleware_1.validate)(inventory_schema_1.transferStockSchema), inventory_controller_1.InventoryController.transferStock);
router.post('/adjust', (0, validate_middleware_1.validate)(inventory_schema_1.adjustStockSchema), inventory_controller_1.InventoryController.adjustStock);
// Wastage & Loss Control (Part 12)
router.get('/wastage', inventory_controller_1.InventoryController.getWastageRecords);
router.post('/wastage', (0, validate_middleware_1.validate)(inventory_schema_1.recordWastageSchema), inventory_controller_1.InventoryController.recordWastage);
// Stock Count & Auditing (Part 16)
router.get('/stock-counts', inventory_controller_1.InventoryController.getStockCountHistory);
router.post('/stock-counts', (0, validate_middleware_1.validate)(inventory_schema_1.reconcileStockCountSchema), inventory_controller_1.InventoryController.reconcilePhysicalCount);
// Store Requisitions & Multi-Stage Warehouse Transfers (Part 4)
router.get('/requisitions', inventory_controller_1.InventoryController.getRequisitions);
router.get('/requisitions/:id', inventory_controller_1.InventoryController.getRequisitionById);
router.post('/requisitions', (0, validate_middleware_1.validate)(inventory_schema_1.createRequisitionSchema), inventory_controller_1.InventoryController.createRequisition);
router.post('/requisitions/:id/submit', (0, validate_middleware_1.validate)(inventory_schema_1.submitRequisitionSchema), inventory_controller_1.InventoryController.submitRequisition);
router.post('/requisitions/:id/approve', (0, validate_middleware_1.validate)(inventory_schema_1.approveRequisitionSchema), inventory_controller_1.InventoryController.approveRequisition);
router.post('/requisitions/:id/reject', (0, validate_middleware_1.validate)(inventory_schema_1.rejectRequisitionSchema), inventory_controller_1.InventoryController.rejectRequisition);
router.get('/requisitions/:id/pick-verify', inventory_controller_1.InventoryController.pickAndVerifyRequisition);
router.post('/requisitions/:id/dispatch', (0, validate_middleware_1.validate)(inventory_schema_1.dispatchTransferSchema), inventory_controller_1.InventoryController.dispatchRequisition);
router.post('/transfers/:id/receive', (0, validate_middleware_1.validate)(inventory_schema_1.receiveTransferSchema), inventory_controller_1.InventoryController.receiveTransfer);
exports.default = router;
