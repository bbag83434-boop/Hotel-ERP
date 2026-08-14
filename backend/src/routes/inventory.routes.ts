import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createCategorySchema,
  createUnitSchema,
  createItemSchema,
  updateItemSchema,
  createWarehouseSchema,
  transferStockSchema,
  adjustStockSchema
} from '../schemas/inventory.schema';

const router = Router();

router.use(authenticate);

// Categories
router.get('/categories', InventoryController.getCategories);
router.post('/categories', validate(createCategorySchema), InventoryController.createCategory);

// Units
router.get('/units', InventoryController.getUnits);
router.post('/units', validate(createUnitSchema), InventoryController.createUnit);
router.post('/units/convert', InventoryController.convertUnit);
router.get('/units/supported', InventoryController.getSupportedUnits);


// Items Master
router.get('/items', InventoryController.getItems);
router.get('/items/:id', InventoryController.getItemById);
router.post('/items', validate(createItemSchema), InventoryController.createItem);
router.put('/items/:id', validate(updateItemSchema), InventoryController.updateItem);

// Warehouses
router.get('/warehouses', InventoryController.getWarehouses);
router.post('/warehouses', validate(createWarehouseSchema), InventoryController.createWarehouse);

// Stock Balances & Alerts
router.get('/stocks', InventoryController.getStockBalances);

// Stock Ledger
router.get('/ledger', InventoryController.getStockLedger);

// Stock Transfers & Adjustments
router.post('/transfer', validate(transferStockSchema), InventoryController.transferStock);
router.post('/adjust', validate(adjustStockSchema), InventoryController.adjustStock);

export default router;
