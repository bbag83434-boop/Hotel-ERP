import { Router } from 'express';
import { RestaurantController } from '../controllers/restaurant.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import {
  createMenuSchema,
  createMenuCategorySchema,
  createMenuItemSchema,
  createTableSchema,
  updateTableStatusSchema,
  mergeTablesSchema,
  createOrderSchema,
  updateTicketStatusSchema,
  applyDiscountSchema,
  processPaymentSchema
} from '../schemas/restaurant.schema';

const router = Router();

router.use(authenticate);

// Menus & Categories
router.get('/menus', RestaurantController.getMenus);
router.post('/menus', validate(createMenuSchema), RestaurantController.createMenu);
router.post('/categories', validate(createMenuCategorySchema), RestaurantController.createMenuCategory);

// Menu Items
router.get('/items', RestaurantController.getMenuItems);
router.post('/items', validate(createMenuItemSchema), RestaurantController.createMenuItem);

// Table Management
router.get('/tables', RestaurantController.getTables);
router.post('/tables', validate(createTableSchema), RestaurantController.createTable);
router.put('/tables/:id/status', validate(updateTableStatusSchema), RestaurantController.updateTableStatus);
router.post('/tables/merge', validate(mergeTablesSchema), RestaurantController.mergeTables);

// POS Fast Ordering
router.post('/orders', validate(createOrderSchema), RestaurantController.createOrder);
router.post('/orders/:id/send-kitchen', RestaurantController.sendOrderToKitchen);
router.post('/orders/:id/discount', validate(applyDiscountSchema), RestaurantController.applyDiscount);
router.post('/orders/:id/checkout', validate(processPaymentSchema), RestaurantController.completeOrderCheckout);

// Kitchen Display System (KDS)
router.get('/kds/tickets', RestaurantController.getKitchenTickets);
router.put('/kds/tickets/:id/status', validate(updateTicketStatusSchema), RestaurantController.updateKitchenTicketStatus);

// Sales Reports & Analytics
router.get('/sales/analytics', RestaurantController.getSalesAnalytics);

export default router;
