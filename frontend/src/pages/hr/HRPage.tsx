import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  Calendar,
  DollarSign,
  Plus,
  Crown,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  UserPlus,
  Briefcase
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
      showToast(`Staff profile for ${newEmployeeForm.firstName} ${newEmployeeForm.lastName} created!`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create employee profile');
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
      showToast('Shift attendance logged successfully!');
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
      showToast('Leave request submitted for authorization!');
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
      showToast(`Payroll #${res.payrollNumber} executed and posted to General Ledger!`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to process payroll run');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 select-none">
      <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4a437] to-[#996f1b] flex items-center justify-center text-black shadow-lg shadow-[#d4a437]/20 border border-[#d4a437]/40">
            <Crown className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide uppercase">
                Staff & Automated Payroll
              </h1>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#d4a437]/15 text-[#d4a437] font-semibold border border-[#d4a437]/30 tracking-wider">
                HR Governance
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Employee Master Directory, Shifts, Daily Attendance, Leave Approvals & Double-Entry Salary Runs
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap">
          <button
            onClick={() => setShowAttendanceModal(true)}
            className="flex items-center space-x-2 px-3.5 py-2 bg-[#202026] hover:bg-[#282832] text-neutral-200 border border-white/[0.08] hover:border-white/[0.15] font-semibold text-xs rounded-xl transition-all shadow-sm active:scale-95"
          >
            <Clock className="w-4 h-4 text-[#d4a437]" />
            <span>Log Shift Attendance</span>
          </button>
          <button
            onClick={() => setShowPayrollModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-[#d4a437]/20 transition-all active:scale-95"
          >
            <DollarSign className="w-4 h-4" />
            <span>Run Monthly Payroll</span>
          </button>
        </div>
      </div>

      <div className="flex border-b border-white/[0.08] pb-2 overflow-x-auto gap-2">
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
              className={`flex items-center space-x-2 px-4 py-2.5 font-semibold text-xs rounded-xl transition-all ${
                isActive
                  ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <div className="p-4 bg-[#e5544d]/10 border border-[#e5544d]/25 text-[#e5544d] rounded-2xl text-xs flex items-center justify-between font-medium">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-[#e5544d] hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-[#3fbf6f]/10 border border-[#3fbf6f]/25 text-[#3fbf6f] rounded-2xl text-xs flex items-center justify-between font-medium">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-[#3fbf6f] hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Employee Directory</h3>
            <button
              onClick={() => setShowEmployeeModal(true)}
              className="px-3.5 py-1.5 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center space-x-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Staff Profile</span>
            </button>
          </div>

          {employees.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map((emp) => (
                <div
                  key={emp.id}
                  className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-xl space-y-3.5 hover:border-white/[0.14] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{emp.firstName} {emp.lastName}</h4>
                      <p className="text-xs text-[#d4a437] font-medium">{emp.designation}</p>
                    </div>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#3fbf6f]/15 text-[#3fbf6f] font-bold border border-[#3fbf6f]/25 uppercase tracking-wider">
                      {emp.status}
                    </span>
                  </div>

                  <div className="bg-[#0c0c0e] p-3 rounded-2xl border border-white/[0.05] text-xs space-y-1.5 text-neutral-300">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Employee Code:</span>
                      <span className="font-mono font-bold text-neutral-200">{emp.employeeCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Department:</span>
                      <span className="text-neutral-200 font-medium">{emp.department?.name || 'Operations'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Basic Salary:</span>
                      <span className="font-mono font-bold text-[#3fbf6f]">{formatINR(emp.basicSalary)}/mo</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center bg-[#17171b] rounded-3xl border border-white/[0.08] space-y-3">
              <UserPlus className="w-10 h-10 text-neutral-500 mx-auto" />
              <h4 className="text-sm font-bold text-white">No Staff Profiles Registered</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Create employee records to begin logging shifts, tracking attendance, and processing monthly salary runs.
              </p>
              <button
                onClick={() => setShowEmployeeModal(true)}
                className="px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md inline-flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Staff Profile</span>
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="bg-[#17171b] rounded-3xl border border-white/[0.08] overflow-hidden shadow-xl">
          <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Daily Attendance Register</h3>
            <button
              onClick={() => setShowAttendanceModal(true)}
              className="px-3.5 py-1.5 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center space-x-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Log Attendance</span>
            </button>
          </div>

          {attendances.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-[#0c0c0e] text-neutral-400 uppercase text-[10px] tracking-wider border-b border-white/[0.06]">
                  <tr>
                    <th className="px-5 py-3.5">Employee</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Hours</th>
                    <th className="px-5 py-3.5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {attendances.map((att) => (
                    <tr key={att.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-white">
                        {att.employee?.firstName} {att.employee?.lastName}
                        <span className="text-neutral-400 font-mono text-[11px] ml-1.5">({att.employee?.employeeCode})</span>
                      </td>
                      <td className="px-5 py-3.5 text-neutral-300">{formatDateIN(att.date)}</td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-[#3fbf6f]/15 text-[#3fbf6f] border border-[#3fbf6f]/25">
                          {att.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono font-medium text-neutral-200">{att.workHours || 8} hrs</td>
                      <td className="px-5 py-3.5 text-neutral-400">{att.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center bg-[#17171b] space-y-3">
              <Clock className="w-10 h-10 text-neutral-500 mx-auto" />
              <h4 className="text-sm font-bold text-white">No Attendance Recorded Today</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Log staff check-in times and shift hours to maintain real-time duty records.
              </p>
              <button
                onClick={() => setShowAttendanceModal(true)}
                className="px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md inline-flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Log Shift Attendance</span>
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Leave Applications</h3>
            <button
              onClick={() => setShowLeaveModal(true)}
              className="px-3.5 py-1.5 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center space-x-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Apply for Leave</span>
            </button>
          </div>

          {leaveRequests.length > 0 ? (
            <div className="space-y-3">
              {leaveRequests.map((lr) => (
                <div
                  key={lr.id}
                  className="bg-[#17171b] p-5 rounded-3xl border border-white/[0.08] shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-white/[0.14] transition-all"
                >
                  <div>
                    <h4 className="font-bold text-white text-sm">
                      {lr.employee?.firstName} {lr.employee?.lastName} • <span className="text-[#d4a437]">{lr.leaveType?.name}</span>
                    </h4>
                    <p className="text-xs text-neutral-400 mt-1">
                      {formatDateIN(lr.startDate)} to {formatDateIN(lr.endDate)} ({lr.totalDays} days) — <span className="text-neutral-300">Reason: {lr.reason}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase border ${
                      lr.status === 'APPROVED' ? 'bg-[#3fbf6f]/15 text-[#3fbf6f] border-[#3fbf6f]/25' :
                      lr.status === 'PENDING' ? 'bg-[#e5a33d]/15 text-[#e5a33d] border-[#e5a33d]/25' :
                      'bg-[#e5544d]/15 text-[#e5544d] border-[#e5544d]/25'
                    }`}>
                      {lr.status}
                    </span>
                    {lr.status === 'PENDING' && (
                      <button
                        onClick={async () => {
                          await hrApi.actOnLeaveRequest(lr.id, { status: 'APPROVED' });
                          showToast('Leave request approved!');
                          loadData();
                        }}
                        className="px-3 py-1 bg-[#3fbf6f] hover:bg-[#349e5c] text-black font-bold text-xs rounded-xl shadow-sm transition-all"
                      >
                        Authorize
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center bg-[#17171b] rounded-3xl border border-white/[0.08] space-y-3">
              <Calendar className="w-10 h-10 text-neutral-500 mx-auto" />
              <h4 className="text-sm font-bold text-white">No Leave Requests</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                No active or pending staff leave applications found in the register.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Payroll Disbursals & Payslips</h3>
            <button
              onClick={() => setShowPayrollModal(true)}
              className="px-3.5 py-1.5 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center space-x-1.5 shadow-sm"
            >
              <DollarSign className="w-4 h-4" />
              <span>Process Salary Run</span>
            </button>
          </div>

          {payrollRuns.length > 0 ? (
            <div className="space-y-4">
              {payrollRuns.map((pr) => (
                <div
                  key={pr.id}
                  className="bg-[#17171b] p-5 sm:p-6 rounded-3xl border border-white/[0.08] shadow-xl space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.06] pb-3 gap-2">
                    <div>
                      <span className="font-bold text-white text-sm font-mono">{pr.payrollNumber}</span>
                      <span className="text-xs text-[#d4a437] font-semibold ml-2.5">
                        Salary Period: Month {pr.month} / {pr.year}
                      </span>
                    </div>
                    <div className="text-sm font-extrabold text-[#3fbf6f] font-mono">
                      Total Disbursed: {formatINR(pr.totalNetSalary)}
                    </div>
                  </div>

                  {pr.payslips && pr.payslips.length > 0 && (
                    <div className="bg-[#0c0c0e] rounded-2xl p-4 divide-y divide-white/[0.06] border border-white/[0.06] text-xs">
                      {pr.payslips.map((ps) => (
                        <div key={ps.id} className="py-2.5 flex items-center justify-between text-neutral-300">
                          <div>
                            <span className="font-semibold text-white">{ps.employee?.firstName} {ps.employee?.lastName}</span>
                            <span className="text-neutral-400 ml-2">({ps.employee?.designation})</span>
                          </div>
                          <span className="font-mono font-bold text-[#3fbf6f]">{formatINR(ps.netSalary)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center bg-[#17171b] rounded-3xl border border-white/[0.08] space-y-3">
              <FileText className="w-10 h-10 text-neutral-500 mx-auto" />
              <h4 className="text-sm font-bold text-white">No Monthly Payroll Runs Processed</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Execute a monthly salary run to calculate net compensation, produce individual employee payslips, and post double-entry salary expense journals.
              </p>
              <button
                onClick={() => setShowPayrollModal(true)}
                className="px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md inline-flex items-center space-x-1.5"
              >
                <DollarSign className="w-4 h-4" />
                <span>Process Salary Run</span>
              </button>
            </div>
          )}
        </div>
      )}

      {showEmployeeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.1] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#d4a437]" /> Create Staff Profile
              </h3>
              <button onClick={() => setShowEmployeeModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateEmployee} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">First Name *</label>
                  <input
                    type="text"
                    value={newEmployeeForm.firstName}
                    onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, firstName: e.target.value })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={newEmployeeForm.lastName}
                    onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, lastName: e.target.value })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">Designation / Role *</label>
                <input
                  type="text"
                  placeholder="e.g. Executive Chef / Front Desk Manager"
                  value={newEmployeeForm.designation}
                  onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, designation: e.target.value })}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">Department</label>
                  <select
                    value={newEmployeeForm.departmentId}
                    onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, departmentId: e.target.value })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">Basic Salary (₹/mo) *</label>
                  <input
                    type="number"
                    value={newEmployeeForm.basicSalary}
                    onChange={(e) => setNewEmployeeForm({ ...newEmployeeForm, basicSalary: Number(e.target.value) })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className="px-4 py-2 bg-[#202026] text-neutral-300 text-xs rounded-xl font-semibold hover:bg-[#282832] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2c] text-black text-xs rounded-xl font-bold uppercase tracking-wider transition-all shadow-md"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPayrollModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.1] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#d4a437]" /> Execute Monthly Payroll Run
              </h3>
              <button onClick={() => setShowPayrollModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Calculates net salary for all active staff, produces individual payslips, and posts double-entry salary expense entries to the General Ledger.
            </p>
            <form onSubmit={handleExecutePayroll} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">Month</label>
                  <select
                    value={payrollRunForm.month}
                    onChange={(e) => setPayrollRunForm({ ...payrollRunForm, month: Number(e.target.value) })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>Month {m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">Year</label>
                  <input
                    type="number"
                    value={payrollRunForm.year}
                    onChange={(e) => setPayrollRunForm({ ...payrollRunForm, year: Number(e.target.value) })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowPayrollModal(false)}
                  className="px-4 py-2 bg-[#202026] text-neutral-300 text-xs rounded-xl font-semibold hover:bg-[#282832] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2c] text-black text-xs rounded-xl font-bold uppercase tracking-wider transition-all shadow-md"
                >
                  Execute & Post to GL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAttendanceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.1] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#d4a437]" /> Log Shift Attendance
              </h3>
              <button onClick={() => setShowAttendanceModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecordAttendance} className="space-y-3.5">
              <div>
                <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">Employee *</label>
                <select
                  value={newAttendanceForm.employeeId}
                  onChange={(e) => setNewAttendanceForm({ ...newAttendanceForm, employeeId: e.target.value })}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none"
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
                  <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">Date</label>
                  <input
                    type="date"
                    value={newAttendanceForm.date}
                    onChange={(e) => setNewAttendanceForm({ ...newAttendanceForm, date: e.target.value })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">Duty Status</label>
                  <select
                    value={newAttendanceForm.status}
                    onChange={(e) => setNewAttendanceForm({ ...newAttendanceForm, status: e.target.value as any })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none"
                  >
                    <option value="PRESENT">Present</option>
                    <option value="LATE">Late Arrival</option>
                    <option value="HALF_DAY">Half Day</option>
                    <option value="ABSENT">Absent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">Work Hours</label>
                  <input
                    type="number"
                    value={newAttendanceForm.workHours}
                    onChange={(e) => setNewAttendanceForm({ ...newAttendanceForm, workHours: Number(e.target.value) })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">Assigned Shift</label>
                  <select
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none"
                  >
                    <option value="">Standard Shift</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowAttendanceModal(false)}
                  className="px-4 py-2 bg-[#202026] text-neutral-300 text-xs rounded-xl font-semibold hover:bg-[#282832] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2c] text-black text-xs rounded-xl font-bold uppercase tracking-wider transition-all shadow-md"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.1] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#d4a437]" /> Submit Leave Application
              </h3>
              <button onClick={() => setShowLeaveModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateLeave} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">Employee *</label>
                  <select
                    value={newLeaveForm.employeeId}
                    onChange={(e) => setNewLeaveForm({ ...newLeaveForm, employeeId: e.target.value })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none"
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
                  <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">Leave Type *</label>
                  <select
                    value={newLeaveForm.leaveTypeId}
                    onChange={(e) => setNewLeaveForm({ ...newLeaveForm, leaveTypeId: e.target.value })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none"
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
                  <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={newLeaveForm.startDate}
                    onChange={(e) => setNewLeaveForm({ ...newLeaveForm, startDate: e.target.value })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">End Date *</label>
                  <input
                    type="date"
                    value={newLeaveForm.endDate}
                    onChange={(e) => setNewLeaveForm({ ...newLeaveForm, endDate: e.target.value })}
                    className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider block mb-1">Reason / Notes *</label>
                <input
                  type="text"
                  placeholder="e.g. Annual Vacation / Personal Leave"
                  value={newLeaveForm.reason}
                  onChange={(e) => setNewLeaveForm({ ...newLeaveForm, reason: e.target.value })}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.09] focus:border-[#d4a437] focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 bg-[#202026] text-neutral-300 text-xs rounded-xl font-semibold hover:bg-[#282832] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2c] text-black text-xs rounded-xl font-bold uppercase tracking-wider transition-all shadow-md"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
