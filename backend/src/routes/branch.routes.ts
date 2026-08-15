import { Router } from 'express';
import { BranchController } from '../controllers/branch.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createBranchSchema } from '../schemas/branch.schema';

const router = Router();

router.use(authenticate);

router.get('/', BranchController.getBranches);
router.post('/', validate(createBranchSchema), BranchController.createBranch);

export default router;
