import { Router } from 'express';
import { ApprovalController } from '../controllers/approval.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// Requests
router.get('/requests', ApprovalController.getRequests);
router.post('/requests', ApprovalController.createRequest);
router.post('/requests/:id/action', requirePermission('approval:manage'), ApprovalController.actOnRequest);

// Rules
router.get('/rules', ApprovalController.getRules);
router.post('/rules', requirePermission('approval:manage'), ApprovalController.createRule);

export default router;
