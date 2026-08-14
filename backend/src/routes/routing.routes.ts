import { Router } from 'express';
import { RoutingController } from '../controllers/routing.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/directory', RoutingController.getDirectory);
router.post('/resolve', RoutingController.resolvePoc);
router.put('/poc', requirePermission('users:manage'), RoutingController.updatePoc);

export default router;
