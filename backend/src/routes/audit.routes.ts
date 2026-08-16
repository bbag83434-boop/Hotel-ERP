import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// 1. Compliance Summary KPIs
router.get('/summary', AuditController.getSummary);

// 2. Filterable Audit Stream
router.get('/logs', AuditController.getLogs);

// 3. Export Dossier
router.get('/export', AuditController.exportDossier);

// 4. Record-Level Lifecycle History
router.get('/trail/:entity/:entityId', AuditController.getEntityTrail);

// 5. Manual Detailed Audit Recording (Guarded)
router.post('/log', requirePermission('audit:write'), AuditController.logChange);

export default router;
