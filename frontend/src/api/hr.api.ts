import { apiClient } from './axios';
import { Department, Employee, Shift, Attendance, LeaveType, LeaveRequest, PayrollRun } from '../types/hr.types';

export const hrApi = {
  // Departments
  getDepartments: async (branchId?: string): Promise<Department[]> => {
    const res = await apiClient.get('/hr/departments', { params: { branchId } });
    return res.data.data;
  },

  createDepartment: async (data: any): Promise<Department> => {
    const res = await apiClient.post('/hr/departments', data);
    return res.data.data;
  },

  // Employees
  getEmployees: async (params?: { branchId?: string; departmentId?: string; status?: string; search?: string }): Promise<Employee[]> => {
    const res = await apiClient.get('/hr/employees', { params });
    return res.data.data;
  },

  createEmployee: async (data: any): Promise<Employee> => {
    const res = await apiClient.post('/hr/employees', data);
    return res.data.data;
  },

  updateEmployeeStatus: async (id: string, status: string): Promise<Employee> => {
    const res = await apiClient.patch(`/hr/employees/${id}/status`, { status });
    return res.data.data;
  },

  // Shifts & Attendance
  getShifts: async (branchId?: string): Promise<Shift[]> => {
    const res = await apiClient.get('/hr/shifts', { params: { branchId } });
    return res.data.data;
  },

  getAttendances: async (params?: { branchId?: string; date?: string; employeeId?: string }): Promise<Attendance[]> => {
    const res = await apiClient.get('/hr/attendances', { params });
    return res.data.data;
  },

  recordAttendance: async (data: any): Promise<Attendance> => {
    const res = await apiClient.post('/hr/attendances', data);
    return res.data.data;
  },

  // Leaves
  getLeaveTypes: async (): Promise<LeaveType[]> => {
    const res = await apiClient.get('/hr/leave-types');
    return res.data.data;
  },

  getLeaveRequests: async (params?: { branchId?: string; status?: string; employeeId?: string }): Promise<LeaveRequest[]> => {
    const res = await apiClient.get('/hr/leaves', { params });
    return res.data.data;
  },

  createLeaveRequest: async (data: any): Promise<LeaveRequest> => {
    const res = await apiClient.post('/hr/leaves', data);
    return res.data.data;
  },

  actOnLeaveRequest: async (id: string, data: { status: 'APPROVED' | 'REJECTED'; rejectionReason?: string }): Promise<LeaveRequest> => {
    const res = await apiClient.post(`/hr/leaves/${id}/action`, data);
    return res.data.data;
  },

  // Payroll
  getPayrollRuns: async (branchId?: string): Promise<PayrollRun[]> => {
    const res = await apiClient.get('/hr/payrolls', { params: { branchId } });
    return res.data.data;
  },

  executePayrollRun: async (data: { branchId?: string; month: number; year: number }): Promise<PayrollRun> => {
    const res = await apiClient.post('/hr/payrolls/run', data);
    return res.data.data;
  }
};
