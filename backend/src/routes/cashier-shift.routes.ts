import { Router } from 'express';
import { CashierShiftController } from '../controllers/cashier-shift.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// Active Shift & Operations
router.get('/active', CashierShiftController.getActiveSession);
router.post('/open', CashierShiftController.openSession);
router.post('/movement', CashierShiftController.recordCashMovement);
router.post('/close', CashierShiftController.closeSession);
router.post('/reconcile', requirePermission('accounting:manage'), CashierShiftController.reconcileSession);

// History & Auditing
router.get('/history', CashierShiftController.getSessionHistory);
router.get('/:sessionId', CashierShiftController.getSessionSummary);

export default router;
