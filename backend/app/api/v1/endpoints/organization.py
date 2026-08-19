from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.auth import get_current_active_user, require_permission, require_outlet_scope
from app.core.exceptions import (
    UnauthorizedException,
    ForbiddenException,
    DuplicateRequestException,
    NotFoundException
)
from app.models.user import User, Role, UserBranch
from app.models.organization import Company, Branch, Department, Warehouse, StoreLocation, BranchType
from app.models.hr import Staff, StaffStatus
from app.schemas.organization import (
    CompanyCreate,
    CompanyUpdate,
    CompanyResponse,
    BranchCreate,
    BranchUpdate,
    BranchResponse,
    WarehouseCreate,
    WarehouseUpdate,
    WarehouseResponse,
    StoreLocationCreate,
    StoreLocationResponse,
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentResponse,
    StaffCreate,
    StaffUpdate,
    StaffResponse,
    UserAssignBranchRequest,
    UserAssignRoleRequest,
    OutletSummaryItem,
    OrganizationOverviewResponse,
    BranchDetailResponse,
)

router = APIRouter()

# --- COMPANY MANAGEMENT ---

@router.get("/company", response_model=CompanyResponse, status_code=status.HTTP_200_OK)
def get_company(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    company = None
    if current_user.company_id:
        company = db.query(Company).filter(Company.id == current_user.company_id).first()
    if not company:
        company = db.query(Company).first()
    
    if not company:
        # Create default company if not present
        company = Company(
            name="APEX Multi-Outlet Enterprise",
            code="APEX-CORP",
            email="contact@apex-resorts.com",
            is_active=True
        )
        db.add(company)
        db.commit()
        db.refresh(company)

    return company

@router.put("/company", response_model=CompanyResponse, status_code=status.HTTP_200_OK)
def update_company(
    payload: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organization:update"))
):
    company = None
    if current_user.company_id:
        company = db.query(Company).filter(Company.id == current_user.company_id).first()
    if not company:
        company = db.query(Company).first()

    if not company:
        raise NotFoundException("Company record not found")

    if payload.name is not None:
        company.name = payload.name
    if payload.email is not None:
        company.email = payload.email
    if payload.phone is not None:
        company.phone = payload.phone
    if payload.address is not None:
        company.address = payload.address
    if payload.logo_url is not None:
        company.logo_url = payload.logo_url
    if payload.is_active is not None:
        company.is_active = payload.is_active

    db.commit()
    db.refresh(company)
    return company

# --- OVERVIEW & ENTERPRISE TOPOLOGY ---

@router.get("/overview", response_model=OrganizationOverviewResponse, status_code=status.HTTP_200_OK)
def get_organization_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Company
    company = None
    if current_user.company_id:
        company = db.query(Company).filter(Company.id == current_user.company_id).first()
    if not company:
        company = db.query(Company).first()

    # Branches query with scoping
    b_query = db.query(Branch)
    is_hq = current_user.role and current_user.role.name in ["SUPER_ADMIN", "OWNER", "HQ_ADMIN", "CENTRAL_PURCHASE_MANAGER"]
    if not is_hq:
        user_branch_ids = [ub.branch_id for ub in current_user.branches]
        b_query = b_query.filter(Branch.id.in_(user_branch_ids))

    all_branches = b_query.order_by(Branch.code.asc()).all()
    branch_ids = [b.id for b in all_branches]

    # Warehouses
    warehouses = db.query(Warehouse).filter(Warehouse.branch_id.in_(branch_ids)).all() if branch_ids else []
    # Departments
    departments = db.query(Department).filter(Department.branch_id.in_(branch_ids)).all() if branch_ids else []
    # Staff
    staff_members = db.query(Staff).filter(Staff.branch_id.in_(branch_ids)).all() if branch_ids else []

    # Map counts per branch
    wh_count_map = {}
    for w in warehouses:
        if w.branch_id:
            wh_count_map[w.branch_id] = wh_count_map.get(w.branch_id, 0) + 1

    dept_count_map = {}
    for d in departments:
        if d.branch_id:
            dept_count_map[d.branch_id] = dept_count_map.get(d.branch_id, 0) + 1

    staff_count_map = {}
    active_staff_count_map = {}
    for s in staff_members:
        if s.branch_id:
            staff_count_map[s.branch_id] = staff_count_map.get(s.branch_id, 0) + 1
            if s.is_active and s.status == "ACTIVE":
                active_staff_count_map[s.branch_id] = active_staff_count_map.get(s.branch_id, 0) + 1

    branch_type_counts = {}
    outlet_summaries = []
    for b in all_branches:
        branch_type_counts[b.type] = branch_type_counts.get(b.type, 0) + 1
        outlet_summaries.append(
            OutletSummaryItem(
                id=b.id,
                name=b.name,
                code=b.code,
                type=b.type,
                email=b.email,
                phone=b.phone,
                address=b.address,
                is_active=b.is_active,
                warehouses_count=wh_count_map.get(b.id, 0),
                departments_count=dept_count_map.get(b.id, 0),
                staff_count=staff_count_map.get(b.id, 0),
                active_staff_count=active_staff_count_map.get(b.id, 0)
            )
        )

    return OrganizationOverviewResponse(
        company=company,
        total_branches=len(all_branches),
        active_branches=len([b for b in all_branches if b.is_active]),
        total_warehouses=len(warehouses),
        central_warehouses=len([w for w in warehouses if w.is_central]),
        total_departments=len(departments),
        total_staff=len(staff_members),
        active_staff=len([s for s in staff_members if s.is_active and s.status == "ACTIVE"]),
        branch_type_counts=branch_type_counts,
        outlets=outlet_summaries
    )

# --- BRANCH & OUTLET MANAGEMENT ---

@router.get("/branches", response_model=List[BranchResponse], status_code=status.HTTP_200_OK)
def list_branches(
    branch_type: Optional[str] = Query(None, description="Filter by type (HEAD_OFFICE, CENTRAL_STORE, etc.)"),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Branch)

    # Multi-outlet scoping: If user is not HQ_ADMIN / SUPER_ADMIN, only show permitted branches
    if current_user.role and current_user.role.name not in ["SUPER_ADMIN", "OWNER", "HQ_ADMIN", "CENTRAL_PURCHASE_MANAGER"]:
        user_branch_ids = [ub.branch_id for ub in current_user.branches]
        query = query.filter(Branch.id.in_(user_branch_ids))

    if branch_type:
        query = query.filter(Branch.type == branch_type)
    if is_active is not None:
        query = query.filter(Branch.is_active == is_active)

    branches = query.order_by(Branch.code.asc()).all()
    return branches

def normalize_branch_type(b_type: Optional[str]) -> str:
    if not b_type:
        return "RESTAURANT"
    b_upper = b_type.strip().upper()
    if b_upper in ["HOTEL"]:
        return "HOTEL"
    elif b_upper in ["HYBRID", "HEAD_OFFICE"]:
        return "HYBRID"
    return "RESTAURANT"

@router.post("/branches", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
def create_branch(
    payload: BranchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organization:create"))
):
    # Check if branch code exists
    existing = db.query(Branch).filter(Branch.code == payload.code.strip().upper()).first()
    if existing:
        raise DuplicateRequestException(f"Branch with code '{payload.code}' already exists")

    company_id = payload.company_id or current_user.company_id
    if not company_id:
        comp = db.query(Company).first()
        company_id = comp.id if comp else None

    new_branch = Branch(
        name=payload.name,
        code=payload.code.strip().upper(),
        type=normalize_branch_type(payload.type),
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        company_id=company_id,
        is_active=payload.is_active
    )
    db.add(new_branch)
    db.commit()
    db.refresh(new_branch)
    return new_branch

@router.get("/branches/{branch_id}/details", response_model=BranchDetailResponse, status_code=status.HTTP_200_OK)
def get_branch_details(
    branch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Outlet scoping check
    if current_user.role and current_user.role.name not in ["SUPER_ADMIN", "OWNER", "HQ_ADMIN"]:
        user_branch_ids = {ub.branch_id for ub in current_user.branches}
        if branch_id not in user_branch_ids:
            raise ForbiddenException("Access denied: Not authorized for this outlet")

    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise NotFoundException("Branch", branch_id)

    warehouses = db.query(Warehouse).filter(Warehouse.branch_id == branch_id).all()
    departments = db.query(Department).filter(Department.branch_id == branch_id).all()
    staff_members = db.query(Staff).filter(Staff.branch_id == branch_id).all()

    return BranchDetailResponse(
        id=branch.id,
        name=branch.name,
        code=branch.code,
        type=branch.type,
        email=branch.email,
        phone=branch.phone,
        address=branch.address,
        company_id=branch.company_id,
        is_active=branch.is_active,
        created_at=branch.created_at,
        updated_at=branch.updated_at,
        warehouses=warehouses,
        departments=departments,
        staff=staff_members
    )

@router.get("/branches/{branch_id}", response_model=BranchResponse, status_code=status.HTTP_200_OK)
def get_branch(
    branch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Outlet scoping check
    if current_user.role and current_user.role.name not in ["SUPER_ADMIN", "OWNER", "HQ_ADMIN"]:
        user_branch_ids = {ub.branch_id for ub in current_user.branches}
        if branch_id not in user_branch_ids:
            raise ForbiddenException("Access denied: Not authorized for this outlet")

    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise NotFoundException("Branch", branch_id)
    return branch

@router.put("/branches/{branch_id}", response_model=BranchResponse, status_code=status.HTTP_200_OK)
def update_branch(
    branch_id: str,
    payload: BranchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organization:update"))
):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise NotFoundException("Branch", branch_id)

    if payload.name is not None:
        branch.name = payload.name
    if payload.code is not None:
        branch.code = payload.code.strip().upper()
    if payload.type is not None:
        branch.type = normalize_branch_type(payload.type)
    if payload.email is not None:
        branch.email = payload.email
    if payload.phone is not None:
        branch.phone = payload.phone
    if payload.address is not None:
        branch.address = payload.address
    if payload.is_active is not None:
        branch.is_active = payload.is_active

    db.commit()
    db.refresh(branch)
    return branch

# --- WAREHOUSE & STORE LOCATIONS ---

@router.get("/warehouses", response_model=List[WarehouseResponse], status_code=status.HTTP_200_OK)
def list_warehouses(
    branch_id: Optional[str] = Query(None),
    is_central: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Warehouse)
    if branch_id:
        query = query.filter(Warehouse.branch_id == branch_id)
    if is_central is not None:
        query = query.filter(Warehouse.is_central == is_central)
    return query.all()

@router.post("/warehouses", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(
    payload: WarehouseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organization:create"))
):
    company_id = payload.company_id or current_user.company_id
    if not company_id:
        comp = db.query(Company).first()
        company_id = comp.id if comp else None

    warehouse = Warehouse(
        name=payload.name,
        code=payload.code.strip().upper(),
        branch_id=payload.branch_id,
        company_id=company_id,
        is_central=payload.is_central,
        is_active=payload.is_active
    )
    db.add(warehouse)
    db.commit()
    db.refresh(warehouse)
    return warehouse

@router.get("/warehouses/{warehouse_id}", response_model=WarehouseResponse, status_code=status.HTTP_200_OK)
def get_warehouse(
    warehouse_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not warehouse:
        raise NotFoundException("Warehouse", warehouse_id)
    return warehouse

@router.put("/warehouses/{warehouse_id}", response_model=WarehouseResponse, status_code=status.HTTP_200_OK)
def update_warehouse(
    warehouse_id: str,
    payload: WarehouseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organization:update"))
):
    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not warehouse:
        raise NotFoundException("Warehouse", warehouse_id)

    if payload.name is not None:
        warehouse.name = payload.name
    if payload.code is not None:
        warehouse.code = payload.code.strip().upper()
    if payload.branch_id is not None:
        warehouse.branch_id = payload.branch_id
    if payload.is_central is not None:
        warehouse.is_central = payload.is_central
    if payload.is_active is not None:
        warehouse.is_active = payload.is_active

    db.commit()
    db.refresh(warehouse)
    return warehouse

# --- DEPARTMENTS ---

@router.get("/departments", response_model=List[DepartmentResponse], status_code=status.HTTP_200_OK)
def list_departments(
    branch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Department)
    if branch_id:
        query = query.filter(Department.branch_id == branch_id)
    return query.all()

@router.post("/departments", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organization:create"))
):
    company_id = payload.company_id or current_user.company_id
    if not company_id:
        comp = db.query(Company).first()
        company_id = comp.id if comp else None

    dept = Department(
        name=payload.name,
        code=payload.code.strip().upper(),
        company_id=company_id,
        branch_id=payload.branch_id,
        is_active=payload.is_active
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept

@router.get("/departments/{department_id}", response_model=DepartmentResponse, status_code=status.HTTP_200_OK)
def get_department(
    department_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise NotFoundException("Department", department_id)
    return dept

@router.put("/departments/{department_id}", response_model=DepartmentResponse, status_code=status.HTTP_200_OK)
def update_department(
    department_id: str,
    payload: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organization:update"))
):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise NotFoundException("Department", department_id)

    if payload.name is not None:
        dept.name = payload.name
    if payload.code is not None:
        dept.code = payload.code.strip().upper()
    if payload.is_active is not None:
        dept.is_active = payload.is_active

    db.commit()
    db.refresh(dept)
    return dept

# --- STAFF MANAGEMENT ---

@router.get("/staff", response_model=List[StaffResponse], status_code=status.HTTP_200_OK)
def list_staff(
    branch_id: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Staff)
    if branch_id:
        query = query.filter(Staff.branch_id == branch_id)
    if department:
        query = query.filter(Staff.department == department)
    if status_filter:
        query = query.filter(Staff.status == status_filter)

    return query.all()

@router.post("/staff", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
def create_staff(
    payload: StaffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organization:create"))
):
    company_id = payload.company_id or current_user.company_id
    if not company_id:
        comp = db.query(Company).first()
        company_id = comp.id if comp else None

    joining = date.today()
    if payload.joining_date:
        if isinstance(payload.joining_date, date):
            joining = payload.joining_date
        else:
            try:
                joining = datetime.strptime(str(payload.joining_date), "%Y-%m-%d").date()
            except Exception:
                joining = date.today()

    staff_obj = Staff(
        company_id=company_id,
        branch_id=payload.branch_id,
        user_id=payload.user_id,
        employee_code=payload.employee_code.strip().upper(),
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        phone=payload.phone,
        designation=payload.designation,
        department=payload.department,
        joining_date=joining,
        base_salary=Decimal(str(payload.base_salary)),
        hourly_rate=Decimal(str(payload.hourly_rate)),
        status=payload.status,
        is_active=payload.is_active
    )
    db.add(staff_obj)
    db.commit()
    db.refresh(staff_obj)
    return staff_obj

@router.get("/staff/{staff_id}", response_model=StaffResponse, status_code=status.HTTP_200_OK)
def get_staff(
    staff_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    staff_obj = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff_obj:
        raise NotFoundException("Staff", staff_id)
    return staff_obj

@router.put("/staff/{staff_id}", response_model=StaffResponse, status_code=status.HTTP_200_OK)
def update_staff(
    staff_id: str,
    payload: StaffUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organization:update"))
):
    staff_obj = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff_obj:
        raise NotFoundException("Staff", staff_id)

    if payload.first_name is not None:
        staff_obj.first_name = payload.first_name
    if payload.last_name is not None:
        staff_obj.last_name = payload.last_name
    if payload.email is not None:
        staff_obj.email = payload.email
    if payload.phone is not None:
        staff_obj.phone = payload.phone
    if payload.designation is not None:
        staff_obj.designation = payload.designation
    if payload.department is not None:
        staff_obj.department = payload.department
    if payload.branch_id is not None:
        staff_obj.branch_id = payload.branch_id
    if payload.base_salary is not None:
        staff_obj.base_salary = Decimal(str(payload.base_salary))
    if payload.hourly_rate is not None:
        staff_obj.hourly_rate = Decimal(str(payload.hourly_rate))
    if payload.status is not None:
        staff_obj.status = payload.status
    if payload.is_active is not None:
        staff_obj.is_active = payload.is_active

    db.commit()
    db.refresh(staff_obj)
    return staff_obj

# --- USER ASSIGNMENTS ---

@router.post("/users/assign-branch", status_code=status.HTTP_200_OK)
def assign_user_branch(
    payload: UserAssignBranchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organization:create"))
):
    existing = (
        db.query(UserBranch)
        .filter(UserBranch.user_id == payload.user_id, UserBranch.branch_id == payload.branch_id)
        .first()
    )
    if existing:
        existing.is_default = payload.is_default
        db.commit()
        return {"success": True, "message": "Updated user branch assignment"}

    assignment = UserBranch(
        user_id=payload.user_id,
        branch_id=payload.branch_id,
        is_default=payload.is_default
    )
    db.add(assignment)
    db.commit()
    return {"success": True, "message": "Successfully assigned user to branch"}

@router.post("/users/assign-role", status_code=status.HTTP_200_OK)
def assign_user_role(
    payload: UserAssignRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organization:create"))
):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise NotFoundException("User", payload.user_id)

    role = db.query(Role).filter(Role.id == payload.role_id).first()
    if not role:
        raise NotFoundException("Role", payload.role_id)

    user.role_id = role.id
    db.commit()
    return {"success": True, "message": f"Assigned role '{role.name}' to user '{user.username}'"}
