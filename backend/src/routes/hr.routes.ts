import { Router } from 'express';
import { HRController } from '../controllers/hr.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// Departments
router.get('/departments', HRController.getDepartments);
router.post('/departments', requirePermission('hr:manage'), HRController.createDepartment);

// Employees
router.get('/employees', HRController.getEmployees);
router.post('/employees', requirePermission('hr:manage'), HRController.createEmployee);
router.patch('/employees/:id/status', requirePermission('hr:manage'), HRController.updateEmployeeStatus);

// Shifts & Attendance
router.get('/shifts', HRController.getShifts);
router.get('/attendances', HRController.getAttendances);
router.post('/attendances', requirePermission('hr:manage'), HRController.recordAttendance);

// Leaves
router.get('/leave-types', HRController.getLeaveTypes);
router.get('/leaves', HRController.getLeaveRequests);
router.post('/leaves', HRController.createLeaveRequest);
router.post('/leaves/:id/action', requirePermission('hr:manage'), HRController.actOnLeaveRequest);

// Payroll
router.get('/payrolls', HRController.getPayrollRuns);
router.post('/payrolls/run', requirePermission('payroll:manage'), HRController.executePayrollRun);

export default router;
