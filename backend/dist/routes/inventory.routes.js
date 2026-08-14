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
exports.default = router;
