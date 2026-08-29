'use client';

import React, { useState, useEffect } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { apiClient } from '@/api/client';
import {
  Users,
  CalendarCheck,
  DollarSign,
  Briefcase,
  Clock,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Mail,
  Phone,
  ShieldCheck,
  Calendar,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { Badge, Button, StatCard, SearchInput, AlertBanner, EmptyState, Modal } from '@/components/ui';

export const HRWorkspace: React.FC = () => {
  const { activeOutlet, isHeadOffice } = useOutlet();
  const [staff, setStaff] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any | null>(null);
  const [payrollMonth, setPayrollMonth] = useState<number>(new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState<number>(new Date().getFullYear());
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ employee_id: '', leave_type_id: '', start_date: new Date().toISOString().slice(0,10), end_date: new Date().toISOString().slice(0,10), total_days: 1, reason: '' });
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'staff' | 'attendance' | 'leave' | 'payroll'>('staff');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Create Staff Modal State
  const [createStaffModalOpen, setCreateStaffModalOpen] = useState<boolean>(false);
  const [staffForm, setStaffForm] = useState({
    first_name: '',
    last_name: '',
    employee_code: '',
    designation: '',
    department: 'Operations',
    email: '',
    phone: '',
    base_salary: 3000,
    status: 'ACTIVE',
  });
  const [submittingStaff, setSubmittingStaff] = useState<boolean>(false);

  const loadHRData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const targetBranch = isHeadOffice ? undefined : activeOutlet.id;
      const [staffRes, shiftRes, attendanceRes, leaveRes, leaveTypeRes, payrollRes] = await Promise.all([
        apiClient.get('/organization/staff', { params: { branch_id: targetBranch } }).catch(() => ({ data: [] })),
        apiClient.get('/hr/shifts', { params: { branch_id: targetBranch } }).catch(() => ({ data: [] })),
        apiClient.get('/hr/attendance', { params: { branch_id: targetBranch, date: attendanceDate } }).catch(() => ({ data: [] })),
        apiClient.get('/hr/leaves', { params: { branch_id: targetBranch } }).catch(() => ({ data: [] })),
        apiClient.get('/hr/leave-types').catch(() => ({ data: [] })),
        apiClient.get('/hr/payrolls', { params: { branch_id: targetBranch } }).catch(() => ({ data: [] })),
      ]);
      const unwrap = (r: any) => Array.isArray(r.data) ? r.data : r.data?.data || [];
      setStaff(unwrap(staffRes));
      setShifts(unwrap(shiftRes));
      setAttendance(unwrap(attendanceRes));
      setLeaves(unwrap(leaveRes));
      setLeaveTypes(unwrap(leaveTypeRes));
      const payrollList = unwrap(payrollRes);
      setPayroll(payrollList.find((p:any) => Number(p.month) === payrollMonth && Number(p.year) === payrollYear) || payrollList[0] || null);
    } catch (err: any) {
      setStaff([]);
      setShifts([]);
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to load HR and shift records',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHRData();
  }, [activeOutlet.id, attendanceDate, payrollMonth, payrollYear]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.first_name || !staffForm.last_name || !staffForm.employee_code) {
      setFeedback({ type: 'error', message: 'Please fill in all required employee fields.' });
      return;
    }
    setSubmittingStaff(true);
    try {
      await apiClient.post('/organization/staff', {
        ...staffForm,
        branch_id: activeOutlet.id,
        base_salary: Number(staffForm.base_salary),
      });
      setFeedback({ type: 'success', message: `Staff member ${staffForm.first_name} ${staffForm.last_name} registered successfully.` });
      setCreateStaffModalOpen(false);
      setStaffForm({
        first_name: '',
        last_name: '',
        employee_code: '',
        designation: '',
        department: 'Operations',
        email: '',
        phone: '',
        base_salary: 3000,
        status: 'ACTIVE',
      });
      loadHRData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to register staff member' });
    } finally {
      setSubmittingStaff(false);
    }
  };

  const recordAttendance = async (staffId: string, status: string) => {
    try {
      await apiClient.post('/hr/attendance', { staff_id: staffId, branch_id: activeOutlet.id, date: attendanceDate, status, hours_worked: status === 'PRESENT' ? 8 : 0, overtime_hours: 0 });
      setFeedback({ type: 'success', message: 'Attendance recorded.' });
      loadHRData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Failed to record attendance.' });
    }
  };

  const submitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.employee_id || !leaveForm.leave_type_id || !leaveForm.reason) {
      setFeedback({ type: 'error', message: 'Employee, leave type and reason are required.' });
      return;
    }
    try {
      await apiClient.post('/hr/leaves', { ...leaveForm, branch_id: activeOutlet.id, total_days: Number(leaveForm.total_days) });
      setLeaveModalOpen(false);
      setFeedback({ type: 'success', message: 'Leave request submitted.' });
      loadHRData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Failed to submit leave request.' });
    }
  };

  const actOnLeave = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await apiClient.put(`/hr/leaves/${id}`, { status });
      setFeedback({ type: 'success', message: `Leave request ${status.toLowerCase()}.` });
      loadHRData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Failed to update leave request.' });
    }
  };

  const generatePayroll = async () => {
    try {
      const res = await apiClient.post('/hr/payrolls/generate', { branch_id: activeOutlet.id, month: payrollMonth, year: payrollYear });
      setPayroll(res.data);
      setFeedback({ type: 'success', message: `Payroll generated for ${String(payrollMonth).padStart(2,'0')}/${payrollYear}.` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Failed to generate payroll.' });
    }
  };

  const filteredStaff = staff.filter((s) =>
    `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.employee_code || s.employeeCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.designation || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeStaffCount = staff.filter((s) => s.is_active || s.status === 'ACTIVE').length;
  const totalPayrollEstimate = staff.reduce((acc, s) => acc + Number(s.base_salary || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#C79A3B]" />
              HR, Shifts & Payroll Engine
            </h2>
            <Badge variant="outlet">[{activeOutlet.code}]</Badge>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Manage employee rosters, shift attendance scheduling, overtime policies, and automated monthly payroll runs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadHRData}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5 text-[#C79A3B]" />}
          >
            Sync Data
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateStaffModalOpen(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Register Personnel
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      <AlertBanner feedback={feedback} onClose={() => setFeedback(null)} />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Personnel"
          value={staff.length}
          subtitle={`${activeStaffCount} Active on Roster`}
          icon={<Users className="w-4 h-4 text-[#C79A3B]" />}
          iconBgColor="bg-[#FAF8F5] text-[#C79A3B]"
        />

        <StatCard
          title="Active Shifts"
          value={shifts.length || '3 Shifts'}
          subtitle="Morning, Evening, Night"
          icon={<Clock className="w-4 h-4 text-[#3978B8]" />}
          iconBgColor="bg-blue-50 text-[#3978B8]"
        />

        <StatCard
          title="Attendance Engine"
          value="100%"
          subtitle="Live Check-in & Overtime"
          icon={<CalendarCheck className="w-4 h-4 text-[#2E8B57]" />}
          iconBgColor="bg-[#2E8B57]/10 text-[#2E8B57]"
        />

        <StatCard
          title="Est. Monthly Payroll"
          value={`$${totalPayrollEstimate.toLocaleString()}`}
          subtitle="Decimal(14,2) Exact Math"
          icon={<DollarSign className="w-4 h-4 text-[#B8862D]" />}
          iconBgColor="bg-[#F1E4C5]/40 text-[#B8862D]"
        />
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl shadow-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'staff'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Master Roster</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[rgba(45,45,45,0.08)] text-[#1C1C1C]">
            {staff.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'attendance'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Attendance</span>
        </button>

        <button
          onClick={() => setActiveTab('leave')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'leave'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Leave</span>
          {leaves.filter(l=>l.status==='PENDING').length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700">{leaves.filter(l=>l.status==='PENDING').length}</span>}
        </button>

        <button
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'payroll'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Monthly Payroll Run</span>
        </button>
      </div>

      {/* TAB 1: STAFF MASTER ROSTER */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">
              Staff Members Assigned to [{activeOutlet.code}] ({filteredStaff.length})
            </h3>
            <SearchInput
              value={searchQuery}
              onChangeValue={setSearchQuery}
              placeholder="Search by name, code, designation..."
              className="w-full sm:w-72"
            />
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
              <span>Loading staff roster from database...</span>
            </div>
          ) : filteredStaff.length === 0 ? (
            <EmptyState
              title="No Staff Records Found"
              description={`No personnel match your search query for ${activeOutlet.name}.`}
              icon={<Users className="w-6 h-6" />}
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCreateStaffModalOpen(true)}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Register First Staff
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaff.map((s) => (
                <div
                  key={s.id}
                  className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-3 hover:border-[#C79A3B]/30 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-[#1C1C1C] font-['Outfit']">
                          {s.first_name} {s.last_name}
                        </h4>
                        <p className="text-xs text-[#707070] font-medium">{s.designation || 'Staff Member'}</p>
                      </div>
                      <Badge variant="outlet">{s.employee_code || s.employeeCode}</Badge>
                    </div>

                    <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] text-xs text-[#707070] space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Department:</span>
                        <strong className="text-[#1C1C1C]">{s.department || 'Operations'}</strong>
                      </div>
                      {s.email && (
                        <div className="flex items-center justify-between truncate">
                          <span>Email:</span>
                          <span className="text-[#1C1C1C] font-mono truncate">{s.email}</span>
                        </div>
                      )}
                      {s.phone && (
                        <div className="flex items-center justify-between">
                          <span>Phone:</span>
                          <span className="text-[#1C1C1C] font-mono">{s.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[rgba(45,45,45,0.06)] flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-[#707070] block">Base Compensation</span>
                      <span className="font-mono text-sm font-bold text-[#2E8B57]">
                        ${Number(s.base_salary || 0).toFixed(2)}/mo
                      </span>
                    </div>
                    <Badge variant={s.status === 'ACTIVE' || s.is_active ? 'success' : 'neutral'}>
                      {s.status || 'ACTIVE'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div><h3 className="text-sm font-bold text-[#1C1C1C]">Daily Attendance</h3><p className="text-xs text-[#707070]">Record present, absent, half-day or late status per employee.</p></div>
              <input type="date" value={attendanceDate} onChange={e=>setAttendanceDate(e.target.value)} className="px-3 py-2 rounded-xl border text-xs" />
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs"><thead><tr className="bg-[#FAF8F5]"><th className="p-3 text-left">Employee</th><th className="p-3 text-left">Existing</th><th className="p-3 text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">{staff.map(s=>{const a=attendance.find(x=>x.staff_id===s.id); return <tr key={s.id}><td className="p-3 font-semibold">{s.first_name} {s.last_name}<span className="block text-[10px] text-[#707070]">{s.employee_code}</span></td><td className="p-3"><Badge variant={a?.status==='ABSENT'?'danger':a?'success':'neutral'}>{a?.status || 'NOT RECORDED'}</Badge></td><td className="p-3 text-right flex gap-1 justify-end">{['PRESENT','ABSENT','HALF_DAY','LATE'].map(st=><Button key={st} size="sm" variant={st==='PRESENT'?'primary':'secondary'} onClick={()=>recordAttendance(s.id,st)}>{st.replace('_',' ')}</Button>)}</td></tr>})}</tbody></table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LEAVE */}
      {activeTab === 'leave' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between"><div><h3 className="text-sm font-bold text-[#1C1C1C]">Leave Management</h3><p className="text-xs text-[#707070]">Submit and approve employee leave requests.</p></div><Button variant="primary" size="sm" onClick={()=>setLeaveModalOpen(true)} icon={<Plus className="w-3.5 h-3.5"/>}>New Leave</Button></div>
          <div className="grid gap-3">{leaves.length===0?<EmptyState title="No Leave Requests" description="No leave requests found for this outlet." icon={<Calendar className="w-6 h-6"/>}/>:leaves.map(l=><div key={l.id} className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><div className="font-bold text-sm">{l.leave_type_name || 'Leave'} <Badge variant="outlet">{l.status}</Badge></div><div className="text-xs text-[#707070] mt-1">Employee: {staff.find(s=>s.id===l.employee_id)?.first_name || l.employee_id} · {l.start_date} → {l.end_date} · {l.total_days} day(s)</div><div className="text-xs mt-1">{l.reason}</div></div>{l.status==='PENDING'&&<div className="flex gap-2"><Button size="sm" variant="primary" onClick={()=>actOnLeave(l.id,'APPROVED')}>Approve</Button><Button size="sm" variant="danger" onClick={()=>actOnLeave(l.id,'REJECTED')}>Reject</Button></div>}</div>)}</div>
        </div>
      )}

      {/* TAB 4: PAYROLL */}
      {activeTab === 'payroll' && (
        <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3"><div><h3 className="text-sm font-bold text-[#1C1C1C]">Monthly Payroll Run</h3><p className="text-xs text-[#707070]">Generate deterministic payroll from active staff and recorded overtime.</p></div><div className="flex gap-2"><select value={payrollMonth} onChange={e=>setPayrollMonth(Number(e.target.value))} className="px-3 py-2 rounded-xl border text-xs">{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{String(i+1).padStart(2,'0')}</option>)}</select><input type="number" value={payrollYear} onChange={e=>setPayrollYear(Number(e.target.value))} className="w-24 px-3 py-2 rounded-xl border text-xs"/><Button variant="gold" size="sm" onClick={generatePayroll} icon={<FileSpreadsheet className="w-3.5 h-3.5"/>}>Generate</Button></div></div>
          {payroll ? <><div className="grid grid-cols-3 gap-3"><StatCard title="Gross" value={`$${Number(payroll.total_gross||0).toFixed(2)}`} subtitle={payroll.status} icon={<DollarSign className="w-4 h-4"/>}/><StatCard title="Deductions" value={`$${Number(payroll.total_deductions||0).toFixed(2)}`} subtitle="Payroll deductions" icon={<DollarSign className="w-4 h-4"/>}/><StatCard title="Net" value={`$${Number(payroll.total_net||0).toFixed(2)}`} subtitle={`${payroll.items?.length||0} employees`} icon={<Users className="w-4 h-4"/>}/></div><div className="overflow-x-auto rounded-2xl border"><table className="w-full text-xs"><thead><tr className="bg-[#FAF8F5]"><th className="p-3 text-left">Employee</th><th className="p-3 text-right">Base</th><th className="p-3 text-right">OT</th><th className="p-3 text-right">Net</th><th className="p-3">Attendance</th></tr></thead><tbody className="divide-y">{(payroll.items||[]).map((i:any)=><tr key={i.id}><td className="p-3 font-semibold">{i.staff_name}<span className="block text-[10px] text-[#707070]">{i.employee_code}</span></td><td className="p-3 text-right">${Number(i.base_pay||0).toFixed(2)}</td><td className="p-3 text-right">${Number(i.overtime_pay||0).toFixed(2)}</td><td className="p-3 text-right font-bold">${Number(i.net_pay||0).toFixed(2)}</td><td className="p-3">{i.days_present} present / {i.days_absent} absent</td></tr>)}</tbody></table></div></> : <EmptyState title="No Payroll Run Loaded" description="Select month/year and generate the payroll calculation." icon={<DollarSign className="w-6 h-6"/>}/>}
        </div>
      )}

      {/* Leave Modal */}
      <Modal isOpen={leaveModalOpen} onClose={()=>setLeaveModalOpen(false)} title="Submit Leave Request" icon={<Calendar className="w-5 h-5 text-[#C79A3B]"/>}>
        <form onSubmit={submitLeave} className="space-y-3">
          <select value={leaveForm.employee_id} onChange={e=>setLeaveForm({...leaveForm,employee_id:e.target.value})} className="w-full px-3 py-2 rounded-xl border text-xs"><option value="">Select employee</option>{staff.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.employee_code})</option>)}</select>
          <select value={leaveForm.leave_type_id} onChange={e=>setLeaveForm({...leaveForm,leave_type_id:e.target.value})} className="w-full px-3 py-2 rounded-xl border text-xs"><option value="">Select leave type</option>{leaveTypes.map(t=><option key={t.id} value={t.id}>{t.name} · {t.is_paid?'Paid':'Unpaid'}</option>)}</select>
          <div className="grid grid-cols-2 gap-2"><input type="date" value={leaveForm.start_date} onChange={e=>setLeaveForm({...leaveForm,start_date:e.target.value})} className="px-3 py-2 rounded-xl border text-xs"/><input type="date" value={leaveForm.end_date} onChange={e=>setLeaveForm({...leaveForm,end_date:e.target.value})} className="px-3 py-2 rounded-xl border text-xs"/></div>
          <input type="number" min="1" value={leaveForm.total_days} onChange={e=>setLeaveForm({...leaveForm,total_days:Number(e.target.value)||1})} className="w-full px-3 py-2 rounded-xl border text-xs" placeholder="Total days"/>
          <textarea value={leaveForm.reason} onChange={e=>setLeaveForm({...leaveForm,reason:e.target.value})} className="w-full px-3 py-2 rounded-xl border text-xs" rows={3} placeholder="Reason"/>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" size="sm" onClick={()=>setLeaveModalOpen(false)}>Cancel</Button><Button type="submit" variant="primary" size="sm">Submit Request</Button></div>
        </form>
      </Modal>

      {/* Modal: Register Personnel */}
      <Modal
        isOpen={createStaffModalOpen}
        onClose={() => setCreateStaffModalOpen(false)}
        title={`Register Staff Member (${activeOutlet.name})`}
        icon={<Users className="w-5 h-5 text-[#C79A3B]" />}
      >
        <form onSubmit={handleCreateStaff} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                First Name *
              </label>
              <input
                type="text"
                required
                value={staffForm.first_name}
                onChange={(e) => setStaffForm({ ...staffForm, first_name: e.target.value })}
                placeholder="e.g. John"
                className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={staffForm.last_name}
                onChange={(e) => setStaffForm({ ...staffForm, last_name: e.target.value })}
                placeholder="e.g. Doe"
                className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                Employee Code *
              </label>
              <input
                type="text"
                required
                value={staffForm.employee_code}
                onChange={(e) => setStaffForm({ ...staffForm, employee_code: e.target.value })}
                placeholder="e.g. EMP-088"
                className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs font-mono text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                Designation
              </label>
              <input
                type="text"
                value={staffForm.designation}
                onChange={(e) => setStaffForm({ ...staffForm, designation: e.target.value })}
                placeholder="e.g. Sous Chef, Waiter"
                className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                Department
              </label>
              <select
                value={staffForm.department}
                onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B]"
              >
                <option value="Kitchen">Kitchen</option>
                <option value="Service">Service / Front of House</option>
                <option value="Bar">Bar & Beverage</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Procurement">Procurement & Store</option>
                <option value="Management">Management</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                Base Monthly Salary ($)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={staffForm.base_salary}
                onChange={(e) => setStaffForm({ ...staffForm, base_salary: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs font-mono text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                Email Address
              </label>
              <input
                type="email"
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                placeholder="staff@hotel.com"
                className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                Phone Number
              </label>
              <input
                type="tel"
                value={staffForm.phone}
                onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                placeholder="+1 555 0192"
                className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[rgba(45,45,45,0.06)]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCreateStaffModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submittingStaff}
            >
              Save & Register
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default HRWorkspace;
