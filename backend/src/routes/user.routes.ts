import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/roles', requirePermission('users:read'), UserController.getRoles);
router.get('/permissions', requirePermission('users:read'), UserController.getPermissions);
router.get('/', requirePermission('users:read'), UserController.getUsers);
router.get('/:id', requirePermission('users:read'), UserController.getUserById);
router.post('/', requirePermission('users:manage'), UserController.createUser);
router.put('/:id/status', requirePermission('users:manage'), UserController.updateUserStatus);
router.put('/:id/branches', requirePermission('users:manage'), UserController.assignUserBranches);

export default router;

