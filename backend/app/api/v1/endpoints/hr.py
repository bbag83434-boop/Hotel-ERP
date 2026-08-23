import datetime
import calendar
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.auth import get_current_active_user, require_permission, require_outlet_scope
from app.models.user import User
from app.models.organization import Branch
from app.models.hr import (
    Staff,
    Attendance,
    Payroll,
    PayrollItem,
    Shift,
    LeaveType,
    LeaveRequest,
    StaffStatus,
    AttendanceStatus,
    PayrollStatus,
)
from app.schemas.hr import (
    ShiftCreate,
    ShiftUpdate,
    ShiftResponse,
    AttendanceCreate,
    AttendanceUpdate,
    AttendanceResponse,
    AttendanceSummaryResponse,
    AttendanceSummaryItem,
    LeaveTypeCreate,
    LeaveTypeResponse,
    LeaveRequestCreate,
    LeaveActionRequest,
    LeaveRequestResponse,
    PayrollGenerateRequest,
    PayrollResponse,
    PayrollItemResponse,
    PayrollStatusUpdateRequest,
    PayrollHistorySummary,
)

router = APIRouter()

# =====================================================================
# 1. SHIFT MANAGEMENT
# =====================================================================

@router.get("/shifts", response_model=List[ShiftResponse])
def get_shifts(
    outlet_id: str = Depends(require_outlet_scope),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List work shifts for the outlet."""
    query = db.query(Shift).filter(
        Shift.company_id == current_user.company_id,
        (Shift.branch_id == outlet_id) | (Shift.branch_id.is_(None))
    )
    return query.order_by(Shift.start_time.asc()).all()


@router.post("/shifts", response_model=ShiftResponse, status_code=status.HTTP_201_CREATED)
def create_shift(
    payload: ShiftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new work shift schedule."""
    existing = db.query(Shift).filter(
        Shift.company_id == current_user.company_id,
        Shift.code == payload.code
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Shift with code '{payload.code}' already exists."
        )

    shift = Shift(
        company_id=current_user.company_id,
        branch_id=payload.branch_id,
        name=payload.name,
        code=payload.code,
        start_time=payload.start_time,
        end_time=payload.end_time,
        grace_period_mins=payload.grace_period_mins,
        is_active=payload.is_active
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift


@router.get("/shifts/{shift_id}", response_model=ShiftResponse)
def get_shift(
    shift_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get shift details by ID."""
    shift = db.query(Shift).filter(
        Shift.id == shift_id,
        Shift.company_id == current_user.company_id
    ).first()
    if not shift:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found.")
    return shift


@router.put("/shifts/{shift_id}", response_model=ShiftResponse)
def update_shift(
    shift_id: str,
    payload: ShiftUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update shift details."""
    shift = db.query(Shift).filter(
        Shift.id == shift_id,
        Shift.company_id == current_user.company_id
    ).first()
    if not shift:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found.")

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(shift, field, val)

    db.commit()
    db.refresh(shift)
    return shift


# =====================================================================
# 2. ATTENDANCE TRACKING & SUMMARY
# =====================================================================

@router.get("/attendance", response_model=List[AttendanceResponse])
def get_attendances(
    branch_id: Optional[str] = Query(None),
    staff_id: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List staff attendance records with filtering."""
    query = db.query(Attendance).filter(Attendance.company_id == current_user.company_id)
    if branch_id:
        query = query.filter(Attendance.branch_id == branch_id)
    if staff_id:
        query = query.filter(Attendance.staff_id == staff_id)
    if date:
        query = query.filter(Attendance.date == date)
    if start_date:
        query = query.filter(Attendance.date >= start_date)
    if end_date:
        query = query.filter(Attendance.date <= end_date)

    records = query.order_by(Attendance.date.desc()).all()
    results = []
    for rec in records:
        st = db.query(Staff).filter(Staff.id == rec.staff_id).first()
        results.append(
            AttendanceResponse(
                id=rec.id,
                company_id=rec.company_id,
                branch_id=rec.branch_id,
                staff_id=rec.staff_id,
                staff_name=f"{st.first_name} {st.last_name}" if st else None,
                employee_code=st.employee_code if st else None,
                date=rec.date,
                check_in=str(rec.check_in) if rec.check_in else None,
                check_out=str(rec.check_out) if rec.check_out else None,
                hours_worked=rec.hours_worked,
                overtime_hours=rec.overtime_hours,
                status=rec.status,
                notes=rec.notes,
                created_at=rec.created_at,
                updated_at=rec.updated_at
            )
        )
    return results


@router.post("/attendance", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
def record_attendance(
    payload: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Log daily attendance for a staff member (check-in / hours worked)."""
    staff_member = db.query(Staff).filter(
        Staff.id == payload.staff_id,
        Staff.company_id == current_user.company_id
    ).first()
    if not staff_member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found.")

    target_branch_id = payload.branch_id or staff_member.branch_id
    att_date = payload.date if isinstance(payload.date, datetime.date) else datetime.datetime.strptime(str(payload.date), "%Y-%m-%d").date()

    # Parse time strings if provided
    check_in_time = None
    if payload.check_in:
        if isinstance(payload.check_in, datetime.time):
            check_in_time = payload.check_in
        else:
            try:
                check_in_time = datetime.datetime.strptime(str(payload.check_in)[:8], "%H:%M:%S").time()
            except ValueError:
                check_in_time = datetime.datetime.strptime(str(payload.check_in)[:5], "%H:%M").time()

    check_out_time = None
    if payload.check_out:
        if isinstance(payload.check_out, datetime.time):
            check_out_time = payload.check_out
        else:
            try:
                check_out_time = datetime.datetime.strptime(str(payload.check_out)[:8], "%H:%M:%S").time()
            except ValueError:
                check_out_time = datetime.datetime.strptime(str(payload.check_out)[:5], "%H:%M").time()

    # Check for existing attendance record for staff on this date
    existing = db.query(Attendance).filter(
        Attendance.staff_id == payload.staff_id,
        Attendance.date == att_date
    ).first()

    if existing:
        existing.check_in = check_in_time or existing.check_in
        existing.check_out = check_out_time or existing.check_out
        existing.hours_worked = payload.hours_worked
        existing.overtime_hours = payload.overtime_hours
        existing.status = payload.status
        existing.notes = payload.notes or existing.notes
        db.commit()
        db.refresh(existing)
        rec = existing
    else:
        rec = Attendance(
            company_id=current_user.company_id,
            branch_id=target_branch_id,
            staff_id=payload.staff_id,
            date=att_date,
            check_in=check_in_time,
            check_out=check_out_time,
            hours_worked=payload.hours_worked,
            overtime_hours=payload.overtime_hours,
            status=payload.status,
            notes=payload.notes
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)

    return AttendanceResponse(
        id=rec.id,
        company_id=rec.company_id,
        branch_id=rec.branch_id,
        staff_id=rec.staff_id,
        staff_name=f"{staff_member.first_name} {staff_member.last_name}",
        employee_code=staff_member.employee_code,
        date=rec.date,
        check_in=str(rec.check_in) if rec.check_in else None,
        check_out=str(rec.check_out) if rec.check_out else None,
        hours_worked=rec.hours_worked,
        overtime_hours=rec.overtime_hours,
        status=rec.status,
        notes=rec.notes,
        created_at=rec.created_at,
        updated_at=rec.updated_at
    )


@router.get("/attendance/summary", response_model=AttendanceSummaryResponse)
def get_attendance_summary(
    branch_id: Optional[str] = Query(None),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Aggregate monthly attendance summary per staff and outlet."""
    _, last_day = calendar.monthrange(year, month)
    start_d = datetime.date(year, month, 1)
    end_d = datetime.date(year, month, last_day)

    staff_query = db.query(Staff).filter(Staff.company_id == current_user.company_id)
    if branch_id:
        staff_query = staff_query.filter(Staff.branch_id == branch_id)
    all_staff = staff_query.all()

    summary_list = []
    for st in all_staff:
        records = db.query(Attendance).filter(
            Attendance.staff_id == st.id,
            Attendance.date >= start_d,
            Attendance.date <= end_d
        ).all()

        days_present = sum(1 for r in records if r.status in ["PRESENT", "HALF_DAY"])
        days_absent = sum(1 for r in records if r.status == "ABSENT")
        days_late = sum(1 for r in records if r.status == "LATE")
        total_hours = sum((r.hours_worked for r in records), Decimal("0.0000"))
        total_overtime = sum((r.overtime_hours for r in records), Decimal("0.0000"))

        summary_list.append(
            AttendanceSummaryItem(
                staff_id=st.id,
                staff_name=f"{st.first_name} {st.last_name}",
                employee_code=st.employee_code,
                designation=st.designation,
                days_present=days_present,
                days_absent=days_absent,
                days_late=days_late,
                total_hours=total_hours,
                total_overtime=total_overtime
            )
        )

    return AttendanceSummaryResponse(
        branch_id=branch_id,
        month=month,
        year=year,
        total_staff=len(summary_list),
        summary=summary_list
    )


# =====================================================================
# 3. LEAVE TYPES & REQUESTS
# =====================================================================

@router.get("/leave-types", response_model=List[LeaveTypeResponse])
def get_leave_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List leave types for company."""
    return db.query(LeaveType).filter(LeaveType.company_id == current_user.company_id).all()


@router.post("/leave-types", response_model=LeaveTypeResponse, status_code=status.HTTP_201_CREATED)
def create_leave_type(
    payload: LeaveTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new leave type category."""
    existing = db.query(LeaveType).filter(
        LeaveType.company_id == current_user.company_id,
        LeaveType.code == payload.code
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Leave type code '{payload.code}' already exists."
        )

    leave_type = LeaveType(
        company_id=current_user.company_id,
        name=payload.name,
        code=payload.code,
        days_allowed=payload.days_allowed,
        is_paid=payload.is_paid
    )
    db.add(leave_type)
    db.commit()
    db.refresh(leave_type)
    return leave_type


@router.get("/leaves", response_model=List[LeaveRequestResponse])
def get_leave_requests(
    branch_id: Optional[str] = Query(None),
    employee_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List leave requests with filters."""
    query = db.query(LeaveRequest).filter(LeaveRequest.company_id == current_user.company_id)
    if branch_id:
        query = query.filter(LeaveRequest.branch_id == branch_id)
    if employee_id:
        query = query.filter(LeaveRequest.employee_id == employee_id)
    if status_filter:
        query = query.filter(LeaveRequest.status == status_filter)

    records = query.order_by(LeaveRequest.created_at.desc()).all()
    results = []
    for rec in records:
        lt = db.query(LeaveType).filter(LeaveType.id == rec.leave_type_id).first()
        results.append(
            LeaveRequestResponse(
                id=rec.id,
                company_id=rec.company_id,
                branch_id=rec.branch_id,
                employee_id=rec.employee_id,
                leave_type_id=rec.leave_type_id,
                leave_type_name=lt.name if lt else None,
                start_date=rec.start_date,
                end_date=rec.end_date,
                total_days=rec.total_days,
                reason=rec.reason,
                status=rec.status,
                approved_by_id=rec.approved_by_id,
                approved_at=rec.approved_at,
                rejection_reason=rec.rejection_reason,
                created_at=rec.created_at,
                updated_at=rec.updated_at
            )
        )
    return results


@router.post("/leaves", response_model=LeaveRequestResponse, status_code=status.HTTP_201_CREATED)
def submit_leave_request(
    payload: LeaveRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Submit a new employee leave request."""
    staff_member = db.query(Staff).filter(
        Staff.id == payload.employee_id,
        Staff.company_id == current_user.company_id
    ).first()
    if not staff_member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found.")

    leave_type = db.query(LeaveType).filter(
        LeaveType.id == payload.leave_type_id,
        LeaveType.company_id == current_user.company_id
    ).first()
    if not leave_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave type not found.")

    start_d = payload.start_date if isinstance(payload.start_date, datetime.date) else datetime.datetime.strptime(str(payload.start_date), "%Y-%m-%d").date()
    end_d = payload.end_date if isinstance(payload.end_date, datetime.date) else datetime.datetime.strptime(str(payload.end_date), "%Y-%m-%d").date()

    req = LeaveRequest(
        company_id=current_user.company_id,
        branch_id=payload.branch_id or staff_member.branch_id,
        employee_id=payload.employee_id,
        leave_type_id=payload.leave_type_id,
        start_date=start_d,
        end_date=end_d,
        total_days=payload.total_days,
        reason=payload.reason,
        status="PENDING"
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    return LeaveRequestResponse(
        id=req.id,
        company_id=req.company_id,
        branch_id=req.branch_id,
        employee_id=req.employee_id,
        leave_type_id=req.leave_type_id,
        leave_type_name=leave_type.name,
        start_date=req.start_date,
        end_date=req.end_date,
        total_days=req.total_days,
        reason=req.reason,
        status=req.status,
        approved_by_id=req.approved_by_id,
        approved_at=req.approved_at,
        rejection_reason=req.rejection_reason,
        created_at=req.created_at,
        updated_at=req.updated_at
    )


@router.put("/leaves/{leave_id}", response_model=LeaveRequestResponse)
def act_on_leave_request(
    leave_id: str,
    payload: LeaveActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Manager approval or rejection of a leave request."""
    req = db.query(LeaveRequest).filter(
        LeaveRequest.id == leave_id,
        LeaveRequest.company_id == current_user.company_id
    ).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")

    if payload.status.upper() not in ["APPROVED", "REJECTED"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be APPROVED or REJECTED.")

    req.status = payload.status.upper()
    req.approved_by_id = current_user.id
    req.approved_at = datetime.datetime.utcnow()
    if payload.rejection_reason:
        req.rejection_reason = payload.rejection_reason

    db.commit()
    db.refresh(req)

    lt = db.query(LeaveType).filter(LeaveType.id == req.leave_type_id).first()
    return LeaveRequestResponse(
        id=req.id,
        company_id=req.company_id,
        branch_id=req.branch_id,
        employee_id=req.employee_id,
        leave_type_id=req.leave_type_id,
        leave_type_name=lt.name if lt else None,
        start_date=req.start_date,
        end_date=req.end_date,
        total_days=req.total_days,
        reason=req.reason,
        status=req.status,
        approved_by_id=req.approved_by_id,
        approved_at=req.approved_at,
        rejection_reason=req.rejection_reason,
        created_at=req.created_at,
        updated_at=req.updated_at
    )


# =====================================================================
# 4. MONTHLY PAYROLL GENERATION & MANAGEMENT
# =====================================================================

@router.post("/payrolls/generate", response_model=PayrollResponse, status_code=status.HTTP_201_CREATED)
def generate_monthly_payroll(
    payload: PayrollGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Execute monthly payroll generation:
    1. Validates branch exists under tenant.
    2. Queries only ACTIVE staff in branch (excludes TERMINATED / INACTIVE).
    3. Computes Base Salary, Overtime, Allowances, Deductions, and Net Pay.
    4. Records itemized Payslips / PayrollItems.
    """
    branch = db.query(Branch).filter(
        Branch.id == payload.branch_id,
        Branch.company_id == current_user.company_id
    ).first()
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found.")

    _, last_day = calendar.monthrange(payload.year, payload.month)
    start_d = payload.start_date or datetime.date(payload.year, payload.month, 1)
    end_d = payload.end_date or datetime.date(payload.year, payload.month, last_day)

    if isinstance(start_d, str):
        start_d = datetime.datetime.strptime(start_d, "%Y-%m-%d").date()
    if isinstance(end_d, str):
        end_d = datetime.datetime.strptime(end_d, "%Y-%m-%d").date()

    # Check for existing payroll run in this period
    existing_payroll = db.query(Payroll).filter(
        Payroll.branch_id == payload.branch_id,
        Payroll.year == payload.year,
        Payroll.month == payload.month
    ).first()

    if existing_payroll:
        # Load items
        items = db.query(PayrollItem).filter(PayrollItem.payroll_id == existing_payroll.id).all()
        item_responses = []
        for item in items:
            st = db.query(Staff).filter(Staff.id == item.staff_id).first()
            item_responses.append(
                PayrollItemResponse(
                    id=item.id,
                    payroll_id=item.payroll_id,
                    staff_id=item.staff_id,
                    staff_name=f"{st.first_name} {st.last_name}" if st else None,
                    employee_code=st.employee_code if st else None,
                    designation=st.designation if st else None,
                    department=st.department if st else None,
                    base_pay=item.base_pay,
                    overtime_pay=item.overtime_pay,
                    allowances=item.allowances,
                    deductions=item.deductions,
                    net_pay=item.net_pay,
                    days_present=item.days_present,
                    days_absent=item.days_absent,
                    notes=item.notes,
                    created_at=item.created_at,
                    updated_at=item.updated_at
                )
            )
        return PayrollResponse(
            id=existing_payroll.id,
            company_id=existing_payroll.company_id,
            branch_id=existing_payroll.branch_id,
            branch_name=branch.name,
            month=existing_payroll.month,
            year=existing_payroll.year,
            start_date=existing_payroll.start_date,
            end_date=existing_payroll.end_date,
            total_gross=existing_payroll.total_gross,
            total_deductions=existing_payroll.total_deductions,
            total_net=existing_payroll.total_net,
            status=existing_payroll.status,
            processed_by=existing_payroll.processed_by,
            notes=existing_payroll.notes,
            items=item_responses,
            created_at=existing_payroll.created_at,
            updated_at=existing_payroll.updated_at
        )

    # Strictly select ACTIVE staff only (exclude TERMINATED / INACTIVE)
    active_staff = db.query(Staff).filter(
        Staff.branch_id == branch.id,
        Staff.company_id == current_user.company_id,
        Staff.status == "ACTIVE",
        Staff.is_active.is_(True)
    ).all()

    payroll = Payroll(
        company_id=current_user.company_id,
        branch_id=branch.id,
        month=payload.month,
        year=payload.year,
        start_date=start_d,
        end_date=end_d,
        status="DRAFT",
        processed_by=current_user.id,
        notes=payload.notes or f"Automated Payroll Run for {payload.month:02d}/{payload.year}"
    )
    db.add(payroll)
    db.flush()

    total_gross = Decimal("0.00")
    total_deductions = Decimal("0.00")
    total_net = Decimal("0.00")
    item_responses = []

    for st in active_staff:
        # Check attendance in this period
        attendances = db.query(Attendance).filter(
            Attendance.staff_id == st.id,
            Attendance.date >= start_d,
            Attendance.date <= end_d
        ).all()

        days_present = sum(1 for a in attendances if a.status in ["PRESENT", "HALF_DAY"])
        days_absent = sum(1 for a in attendances if a.status == "ABSENT")
        overtime_hours = sum((a.overtime_hours for a in attendances), Decimal("0.0000"))

        base_pay = Decimal(str(st.base_salary or 0.00))
        hourly_rate = Decimal(str(st.hourly_rate or 0.00))
        overtime_pay = (overtime_hours * hourly_rate).quantize(Decimal("0.01"))
        allowances = Decimal("0.00")
        deductions = Decimal("0.00")
        gross_pay = base_pay + overtime_pay + allowances
        net_pay = gross_pay - deductions

        p_item = PayrollItem(
            payroll_id=payroll.id,
            staff_id=st.id,
            base_pay=base_pay,
            overtime_pay=overtime_pay,
            allowances=allowances,
            deductions=deductions,
            net_pay=net_pay,
            days_present=days_present,
            days_absent=days_absent,
            notes=f"Monthly salary for {st.designation}"
        )
        db.add(p_item)
        db.flush()

        total_gross += gross_pay
        total_deductions += deductions
        total_net += net_pay

        item_responses.append(
            PayrollItemResponse(
                id=p_item.id,
                payroll_id=payroll.id,
                staff_id=st.id,
                staff_name=f"{st.first_name} {st.last_name}",
                employee_code=st.employee_code,
                designation=st.designation,
                department=st.department,
                base_pay=base_pay,
                overtime_pay=overtime_pay,
                allowances=allowances,
                deductions=deductions,
                net_pay=net_pay,
                days_present=days_present,
                days_absent=days_absent,
                notes=p_item.notes,
                created_at=p_item.created_at,
                updated_at=p_item.updated_at
            )
        )

    payroll.total_gross = total_gross
    payroll.total_deductions = total_deductions
    payroll.total_net = total_net

    db.commit()
    db.refresh(payroll)

    return PayrollResponse(
        id=payroll.id,
        company_id=payroll.company_id,
        branch_id=payroll.branch_id,
        branch_name=branch.name,
        month=payroll.month,
        year=payroll.year,
        start_date=payroll.start_date,
        end_date=payroll.end_date,
        total_gross=payroll.total_gross,
        total_deductions=payroll.total_deductions,
        total_net=payroll.total_net,
        status=payroll.status,
        processed_by=payroll.processed_by,
        notes=payroll.notes,
        items=item_responses,
        created_at=payroll.created_at,
        updated_at=payroll.updated_at
    )


@router.get("/payrolls", response_model=List[PayrollResponse])
def get_payrolls(
    branch_id: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List payroll runs with filters."""
    query = db.query(Payroll).filter(Payroll.company_id == current_user.company_id)
    if branch_id:
        query = query.filter(Payroll.branch_id == branch_id)
    if year:
        query = query.filter(Payroll.year == year)
    if month:
        query = query.filter(Payroll.month == month)

    payrolls = query.order_by(Payroll.year.desc(), Payroll.month.desc()).all()
    results = []
    for pr in payrolls:
        br = db.query(Branch).filter(Branch.id == pr.branch_id).first()
        items = db.query(PayrollItem).filter(PayrollItem.payroll_id == pr.id).all()
        item_res = []
        for it in items:
            st = db.query(Staff).filter(Staff.id == it.staff_id).first()
            item_res.append(
                PayrollItemResponse(
                    id=it.id,
                    payroll_id=it.payroll_id,
                    staff_id=it.staff_id,
                    staff_name=f"{st.first_name} {st.last_name}" if st else None,
                    employee_code=st.employee_code if st else None,
                    designation=st.designation if st else None,
                    department=st.department if st else None,
                    base_pay=it.base_pay,
                    overtime_pay=it.overtime_pay,
                    allowances=it.allowances,
                    deductions=it.deductions,
                    net_pay=it.net_pay,
                    days_present=it.days_present,
                    days_absent=it.days_absent,
                    notes=it.notes,
                    created_at=it.created_at,
                    updated_at=it.updated_at
                )
            )
        results.append(
            PayrollResponse(
                id=pr.id,
                company_id=pr.company_id,
                branch_id=pr.branch_id,
                branch_name=br.name if br else None,
                month=pr.month,
                year=pr.year,
                start_date=pr.start_date,
                end_date=pr.end_date,
                total_gross=pr.total_gross,
                total_deductions=pr.total_deductions,
                total_net=pr.total_net,
                status=pr.status,
                processed_by=pr.processed_by,
                notes=pr.notes,
                items=item_res,
                created_at=pr.created_at,
                updated_at=pr.updated_at
            )
        )
    return results


@router.get("/payrolls/{payroll_id}", response_model=PayrollResponse)
def get_payroll(
    payroll_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get single payroll run details with itemized payslips."""
    pr = db.query(Payroll).filter(
        Payroll.id == payroll_id,
        Payroll.company_id == current_user.company_id
    ).first()
    if not pr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll record not found.")

    br = db.query(Branch).filter(Branch.id == pr.branch_id).first()
    items = db.query(PayrollItem).filter(PayrollItem.payroll_id == pr.id).all()
    item_res = []
    for it in items:
        st = db.query(Staff).filter(Staff.id == it.staff_id).first()
        item_res.append(
            PayrollItemResponse(
                id=it.id,
                payroll_id=it.payroll_id,
                staff_id=it.staff_id,
                staff_name=f"{st.first_name} {st.last_name}" if st else None,
                employee_code=st.employee_code if st else None,
                designation=st.designation if st else None,
                department=st.department if st else None,
                base_pay=it.base_pay,
                overtime_pay=it.overtime_pay,
                allowances=it.allowances,
                deductions=it.deductions,
                net_pay=it.net_pay,
                days_present=it.days_present,
                days_absent=it.days_absent,
                notes=it.notes,
                created_at=it.created_at,
                updated_at=it.updated_at
            )
        )

    return PayrollResponse(
        id=pr.id,
        company_id=pr.company_id,
        branch_id=pr.branch_id,
        branch_name=br.name if br else None,
        month=pr.month,
        year=pr.year,
        start_date=pr.start_date,
        end_date=pr.end_date,
        total_gross=pr.total_gross,
        total_deductions=pr.total_deductions,
        total_net=pr.total_net,
        status=pr.status,
        processed_by=pr.processed_by,
        notes=pr.notes,
        items=item_res,
        created_at=pr.created_at,
        updated_at=pr.updated_at
    )


@router.put("/payrolls/{payroll_id}/status", response_model=PayrollResponse)
def update_payroll_status(
    payroll_id: str,
    payload: PayrollStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Transition payroll status: DRAFT -> REVIEWED -> APPROVED -> PAID."""
    pr = db.query(Payroll).filter(
        Payroll.id == payroll_id,
        Payroll.company_id == current_user.company_id
    ).first()
    if not pr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll record not found.")

    valid_statuses = ["DRAFT", "REVIEWED", "APPROVED", "PAID"]
    if payload.status.upper() not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )

    pr.status = payload.status.upper()
    if payload.notes:
        pr.notes = payload.notes

    db.commit()
    db.refresh(pr)

    br = db.query(Branch).filter(Branch.id == pr.branch_id).first()
    items = db.query(PayrollItem).filter(PayrollItem.payroll_id == pr.id).all()
    item_res = []
    for it in items:
        st = db.query(Staff).filter(Staff.id == it.staff_id).first()
        item_res.append(
            PayrollItemResponse(
                id=it.id,
                payroll_id=it.payroll_id,
                staff_id=it.staff_id,
                staff_name=f"{st.first_name} {st.last_name}" if st else None,
                employee_code=st.employee_code if st else None,
                designation=st.designation if st else None,
                department=st.department if st else None,
                base_pay=it.base_pay,
                overtime_pay=it.overtime_pay,
                allowances=it.allowances,
                deductions=it.deductions,
                net_pay=it.net_pay,
                days_present=it.days_present,
                days_absent=it.days_absent,
                notes=it.notes,
                created_at=it.created_at,
                updated_at=it.updated_at
            )
        )

    return PayrollResponse(
        id=pr.id,
        company_id=pr.company_id,
        branch_id=pr.branch_id,
        branch_name=br.name if br else None,
        month=pr.month,
        year=pr.year,
        start_date=pr.start_date,
        end_date=pr.end_date,
        total_gross=pr.total_gross,
        total_deductions=pr.total_deductions,
        total_net=pr.total_net,
        status=pr.status,
        processed_by=pr.processed_by,
        notes=pr.notes,
        items=item_res,
        created_at=pr.created_at,
        updated_at=pr.updated_at
    )


@router.get("/payrolls/payslip/{item_id}", response_model=PayrollItemResponse)
def get_individual_payslip(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retrieve an individual staff payslip."""
    item = db.query(PayrollItem).join(Payroll).filter(
        PayrollItem.id == item_id,
        Payroll.company_id == current_user.company_id
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payslip not found.")

    st = db.query(Staff).filter(Staff.id == item.staff_id).first()
    return PayrollItemResponse(
        id=item.id,
        payroll_id=item.payroll_id,
        staff_id=item.staff_id,
        staff_name=f"{st.first_name} {st.last_name}" if st else None,
        employee_code=st.employee_code if st else None,
        designation=st.designation if st else None,
        department=st.department if st else None,
        base_pay=item.base_pay,
        overtime_pay=item.overtime_pay,
        allowances=item.allowances,
        deductions=item.deductions,
        net_pay=item.net_pay,
        days_present=item.days_present,
        days_absent=item.days_absent,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at
    )


@router.get("/payroll/history", response_model=List[PayrollHistorySummary])
def get_payroll_history(
    branch_id: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retrieve monthly payroll history summary across branches and periods."""
    query = db.query(Payroll).filter(Payroll.company_id == current_user.company_id)
    if branch_id:
        query = query.filter(Payroll.branch_id == branch_id)
    if year:
        query = query.filter(Payroll.year == year)

    records = query.order_by(Payroll.year.desc(), Payroll.month.desc()).all()
    history = []
    for r in records:
        br = db.query(Branch).filter(Branch.id == r.branch_id).first()
        staff_count = db.query(PayrollItem).filter(PayrollItem.payroll_id == r.id).count()
        history.append(
            PayrollHistorySummary(
                payroll_id=r.id,
                branch_id=r.branch_id,
                branch_name=br.name if br else None,
                period=f"{r.year}-{r.month:02d}",
                month=r.month,
                year=r.year,
                total_staff=staff_count,
                total_gross=r.total_gross,
                total_deductions=r.total_deductions,
                total_net=r.total_net,
                status=r.status
            )
        )
    return history
