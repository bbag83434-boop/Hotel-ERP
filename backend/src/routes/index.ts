import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import healthRoutes from './health.routes';
import inventoryRoutes from './inventory.routes';
import purchaseRoutes from './purchase.routes';
import productionRoutes from './production.routes';
import restaurantRoutes from './restaurant.routes';
import hotelRoutes from './hotel.routes';
import accountingRoutes from './accounting.routes';
import hrRoutes from './hr.routes';
import approvalRoutes from './approval.routes';
import dashboardRoutes from './dashboard.routes';
import aiRoutes from './ai.routes';
import routingRoutes from './routing.routes';
import branchRoutes from './branch.routes';

const router = Router();

// Sub-routes under API_PREFIX (/api/v1)
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/branches', branchRoutes);
router.use('/routing', routingRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/purchasing', purchaseRoutes);
router.use('/production', productionRoutes);
router.use('/restaurant', restaurantRoutes);
router.use('/hotel', hotelRoutes);
router.use('/accounting', accountingRoutes);
router.use('/hr', hrRoutes);
router.use('/approval', approvalRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/ai', aiRoutes);
router.use('/', healthRoutes);

export default router;
