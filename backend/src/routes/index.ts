import { Router } from 'express';
import healthRoutes from './health.routes';

const router = Router();

// Mount Health Check Routes
router.use('/health', healthRoutes);

export default router;
