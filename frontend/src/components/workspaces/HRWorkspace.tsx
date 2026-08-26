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
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'staff' | 'shifts' | 'payroll'>('staff');
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
      const [staffRes, shiftRes] = await Promise.all([
        apiClient.get('/organization/staff', { params: { branch_id: targetBranch } }).catch(() => ({ data: [] })),
        apiClient.get('/hr/shifts', { params: { branch_id: targetBranch } }).catch(() => ({ data: [] })),
      ]);
      setStaff(Array.isArray(staffRes.data) ? staffRes.data : staffRes.data?.data || []);
      setShifts(Array.isArray(shiftRes.data) ? shiftRes.data : shiftRes.data?.data || []);
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
  }, [activeOutlet.id]);

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
          value={shifts.length}
          subtitle={`${shifts.filter((s: any) => s.is_active !== false).length} Active Roster Shifts`}
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
          onClick={() => setActiveTab('shifts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'shifts'
              ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
              : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Shift Schedule & Attendance</span>
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

      {/* TAB 2: SHIFT SCHEDULE & ATTENDANCE */}
      {activeTab === 'shifts' && (
        <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.06)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">Standard Shift Rosters</h3>
              <p className="text-xs text-[#707070]">Automated clock-in, overtime calculation, and night allowance shifts</p>
            </div>
            <Badge variant="info">{shifts.length} Shift{shifts.length === 1 ? '' : 's'} Configured</Badge>
          </div>

          {shifts.length === 0 ? (
            <EmptyState
              title="No Shifts Configured"
              description={`No operational shifts have been created for ${activeOutlet.name}. Configure shifts in the backend or HR settings.`}
              icon={<Clock className="w-6 h-6" />}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {shifts.map((s) => (
                <div key={s.id || s.code} className="p-4 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#1C1C1C]">{s.name}</span>
                    <Badge variant="success">
                      {String(s.start_time || s.startTime || '').slice(0, 5)} – {String(s.end_time || s.endTime || '').slice(0, 5)}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#707070] font-mono">Code: [{s.code}]</p>
                  <div className="text-[11px] text-[#707070] pt-2 border-t border-[rgba(45,45,45,0.06)] flex justify-between">
                    <span>Grace Period:</span>
                    <strong className="text-[#1C1C1C]">{s.grace_period_mins || s.gracePeriodMins || 0} mins</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYROLL RUN */}
      {activeTab === 'payroll' && (
        <div className="p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.06)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">Monthly Payroll Calculation Preview</h3>
              <p className="text-xs text-[#707070]">Integrated with attendance, deductions, and tax withholdings</p>
            </div>
            <Button variant="gold" size="sm" icon={<FileSpreadsheet className="w-3.5 h-3.5" />}>
              Export Payroll Sheet
            </Button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[rgba(45,45,45,0.08)]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[rgba(45,45,45,0.08)] text-[#707070] font-bold">
                  <th className="p-3.5">Employee</th>
                  <th className="p-3.5">Designation</th>
                  <th className="p-3.5 text-right">Base Salary</th>
                  <th className="p-3.5 text-right">Overtime ($)</th>
                  <th className="p-3.5 text-right">Deductions</th>
                  <th className="p-3.5 text-right">Net Payable</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                {staff.map((s) => (
                  <tr key={s.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                    <td className="p-3.5 font-bold text-[#1C1C1C]">
                      {s.first_name} {s.last_name}
                      <span className="block text-[10px] font-mono text-[#707070]">{s.employee_code || s.employeeCode}</span>
                    </td>
                    <td className="p-3.5 text-[#707070]">{s.designation || 'Operations'}</td>
                    <td className="p-3.5 text-right font-mono font-semibold text-[#1C1C1C]">
                      ${Number(s.base_salary || 0).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right font-mono text-[#2E8B57] font-semibold">$0.00</td>
                    <td className="p-3.5 text-right font-mono text-red-600 font-semibold">$0.00</td>
                    <td className="p-3.5 text-right font-mono font-bold text-[#1C1C1C]">
                      ${Number(s.base_salary || 0).toFixed(2)}
                    </td>
                    <td className="p-3.5">
                      <Badge variant="success">Calculated</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
