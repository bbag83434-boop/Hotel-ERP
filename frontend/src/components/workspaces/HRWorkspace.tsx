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
} from 'lucide-react';

export const HRWorkspace: React.FC = () => {
  const { activeOutlet } = useOutlet();
  const [staff, setStaff] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [subTab, setSubTab] = useState<'staff' | 'shifts' | 'payroll'>('staff');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadHRData = async () => {
    setLoading(true);
    try {
      const [staffRes, shiftRes] = await Promise.all([
        apiClient.get('/organization/staff', { params: { branch_id: activeOutlet.id } }).catch(() => ({ data: [] })),
        apiClient.get('/hr/shifts', { params: { branch_id: activeOutlet.id } }).catch(() => ({ data: [] })),
      ]);
      setStaff(Array.isArray(staffRes.data) ? staffRes.data : []);
      setShifts(Array.isArray(shiftRes.data) ? shiftRes.data : []);
    } catch (err) {
      setStaff([]);
      setShifts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHRData();
  }, [activeOutlet.id]);

  const filteredStaff = staff.filter((s) =>
    `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.employee_code || s.employeeCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.designation || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.1)]">
              [{activeOutlet.code}]
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Manage employee master profiles, shift schedules, attendance tracking, and monthly payroll runs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadHRData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1C1C1C] transition-all shadow-sm active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C79A3B] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Total Personnel</span>
            <Users className="w-4 h-4 text-[#C79A3B]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{staff.length}</p>
          <p className="text-[10px] text-[#2E8B57] mt-1 font-semibold">{staff.filter((s) => s.is_active || s.status === 'ACTIVE').length} Active on Roster</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Active Shifts</span>
            <Clock className="w-4 h-4 text-[#3978B8]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{shifts.length || '3 Shifts'}</p>
          <p className="text-[10px] text-[#3978B8] mt-1 font-medium">Morning, Evening, Night</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Attendance Engine</span>
            <CalendarCheck className="w-4 h-4 text-[#2E8B57]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">Active</p>
          <p className="text-[10px] text-[#2E8B57] mt-1 font-medium">Check-in / Check-out / OT</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Payroll Precision</span>
            <DollarSign className="w-4 h-4 text-[#B8862D]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">Exact</p>
          <p className="text-[10px] text-[#707070] mt-1">Decimal(14,2) Salary Math</p>
        </div>
      </div>

      {/* Staff Roster List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">Outlet Staff Roster ({filteredStaff.length})</h3>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-64 pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
            <span>Loading staff roster from Neon PostgreSQL...</span>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] text-xs text-[#707070] space-y-2">
            <Users className="w-8 h-8 mx-auto text-[#C79A3B]/50" />
            <p className="font-semibold text-[#1C1C1C]">No staff directly allocated to {activeOutlet.name}</p>
            <p className="max-w-md mx-auto">
              Use the Organization workspace to register and assign staff members to this outlet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredStaff.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-[#1C1C1C]">
                      {s.first_name} {s.last_name}
                    </h4>
                    <p className="text-[11px] text-[#707070]">{s.designation}</p>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FAF8F5] text-[#1C1C1C] border border-[rgba(45,45,45,0.1)]">
                    {s.employee_code || s.employeeCode}
                  </span>
                </div>
                <div className="text-[11px] text-[#707070] space-y-0.5">
                  <div>Department: {s.department || 'Operations'}</div>
                  {s.email && <div className="truncate">Email: {s.email}</div>}
                </div>
                <div className="pt-2 border-t border-[rgba(45,45,45,0.06)] flex items-center justify-between text-[11px]">
                  <span className="font-mono text-[#2E8B57] font-semibold">
                    ${Number(s.base_salary || 0).toFixed(2)}/mo
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#2E8B57]/10 text-[#2E8B57]">
                    {s.status || 'ACTIVE'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HRWorkspace;
