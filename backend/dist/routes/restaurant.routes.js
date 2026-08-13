"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const restaurant_controller_1 = require("../controllers/restaurant.controller");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const restaurant_schema_1 = require("../schemas/restaurant.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Menus & Categories
router.get('/menus', restaurant_controller_1.RestaurantController.getMenus);
router.post('/menus', (0, validate_middleware_1.validate)(restaurant_schema_1.createMenuSchema), restaurant_controller_1.RestaurantController.createMenu);
router.post('/categories', (0, validate_middleware_1.validate)(restaurant_schema_1.createMenuCategorySchema), restaurant_controller_1.RestaurantController.createMenuCategory);
// Menu Items
router.get('/items', restaurant_controller_1.RestaurantController.getMenuItems);
router.post('/items', (0, validate_middleware_1.validate)(restaurant_schema_1.createMenuItemSchema), restaurant_controller_1.RestaurantController.createMenuItem);
// Table Management
router.get('/tables', restaurant_controller_1.RestaurantController.getTables);
router.post('/tables', (0, validate_middleware_1.validate)(restaurant_schema_1.createTableSchema), restaurant_controller_1.RestaurantController.createTable);
router.put('/tables/:id/status', (0, validate_middleware_1.validate)(restaurant_schema_1.updateTableStatusSchema), restaurant_controller_1.RestaurantController.updateTableStatus);
router.post('/tables/merge', (0, validate_middleware_1.validate)(restaurant_schema_1.mergeTablesSchema), restaurant_controller_1.RestaurantController.mergeTables);
// POS Fast Ordering
router.post('/orders', (0, validate_middleware_1.validate)(restaurant_schema_1.createOrderSchema), restaurant_controller_1.RestaurantController.createOrder);
router.post('/orders/:id/send-kitchen', restaurant_controller_1.RestaurantController.sendOrderToKitchen);
router.post('/orders/:id/discount', (0, validate_middleware_1.validate)(restaurant_schema_1.applyDiscountSchema), restaurant_controller_1.RestaurantController.applyDiscount);
router.post('/orders/:id/checkout', (0, validate_middleware_1.validate)(restaurant_schema_1.processPaymentSchema), restaurant_controller_1.RestaurantController.completeOrderCheckout);
// Kitchen Display System (KDS)
router.get('/kds/tickets', restaurant_controller_1.RestaurantController.getKitchenTickets);
router.put('/kds/tickets/:id/status', (0, validate_middleware_1.validate)(restaurant_schema_1.updateTicketStatusSchema), restaurant_controller_1.RestaurantController.updateKitchenTicketStatus);
// Sales Reports & Analytics
router.get('/sales/analytics', restaurant_controller_1.RestaurantController.getSalesAnalytics);
exports.default = router;
