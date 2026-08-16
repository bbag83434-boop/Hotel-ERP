import { Router } from 'express';
import { OnlineOrderController } from '../controllers/online-order.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// ==========================================
// PUBLIC CUSTOMER DIGITAL ORDERING ROUTES
// (No Auth required for guests scanning QR)
// ==========================================
router.get('/menu', OnlineOrderController.getMenu);
router.get('/session/:token', OnlineOrderController.getSession);
router.post('/place', OnlineOrderController.placeOrder);
router.post('/settle', OnlineOrderController.settlePayment);
router.get('/track/:orderNumber', OnlineOrderController.trackOrder);

// ==========================================
// AUTHENTICATED RESTAURANT POS & MANAGER ROUTES
// ==========================================
router.post('/generate-qr', authenticate, OnlineOrderController.generateQR);
router.get('/branch-tables', authenticate, OnlineOrderController.getBranchTables);
router.get('/orders', authenticate, OnlineOrderController.getOrders);

export default router;
