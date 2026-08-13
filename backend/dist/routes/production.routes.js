"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const production_controller_1 = require("../controllers/production.controller");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const production_schema_1 = require("../schemas/production.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Recipes / BOM
router.get('/recipes', production_controller_1.ProductionController.getRecipes);
router.get('/recipes/:id', production_controller_1.ProductionController.getRecipeById);
router.post('/recipes', (0, validate_middleware_1.validate)(production_schema_1.createRecipeSchema), production_controller_1.ProductionController.createRecipe);
router.put('/recipes/:id', (0, validate_middleware_1.validate)(production_schema_1.updateRecipeSchema), production_controller_1.ProductionController.updateRecipe);
// Production Preview & Orders
router.post('/preview', (0, validate_middleware_1.validate)(production_schema_1.previewProductionSchema), production_controller_1.ProductionController.previewProduction);
router.post('/orders', (0, validate_middleware_1.validate)(production_schema_1.createProductionOrderSchema), production_controller_1.ProductionController.executeProductionOrder);
router.get('/orders', production_controller_1.ProductionController.getProductionOrders);
exports.default = router;
