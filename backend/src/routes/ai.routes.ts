import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.post('/query', requirePermission('ai:chat'), AIController.queryAssistant);

export default router;
