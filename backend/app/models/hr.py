import enum
from decimal import Decimal
from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, Enum, Date, Time, Text, Integer, Index
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class StaffStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ON_LEAVE = "ON_LEAVE"
    TERMINATED = "TERMINATED"

class AttendanceStatus(str, enum.Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    HALF_DAY = "HALF_DAY"
    LATE = "LATE"
    ON_LEAVE = "ON_LEAVE"

class PayrollStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    REVIEWED = "REVIEWED"
    APPROVED = "APPROVED"
    PAID = "PAID"

class Staff(BaseModel):
    __tablename__ = "staff"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column("userId", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, unique=True)
    
    employee_code = Column("employeeCode", String(50), nullable=False, index=True)
    first_name = Column("firstName", String(100), nullable=False)
    last_name = Column("lastName", String(100), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    designation = Column(String(100), nullable=False)
    department = Column(String(100), nullable=True)
    
    joining_date = Column("joiningDate", Date, nullable=False)
    base_salary = Column("baseSalary", Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    hourly_rate = Column("hourlyRate", Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    status = Column(String(50), default="ACTIVE", nullable=False)
    is_active = Column("isActive", Boolean, default=True, nullable=False)

    attendances = relationship("Attendance", back_populates="staff", cascade="all, delete-orphan")
    payroll_items = relationship("PayrollItem", back_populates="staff")

    __table_args__ = (
        Index("idx_staff_company_branch", "companyId", "branchId"),
        Index("idx_staff_code", "companyId", "employeeCode", unique=True),
    )

class Attendance(BaseModel):
    __tablename__ = "attendances"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    staff_id = Column("staffId", String(36), ForeignKey("staff.id", ondelete="CASCADE"), nullable=False, index=True)
    
    date = Column(Date, nullable=False, index=True)
    check_in = Column("checkIn", Time, nullable=True)
    check_out = Column("checkOut", Time, nullable=True)
    hours_worked = Column("hoursWorked", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    overtime_hours = Column("overtimeHours", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    status = Column(String(50), default="PRESENT", nullable=False)
    notes = Column(Text, nullable=True)

    staff = relationship("Staff", back_populates="attendances")

    __table_args__ = (
        Index("idx_attendance_staff_date", "staffId", "date", unique=True),
        Index("idx_attendance_branch_date", "branchId", "date"),
    )

class Payroll(BaseModel):
    __tablename__ = "payrolls"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    
    month = Column(Integer, nullable=False)  # 1-12
    year = Column(Integer, nullable=False)   # e.g. 2026
    start_date = Column("startDate", Date, nullable=False)
    end_date = Column("endDate", Date, nullable=False)
    
    total_gross = Column("totalGross", Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    total_deductions = Column("totalDeductions", Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    total_net = Column("totalNet", Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    status = Column(String(50), default="DRAFT", nullable=False)
    processed_by = Column("processedBy", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)

    items = relationship("PayrollItem", back_populates="payroll", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_payroll_branch_period", "branchId", "year", "month", unique=True),
    )

class PayrollItem(BaseModel):
    __tablename__ = "payroll_items"

    payroll_id = Column("payrollId", String(36), ForeignKey("payrolls.id", ondelete="CASCADE"), nullable=False, index=True)
    staff_id = Column("staffId", String(36), ForeignKey("staff.id", ondelete="CASCADE"), nullable=False, index=True)
    
    base_pay = Column("basePay", Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    overtime_pay = Column("overtimePay", Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    allowances = Column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    deductions = Column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    net_pay = Column("netPay", Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    
    days_present = Column("daysPresent", Integer, default=0, nullable=False)
    days_absent = Column("daysAbsent", Integer, default=0, nullable=False)
    notes = Column(Text, nullable=True)

    payroll = relationship("Payroll", back_populates="items")
    staff = relationship("Staff", back_populates="payroll_items")
