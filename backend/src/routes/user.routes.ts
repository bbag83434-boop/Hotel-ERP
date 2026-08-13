import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('users:read'), UserController.getUsers);
router.post('/', requirePermission('users:manage'), UserController.createUser);

export default router;
