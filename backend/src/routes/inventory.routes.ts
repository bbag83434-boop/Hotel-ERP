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
  adjustStockSchema,
  createRequisitionSchema,
  submitRequisitionSchema,
  approveRequisitionSchema,
  rejectRequisitionSchema,
  dispatchTransferSchema,
  receiveTransferSchema,
  recordWastageSchema,
  reconcileStockCountSchema
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

// Wastage & Loss Control (Part 12)
router.get('/wastage', InventoryController.getWastageRecords);
router.post('/wastage', validate(recordWastageSchema), InventoryController.recordWastage);

// Stock Count & Auditing (Part 16)
router.get('/stock-counts', InventoryController.getStockCountHistory);
router.post('/stock-counts', validate(reconcileStockCountSchema), InventoryController.reconcilePhysicalCount);

// Store Requisitions & Multi-Stage Warehouse Transfers (Part 4)
router.get('/requisitions', InventoryController.getRequisitions);
router.get('/requisitions/:id', InventoryController.getRequisitionById);
router.post('/requisitions', validate(createRequisitionSchema), InventoryController.createRequisition);
router.post('/requisitions/:id/submit', validate(submitRequisitionSchema), InventoryController.submitRequisition);
router.post('/requisitions/:id/approve', validate(approveRequisitionSchema), InventoryController.approveRequisition);
router.post('/requisitions/:id/reject', validate(rejectRequisitionSchema), InventoryController.rejectRequisition);
router.get('/requisitions/:id/pick-verify', InventoryController.pickAndVerifyRequisition);
router.post('/requisitions/:id/dispatch', validate(dispatchTransferSchema), InventoryController.dispatchRequisition);
router.post('/transfers/:id/receive', validate(receiveTransferSchema), InventoryController.receiveTransfer);

export default router;
