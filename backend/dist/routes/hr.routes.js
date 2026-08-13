"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const hr_controller_1 = require("../controllers/hr.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const rbac_middleware_1 = require("../middlewares/rbac.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Departments
router.get('/departments', hr_controller_1.HRController.getDepartments);
router.post('/departments', (0, rbac_middleware_1.requirePermission)('hr:manage'), hr_controller_1.HRController.createDepartment);
// Employees
router.get('/employees', hr_controller_1.HRController.getEmployees);
router.post('/employees', (0, rbac_middleware_1.requirePermission)('hr:manage'), hr_controller_1.HRController.createEmployee);
router.patch('/employees/:id/status', (0, rbac_middleware_1.requirePermission)('hr:manage'), hr_controller_1.HRController.updateEmployeeStatus);
// Shifts & Attendance
router.get('/shifts', hr_controller_1.HRController.getShifts);
router.get('/attendances', hr_controller_1.HRController.getAttendances);
router.post('/attendances', (0, rbac_middleware_1.requirePermission)('hr:manage'), hr_controller_1.HRController.recordAttendance);
// Leaves
router.get('/leave-types', hr_controller_1.HRController.getLeaveTypes);
router.get('/leaves', hr_controller_1.HRController.getLeaveRequests);
router.post('/leaves', hr_controller_1.HRController.createLeaveRequest);
router.post('/leaves/:id/action', (0, rbac_middleware_1.requirePermission)('hr:manage'), hr_controller_1.HRController.actOnLeaveRequest);
// Payroll
router.get('/payrolls', hr_controller_1.HRController.getPayrollRuns);
router.post('/payrolls/run', (0, rbac_middleware_1.requirePermission)('payroll:manage'), hr_controller_1.HRController.executePayrollRun);
exports.default = router;
