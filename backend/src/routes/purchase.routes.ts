import { Router } from 'express';
import { PurchaseController } from '../controllers/purchase.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createSupplierSchema,
  updateSupplierSchema,
  createPurchaseRequestSchema,
  approvePurchaseRequestSchema,
  rejectPurchaseRequestSchema,
  createPurchaseOrderSchema,
  createGoodsReceiveSchema
} from '../schemas/purchase.schema';

const router = Router();

router.use(authenticate);

// Suppliers
router.get('/suppliers', PurchaseController.getSuppliers);
router.post('/suppliers', validate(createSupplierSchema), PurchaseController.createSupplier);
router.put('/suppliers/:id', validate(updateSupplierSchema), PurchaseController.updateSupplier);
router.get('/suppliers/:id/ledger', PurchaseController.getSupplierLedger);

// Purchase Requests
router.get('/requests', PurchaseController.getPurchaseRequests);
router.post('/requests', validate(createPurchaseRequestSchema), PurchaseController.createPurchaseRequest);
router.post('/requests/:id/approve', validate(approvePurchaseRequestSchema), PurchaseController.approvePurchaseRequest);
router.post('/requests/:id/reject', validate(rejectPurchaseRequestSchema), PurchaseController.rejectPurchaseRequest);

// Purchase Orders
router.get('/orders', PurchaseController.getPurchaseOrders);
router.get('/orders/:id', PurchaseController.getPurchaseOrderById);
router.post('/orders', validate(createPurchaseOrderSchema), PurchaseController.createPurchaseOrder);

// Goods Receive Notes (GRN)
router.get('/grn', PurchaseController.getGoodsReceiveNotes);
router.post('/grn', validate(createGoodsReceiveSchema), PurchaseController.createGoodsReceiveNote);

export default router;
