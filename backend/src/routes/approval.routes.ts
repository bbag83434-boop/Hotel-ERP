import { Router } from 'express';
import { ApprovalController } from '../controllers/approval.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// Summary Metrics
router.get('/summary', ApprovalController.getSummary);

// Requests Queue
router.get('/requests', ApprovalController.getRequests);
router.post('/requests', ApprovalController.createRequest);
router.post('/requests/:id/action', requirePermission('approval:manage'), ApprovalController.actOnRequest);

// Rules Configuration Matrix
router.get('/rules', ApprovalController.getRules);
router.post('/rules', requirePermission('approval:manage'), ApprovalController.createRule);
router.put('/rules/:id', requirePermission('approval:manage'), ApprovalController.updateRule);
router.delete('/rules/:id', requirePermission('approval:manage'), ApprovalController.deleteRule);

export default router;
