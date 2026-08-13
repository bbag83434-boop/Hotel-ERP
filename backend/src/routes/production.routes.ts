import { Router } from 'express';
import { ProductionController } from '../controllers/production.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createRecipeSchema,
  updateRecipeSchema,
  previewProductionSchema,
  createProductionOrderSchema
} from '../schemas/production.schema';

const router = Router();

router.use(authenticate);

// Recipes / BOM
router.get('/recipes', ProductionController.getRecipes);
router.get('/recipes/:id', ProductionController.getRecipeById);
router.post('/recipes', validate(createRecipeSchema), ProductionController.createRecipe);
router.put('/recipes/:id', validate(updateRecipeSchema), ProductionController.updateRecipe);

// Production Preview & Orders
router.post('/preview', validate(previewProductionSchema), ProductionController.previewProduction);
router.post('/orders', validate(createProductionOrderSchema), ProductionController.executeProductionOrder);
router.get('/orders', ProductionController.getProductionOrders);

export default router;
