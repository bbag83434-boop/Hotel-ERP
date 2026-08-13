import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  Calendar,
  DollarSign,
  Plus
} from 'lucide-react';
import { hrApi } from '../../api/hr.api';
import { Employee, Shift, Attendance, LeaveRequest, PayrollRun, Department, LeaveType } from '../../types/hr.types';
import { formatINR, formatDateIN } from '../../utils/formatters';

export const HRPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'leaves' | 'payroll'>('employees');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Data States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);

  // Modals
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);

  // Forms
  const [newEmployeeForm, setNewEmployeeForm] = useState({
    employeeCode: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    designation: '',
    departmentId: '',
    basicSalary: 35000,
    allowances: 3000,
    employmentType: 'FULL_TIME' as const
  });

  const [newAttendanceForm, setNewAttendanceForm] = useState({
    employeeId: '',
    date: new Date().toISOString().slice(0, 10),
    status: 'PRESENT' as const,
    workHours: 8
  });

  const [newLeaveForm, setNewLeaveForm] = useState({
    employeeId: '',
    leaveTypeId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    totalDays: 2,
    reason: ''
  });

  const [payrollRunForm, setPayrollRunForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const [emps, depts, shs, atts, leaves, lTypes, payrolls] = await Promise.all([
        hrApi.getEmployees().catch(() => []),
        hrApi.getDepartments().catch(() => []),
        hrApi.getShifts().catch(() => []),
        hrApi.getAttendances({ date: new Date().toISOString().slice(0, 10) }).catch(() => []),
        hrApi.getLeaveRequests().catch(() => []),
        hrApi.getLeaveTypes().catch(() => []),
        hrApi.getPayrollRuns().catch(() => [])
      ]);
      setEmployees(emps);
      setDepartments(depts);
      setShifts(shs);
      setAttendances(atts);
      setLeaveRequests(leaves);
      setLeaveTypes(lTypes);
      setPayrollRuns(payrolls);

      if (emps.length > 0) {
        setNewAttendanceForm((prev) => ({ ...prev, employeeId: emps[0].id }));
        setNewLeaveForm((prev) => ({
          ...prev,
          employeeId: emps[0].id,
          leaveTypeId: lTypes[0]?.id || ''
        }));
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to load HR data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Handlers
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await hrApi.createEmployee({
        ...newEmployeeForm,
        basicSalary: Number(newEmployeeForm.basicSalary),
        allowances: Number(newEmployeeForm.allowances)
      });
      setShowEmployeeModal(false);
      showToast(`Employee ${newEmployeeForm.firstName} ${newEmployeeForm.lastName} created!`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await hrApi.recordAttendance({
        ...newAttendanceForm,
        workHours: Number(newAttendanceForm.workHours)
      });
      setShowAttendanceModal(false);
      showToast('Attendance recorded successfully!');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to record attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await hrApi.createLeaveRequest({
        ...newLeaveForm,
        totalDays: Number(newLeaveForm.totalDays)
      });
      setShowLeaveModal(false);
      showToast('Leave request submitted!');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await hrApi.executePayrollRun(payrollRunForm);
      setShowPayrollModal(false);
      showToast(`Payroll #${res.payrollNumber} disbursed & General Ledger journal posted!`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to run payroll');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 md:pb-8">
      {/* Top Banner */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-cyan-600 to-blue-500 rounded-xl shadow-lg shadow-cyan-900/20 text-slate-950 font-bold">
              <Users className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Human Resources & Payroll
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-medium border border-cyan-500/30">
                  Section 12
                </span>
              </h1>
              <p className="text-xs text-slate-400">Employee master, shifts, attendance, leaves & automated GL salary runs</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowAttendanceModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-medium text-sm rounded-lg transition"
            >
              <Clock className="w-4 h-4" /> Log Attendance
            </button>
            <button
              onClick={() => setShowPayrollModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm rounded-lg shadow-md transition"
            >
              <DollarSign className="w-4 h-4" /> Run Payroll
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-slate-800/80 mt-3 pt-2 overflow-x-auto scrollbar-none gap-2">
          {[
            { key: 'employees', label: `Staff Directory (${employees.length})`, icon: Users },
            { key: 'attendance', label: `Daily Attendance (${attendances.length})`, icon: Clock },
            { key: 'leaves', label: `Leave Requests (${leaveRequests.length})`, icon: Calendar },
            { key: 'payroll', label: `Payroll Runs (${payrollRuns.length})`, icon: DollarSign }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-3.5 py-2 font-semibold text-xs rounded-lg transition ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 space-y-4">
        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="p-3 bg-rose-950/80 border border-rose-800/80 text-rose-200 rounded-lg text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-rose-400 font-bold ml-3">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-800/80 text-emerald-200 rounded-lg text-sm flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-400 font-bold ml-3">✕</button>
          </div>
        )}

        {/* TAB 1: EMPLOYEES */}
        {activeTab === 'employees' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Employee Master List</h3>
              <button
                onClick={() => setShowEmployeeModal(true)}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add Employee
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {employees.map((emp) => (
                <div
                  key={emp.id}
                  className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{emp.firstName} {emp.lastName}</h4>
                      <p className="text-xs text-cyan-400 font-medium">{emp.designation}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                      {emp.status}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-xs space-y-1 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Employee Code:</span>
                      <span className="font-mono font-bold text-slate-200">{emp.employeeCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Department:</span>
                      <span className="text-slate-200">{emp.department?.name || 'General'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Basic Salary:</span>
                      <span className="font-mono font-bold text-emerald-400">{formatINR(emp.basicSalary)}/mo</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Daily Attendance Log</h3>
              <button
                onClick={() => setShowAttendanceModal(true)}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Log Shift Attendance
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Work Hours</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {attendances.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-semibold text-white">
                        {att.employee?.firstName} {att.employee?.lastName} ({att.employee?.employeeCode})
                      </td>
                      <td className="px-4 py-3">{formatDateIN(att.date)}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-500/20 text-emerald-300">
                          {att.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{att.workHours || 8} hrs</td>
                      <td className="px-4 py-3 text-slate-500">{att.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: LEAVES */}
        {activeTab === 'leaves' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Leave Requests & Approvals</h3>
              <button
                onClick={() => setShowLeaveModal(true)}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Request Leave
              </button>
            </div>

            <div className="space-y-2.5">
              {leaveRequests.map((lr) => (
                <div
                  key={lr.id}
                  className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <h4 className="font-bold text-white text-sm">
                      {lr.employee?.firstName} {lr.employee?.lastName} • {lr.leaveType?.name}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDateIN(lr.startDate)} to {formatDateIN(lr.endDate)} ({lr.totalDays} days) — Reason: {lr.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${
                      lr.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' :
                      lr.status === 'PENDING' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {lr.status}
                    </span>
                    {lr.status === 'PENDING' && (
                      <button
                        onClick={async () => {
                          await hrApi.actOnLeaveRequest(lr.id, { status: 'APPROVED' });
                          showToast('Leave approved!');
                          loadData();
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded"
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: PAYROLL */}
        {activeTab === 'payroll' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Monthly Payroll Runs & Payslips</h3>
              <button
                onClick={() => setShowPayrollModal(true)}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1"
              >
                <DollarSign className="w-4 h-4" /> Process Salary Run
              </button>
            </div>

            <div className="space-y-3">
              {payrollRuns.map((pr) => (
                <div
                  key={pr.id}
                  className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div>
                      <span className="font-bold text-white text-sm">{pr.payrollNumber}</span>
                      <span className="text-xs text-slate-400 ml-2">Period: {pr.month}/{pr.year}</span>
                    </div>
                    <div className="text-sm font-bold text-emerald-400 font-mono">
                      Total Disbursed: {formatINR(pr.totalNetSalary)}
                    </div>
                  </div>

                  {pr.payslips && pr.payslips.length > 0 && (
                    <div className="bg-slate-950 rounded-xl p-3 divide-y divide-slate-800/60 text-xs">
                      {pr.payslips.map((ps) => (
                        <div key={ps.id} className="py-1.5 flex items-center justify-between text-slate-300">
                          <span>{ps.employee?.firstName} {ps.employee?.lastName} ({ps.employee?.designation})</span>
                          <span className="font-mono font-bold text-emerald-400">{formatINR(ps.netSalary)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {/* 1. Add Employee Modal */}
      {showEmployeeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Create Employee Profile</h3>
            <form onSubmit={handleCreateEmployee} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">First Name *</label>
                  <input
                    type="text"
                    value={newEmployeeForm.firstName}
                    onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, firstName: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={newEmployeeForm.lastName}
                    onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, lastName: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Designation / Role *</label>
                <input
                  type="text"
                  placeholder="e.g. Front Desk Lead / Pastry Chef"
                  value={newEmployeeForm.designation}
                  onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, designation: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Department</label>
                  <select
                    value={newEmployeeForm.departmentId}
                    onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, departmentId: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Basic Salary (₹/month) *</label>
                  <input
                    type="number"
                    value={newEmployeeForm.basicSalary}
                    onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, basicSalary: Number(e.target.value) })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs rounded-lg font-bold"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Run Payroll Modal */}
      {showPayrollModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Process Monthly Payroll</h3>
            <p className="text-xs text-slate-400">
              Generates individual payslips for all active employees and posts double-entry salary expense journal to General Ledger.
            </p>
            <form onSubmit={handleExecutePayroll} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Month</label>
                  <select
                    value={payrollRunForm.month}
                    onChange={(e) => setPayrollRunForm({ ...payrollRunForm, month: Number(e.target.value) })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>Month {m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Year</label>
                  <input
                    type="number"
                    value={payrollRunForm.year}
                    onChange={(e) => setPayrollRunForm({ ...payrollRunForm, year: Number(e.target.value) })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPayrollModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs rounded-lg font-bold"
                >
                  Disburse & Post to GL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Log Attendance Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Record Shift Attendance</h3>
            <form onSubmit={handleRecordAttendance} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Employee *</label>
                <select
                  value={newAttendanceForm.employeeId}
                  onChange={(e) => setNewAttendanceForm({ ...newAttendanceForm, employeeId: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Date</label>
                  <input
                    type="date"
                    value={newAttendanceForm.date}
                    onChange={(e) => setNewAttendanceForm({ ...newAttendanceForm, date: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Status</label>
                  <select
                    value={newAttendanceForm.status}
                    onChange={(e) => setNewAttendanceForm({ ...newAttendanceForm, status: e.target.value as any })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  >
                    <option value="PRESENT">Present</option>
                    <option value="LATE">Late</option>
                    <option value="HALF_DAY">Half Day</option>
                    <option value="ABSENT">Absent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Work Hours</label>
                  <input
                    type="number"
                    value={newAttendanceForm.workHours}
                    onChange={(e) => setNewAttendanceForm({ ...newAttendanceForm, workHours: Number(e.target.value) })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Shift</label>
                  <select
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  >
                    <option value="">Standard Shift</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAttendanceModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs rounded-lg font-bold"
                >
                  Save Attendance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Request Leave Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Submit Leave Request</h3>
            <form onSubmit={handleCreateLeave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Employee *</label>
                  <select
                    value={newLeaveForm.employeeId}
                    onChange={(e) => setNewLeaveForm({ ...newLeaveForm, employeeId: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                    required
                  >
                    <option value="">Select Employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Leave Type *</label>
                  <select
                    value={newLeaveForm.leaveTypeId}
                    onChange={(e) => setNewLeaveForm({ ...newLeaveForm, leaveTypeId: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                    required
                  >
                    <option value="">Select Type</option>
                    {leaveTypes.map((lt) => (
                      <option key={lt.id} value={lt.id}>{lt.name} ({lt.daysAllowed}d)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={newLeaveForm.startDate}
                    onChange={(e) => setNewLeaveForm({ ...newLeaveForm, startDate: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">End Date *</label>
                  <input
                    type="date"
                    value={newLeaveForm.endDate}
                    onChange={(e) => setNewLeaveForm({ ...newLeaveForm, endDate: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Reason *</label>
                <input
                  type="text"
                  placeholder="e.g. Annual Vacation / Personal Leave"
                  value={newLeaveForm.reason}
                  onChange={(e) => setNewLeaveForm({ ...newLeaveForm, reason: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs rounded-lg font-bold"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
