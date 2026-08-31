import datetime
from decimal import Decimal
from typing import Optional, List, Union
from pydantic import BaseModel, ConfigDict, Field

# -------------------------------------------------------------
# Shift Schemas
# -------------------------------------------------------------

class ShiftBase(BaseModel):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=50)
    start_time: str = Field(..., max_length=10, description="HH:MM format, e.g. 07:00")
    end_time: str = Field(..., max_length=10, description="HH:MM format, e.g. 15:30")
    grace_period_mins: int = Field(default=15, ge=0)
    is_active: bool = True


class ShiftCreate(ShiftBase):
    branch_id: Optional[str] = None


class ShiftUpdate(BaseModel):
    name: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    grace_period_mins: Optional[int] = None
    is_active: Optional[bool] = None


class ShiftResponse(ShiftBase):
    id: str
    company_id: str
    branch_id: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Attendance Schemas
# -------------------------------------------------------------

class AttendanceBase(BaseModel):
    date: Union[datetime.date, str]
    check_in: Optional[Union[datetime.time, str]] = None
    check_out: Optional[Union[datetime.time, str]] = None
    hours_worked: Decimal = Decimal("0.0000")
    overtime_hours: Decimal = Decimal("0.0000")
    status: str = Field(default="PRESENT", max_length=50)
    notes: Optional[str] = None


class AttendanceCreate(AttendanceBase):
    staff_id: str
    branch_id: Optional[str] = None


class AttendanceUpdate(BaseModel):
    check_in: Optional[Union[datetime.time, str]] = None
    check_out: Optional[Union[datetime.time, str]] = None
    hours_worked: Optional[Decimal] = None
    overtime_hours: Optional[Decimal] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class AttendanceResponse(AttendanceBase):
    id: str
    company_id: str
    branch_id: str
    staff_id: str
    staff_name: Optional[str] = None
    employee_code: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class AttendanceSummaryItem(BaseModel):
    staff_id: str
    staff_name: str
    employee_code: str
    designation: str
    days_present: int
    days_absent: int
    days_late: int
    total_hours: Decimal
    total_overtime: Decimal


class AttendanceSummaryResponse(BaseModel):
    branch_id: Optional[str] = None
    month: int
    year: int
    total_staff: int
    summary: List[AttendanceSummaryItem]


# -------------------------------------------------------------
# Leave Types & Leave Requests Schemas
# -------------------------------------------------------------

class LeaveTypeBase(BaseModel):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=50)
    days_allowed: int = Field(default=14, ge=1)
    is_paid: bool = True


class LeaveTypeCreate(LeaveTypeBase):
    pass


class LeaveTypeResponse(LeaveTypeBase):
    id: str
    company_id: str
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class LeaveRequestBase(BaseModel):
    employee_id: str
    leave_type_id: str
    start_date: Union[datetime.date, str]
    end_date: Union[datetime.date, str]
    total_days: int = Field(default=1, ge=1)
    reason: str


class LeaveRequestCreate(LeaveRequestBase):
    branch_id: Optional[str] = None


class LeaveActionRequest(BaseModel):
    status: str = Field(..., description="APPROVED or REJECTED")
    rejection_reason: Optional[str] = None


class LeaveRequestResponse(LeaveRequestBase):
    id: str
    company_id: str
    branch_id: Optional[str] = None
    status: str
    approved_by_id: Optional[str] = None
    approved_at: Optional[datetime.datetime] = None
    rejection_reason: Optional[str] = None
    leave_type_name: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Payroll Schemas
# -------------------------------------------------------------

class PayrollGenerateRequest(BaseModel):
    branch_id: str
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)
    start_date: Optional[Union[datetime.date, str]] = None
    end_date: Optional[Union[datetime.date, str]] = None
    notes: Optional[str] = None


class PayrollItemResponse(BaseModel):
    id: str
    payroll_id: str
    staff_id: str
    staff_name: Optional[str] = None
    employee_code: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    base_pay: Decimal
    overtime_pay: Decimal
    allowances: Decimal
    deductions: Decimal
    net_pay: Decimal
    days_present: int
    days_absent: int
    notes: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class PayrollResponse(BaseModel):
    id: str
    company_id: str
    branch_id: str
    branch_name: Optional[str] = None
    month: int
    year: int
    start_date: Union[datetime.date, str]
    end_date: Union[datetime.date, str]
    total_gross: Decimal
    total_deductions: Decimal
    total_net: Decimal
    status: str
    processed_by: Optional[str] = None
    notes: Optional[str] = None
    items: List[PayrollItemResponse] = []
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class PayrollStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="DRAFT, REVIEWED, APPROVED, or PAID")
    notes: Optional[str] = None


class PayrollHistorySummary(BaseModel):
    payroll_id: str
    branch_id: str
    branch_name: Optional[str] = None
    period: str
    month: int
    year: int
    total_staff: int
    total_gross: Decimal
    total_deductions: Decimal
    total_net: Decimal
    status: str
