import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.core.database import get_db
from app.core.auth import get_current_active_user
from app.core.security import get_password_hash
from app.core.exceptions import (
    UnauthorizedException,
    ForbiddenException,
    DuplicateRequestException,
    NotFoundException,
    BadRequestException,
)
from app.models.user import User, Role, Permission, RolePermission, UserBranch
from app.models.organization import Company, Branch
from app.models.audit import AuditLog
from app.schemas.users import (
    RoleInfo,
    UserBranchDetail,
    UserResponse,
    UserCreateRequest,
    UserUpdateRequest,
    UserStatusUpdateRequest,
    UserManagementSummary,
    PermissionResponse,
    RolePermissionAssignRequest,
    AuditLogResponse,
)

router = APIRouter()

# Role Gate Helper: Only Super Admin, Owner, HQ Admin, or Admin can manage users
def require_user_admin(current_user: User = Depends(get_current_active_user)) -> User:
    role_name = current_user.role.name.upper() if current_user.role else ""
    allowed_roles = {"SUPER_ADMIN", "SUPERADMIN", "OWNER", "HQ_ADMIN", "ADMIN", "HEAD_OFFICE_ADMIN"}
    if role_name not in allowed_roles:
        raise ForbiddenException("Access denied: Administrative privileges required for User Management")
    return current_user

def build_user_response(user: User, db: Session) -> UserResponse:
    branches_list: List[UserBranchDetail] = []
    if user.branches:
        for ub in user.branches:
            branch = db.query(Branch).filter(Branch.id == ub.branch_id).first()
            if branch:
                branches_list.append(
                    UserBranchDetail(
                        id=str(ub.id),
                        branch_id=str(branch.id),
                        branch_name=branch.name,
                        branch_code=branch.code,
                        branch_type=str(branch.type) if branch.type else "RESTAURANT",
                        is_default=bool(ub.is_default),
                    )
                )

    role_info = None
    if user.role:
        role_info = RoleInfo(
            id=str(user.role.id),
            name=user.role.name,
            description=user.role.description,
            is_system=bool(user.role.is_system),
        )

    return UserResponse(
        id=str(user.id),
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        avatar_url=user.avatar_url,
        role_id=str(user.role_id),
        role_name=user.role.name if user.role else "STAFF",
        role=role_info,
        company_id=str(user.company_id) if user.company_id else None,
        is_active=bool(user.is_active),
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
        branches=branches_list,
    )

@router.get("/roles", response_model=List[RoleInfo], status_code=status.HTTP_200_OK)
def list_available_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_admin)
):
    """List all available system roles for user assignment."""
    roles = db.query(Role).order_by(Role.name.asc()).all()
    
    # If no roles exist, ensure foundational roles are present
    if not roles:
        default_roles = [
            ("SUPER_ADMIN", "Super Administrator with full multi-tenant system control", True),
            ("ADMIN", "Head Office Administrator", True),
            ("OUTLET_MANAGER", "Outlet & Operations General Manager", True),
            ("PURCHASE_MANAGER", "Central Procurement & Supplier Manager", True),
            ("INVENTORY_MANAGER", "Central Commissary & Inventory Controller", True),
            ("PRODUCTION_MANAGER", "Kitchen Production & Recipe Manager", True),
            ("STAFF", "Standard Staff with assigned outlet access", True),
            ("VIEW_ONLY", "Auditor / Read-only Observer", True),
        ]
        created_roles = []
        for name, desc, is_sys in default_roles:
            r = Role(
                id=str(uuid.uuid4()),
                name=name,
                description=desc,
                is_system=is_sys
            )
            db.add(r)
            created_roles.append(r)
        db.commit()
        roles = db.query(Role).order_by(Role.name.asc()).all()

    return [
        RoleInfo(
            id=str(r.id),
            name=r.name,
            description=r.description,
            is_system=bool(r.is_system),
        )
        for r in roles
    ]


@router.get("/permissions", response_model=List[PermissionResponse], status_code=status.HTTP_200_OK)
def list_available_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_admin)
):
    """List all available granular system permissions, auto-seeding if empty."""
    perms = db.query(Permission).order_by(Permission.module.asc(), Permission.action.asc()).all()
    if not perms:
        default_permissions = [
            ("organization:read", "organization", "read", "View enterprise organization and branch topology"),
            ("organization:create", "organization", "create", "Create branches, departments and warehouses"),
            ("organization:update", "organization", "update", "Update branches, departments and warehouses"),
            ("organization:delete", "organization", "delete", "Deactivate organization nodes"),
            ("users:read", "users", "read", "View user accounts, roles and permissions"),
            ("users:create", "users", "create", "Create new system users and assign roles"),
            ("users:update", "users", "update", "Update user accounts, roles and outlet scopes"),
            ("users:delete", "users", "delete", "Deactivate user accounts"),
            ("inventory:read", "inventory", "read", "View items, stock balances and warehouse ledgers"),
            ("inventory:create", "inventory", "create", "Create catalog items, categories and units"),
            ("inventory:update", "inventory", "update", "Update catalog items, prices and stock counts"),
            ("inventory:delete", "inventory", "delete", "Deactivate catalog items"),
            ("procurement:read", "procurement", "read", "View suppliers, indents, POs and GRNs"),
            ("procurement:create", "procurement", "create", "Create suppliers, purchase requests and vendor mappings"),
            ("procurement:update", "procurement", "update", "Update suppliers and vendor mappings"),
            ("procurement:approve", "procurement", "approve", "Approve purchase requests and POs"),
            ("production:read", "production", "read", "View recipes and production orders"),
            ("production:create", "production", "create", "Create recipes and production batches"),
            ("production:update", "production", "update", "Update recipes and finish production runs"),
            ("wastage:read", "wastage", "read", "View wastage logs and food loss records"),
            ("wastage:create", "wastage", "create", "Log kitchen and bar wastage"),
            ("wastage:approve", "wastage", "approve", "Approve high-value wastage entries"),
            ("closing:read", "closing", "read", "View bi-monthly closing audit records"),
            ("closing:create", "closing", "create", "Initiate bi-monthly stock takes"),
            ("closing:finalize", "closing", "finalize", "Finalize and lock bi-monthly closing periods"),
            ("hr:read", "hr", "read", "View staff directory and attendance"),
            ("hr:create", "hr", "create", "Create staff profiles and shifts"),
            ("hr:update", "hr", "update", "Update staff records and process payroll"),
            ("reports:read", "reports", "read", "View executive and variance reports"),
            ("ai:query", "ai", "query", "Use AI assistant and automated invoice parser"),
        ]
        created = []
        for code, module, action, desc in default_permissions:
            p = Permission(
                id=str(uuid.uuid4()),
                code=code,
                module=module,
                action=action,
                description=desc,
            )
            db.add(p)
            created.append(p)
        db.commit()
        perms = db.query(Permission).order_by(Permission.module.asc(), Permission.action.asc()).all()

    return perms


@router.get("/roles/{role_id}/permissions", response_model=List[str], status_code=status.HTTP_200_OK)
def get_role_permissions(
    role_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_admin)
):
    """Retrieve list of permission codes assigned to a specific role."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise NotFoundException("Role", role_id)

    # Super Admin wildcard
    if role.name.upper() in ["SUPER_ADMIN", "SUPERADMIN", "OWNER"]:
        return ["*:*"]

    role_perms = (
        db.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id == role_id)
        .all()
    )
    return [rp[0] for rp in role_perms]


@router.post("/roles/{role_id}/permissions", response_model=List[str], status_code=status.HTTP_200_OK)
def assign_role_permissions(
    role_id: str,
    payload: RolePermissionAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_admin)
):
    """Assign/sync permission codes to a role."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise NotFoundException("Role", role_id)

    if role.name.upper() in ["SUPER_ADMIN", "SUPERADMIN", "OWNER"]:
        raise BadRequestException("Cannot modify permissions for Super Admin role (wildcard access preserved)")

    # Clear existing permissions for role
    db.query(RolePermission).filter(RolePermission.role_id == role_id).delete()

    assigned_codes = []
    for code in payload.permission_codes:
        perm = db.query(Permission).filter(Permission.code == code).first()
        if perm:
            rp = RolePermission(
                id=str(uuid.uuid4()),
                role_id=role_id,
                permission_id=perm.id,
            )
            db.add(rp)
            assigned_codes.append(code)

    db.commit()
    return assigned_codes


@router.get("/audit-logs", response_model=List[AuditLogResponse], status_code=status.HTTP_200_OK)
def get_audit_logs(
    entity: Optional[str] = Query(None, description="Filter by entity type (e.g. Supplier, SupplierItem, User)"),
    action: Optional[str] = Query(None, description="Filter by action code"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_admin)
):
    """Retrieve audit logs for master data changes and security events."""
    query = db.query(AuditLog)
    if entity:
        query = query.filter(AuditLog.entity == entity)
    if action:
        query = query.filter(AuditLog.action == action)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)

    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    
    results = []
    for l in logs:
        u = db.query(User).filter(User.id == l.user_id).first() if l.user_id else None
        results.append(
            AuditLogResponse(
                id=str(l.id),
                user_id=str(l.user_id) if l.user_id else None,
                user_name=f"{u.first_name} {u.last_name or ''}".strip() if u else None,
                user_email=u.email if u else None,
                action=l.action,
                entity=l.entity,
                entity_id=str(l.entity_id) if l.entity_id else None,
                details=l.details,
                ip_address=l.ip_address,
                user_agent=l.user_agent,
                created_at=l.created_at,
            )
        )
    return results


@router.get("/summary", response_model=UserManagementSummary, status_code=status.HTTP_200_OK)
def get_user_management_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_admin)
):
    """Return high-level summary KPIs and role distribution for User Management."""
    query = db.query(User)
    
    # Company scoping if not Super Admin
    if current_user.role and current_user.role.name not in ["SUPER_ADMIN", "SUPERADMIN", "OWNER"]:
        if current_user.company_id:
            query = query.filter(User.company_id == current_user.company_id)

    all_users = query.all()
    total_users = len(all_users)
    active_users = len([u for u in all_users if u.is_active])
    inactive_users = total_users - active_users

    super_admins = 0
    admins = 0
    managers = 0
    staff = 0

    for u in all_users:
        if u.role:
            r_name = u.role.name.upper()
            if r_name in ["SUPER_ADMIN", "SUPERADMIN", "OWNER"]:
                super_admins += 1
            elif r_name in ["ADMIN", "HQ_ADMIN", "HEAD_OFFICE_ADMIN"]:
                admins += 1
            elif "MANAGER" in r_name:
                managers += 1
            else:
                staff += 1
        else:
            staff += 1

    roles = db.query(Role).order_by(Role.name.asc()).all()
    roles_info = [
        RoleInfo(
            id=str(r.id),
            name=r.name,
            description=r.description,
            is_system=bool(r.is_system),
        )
        for r in roles
    ]

    return UserManagementSummary(
        total_users=total_users,
        active_users=active_users,
        inactive_users=inactive_users,
        super_admins=super_admins,
        admins=admins,
        managers=managers,
        staff=staff,
        roles=roles_info,
    )

@router.get("", response_model=List[UserResponse], status_code=status.HTTP_200_OK)
def list_users(
    search: Optional[str] = Query(None, description="Search by name, email, or username"),
    role_id: Optional[str] = Query(None, description="Filter by Role ID"),
    branch_id: Optional[str] = Query(None, description="Filter by assigned Branch ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_admin)
):
    """List all registered users with optional search, role, outlet, and status filters."""
    query = db.query(User)

    # Multi-tenant company scoping for non-super-admins
    if current_user.role and current_user.role.name not in ["SUPER_ADMIN", "SUPERADMIN", "OWNER"]:
        if current_user.company_id:
            query = query.filter(User.company_id == current_user.company_id)

    # Search filter
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(User.email).like(term),
                func.lower(User.first_name).like(term),
                func.lower(User.last_name).like(term),
                func.lower(User.username).like(term),
                func.lower(User.phone).like(term),
            )
        )

    # Role filter
    if role_id and role_id.strip():
        query = query.filter(User.role_id == role_id.strip())

    # Branch filter
    if branch_id and branch_id.strip():
        user_ids_in_branch = (
            db.query(UserBranch.user_id)
            .filter(UserBranch.branch_id == branch_id.strip())
            .subquery()
        )
        query = query.filter(User.id.in_(user_ids_in_branch))

    # Active status filter
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    return [build_user_response(u, db) for u in users]

@router.get("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_admin)
):
    """Retrieve details for a single user by ID."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User", user_id)

    # Scoping check
    if current_user.role and current_user.role.name not in ["SUPER_ADMIN", "SUPERADMIN", "OWNER"]:
        if current_user.company_id and user.company_id != current_user.company_id:
            raise ForbiddenException("Access denied: User belongs to another organization")

    return build_user_response(user, db)

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_admin)
):
    """
    Create a new user account.
    Supports instant Google OAuth login (pre-generates secure random password hash if omitted).
    """
    import re
    email_clean = payload.email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email_clean):
        raise BadRequestException("Invalid email address format")

    # 1. Check for duplicate email
    existing = db.query(User).filter(User.email.ilike(email_clean)).first()
    if existing:
        raise DuplicateRequestException(f"User with email '{email_clean}' already exists")

    # 2. Check Role existence
    role = db.query(Role).filter(Role.id == payload.role_id).first()
    if not role:
        raise NotFoundException("Role", payload.role_id)

    # 3. Determine Company ID
    company_id = payload.company_id or current_user.company_id
    if not company_id:
        root_company = db.query(Company).first()
        company_id = root_company.id if root_company else None

    # 4. Generate password hash
    if payload.password and payload.password.strip():
        pw_hash = get_password_hash(payload.password.strip())
    else:
        # OAuth / SSO token seed pattern
        pw_hash = get_password_hash(str(uuid.uuid4()))

    # 5. Username fallback
    username = payload.username.strip() if payload.username and payload.username.strip() else email_clean.split("@")[0]

    # Ensure unique username
    existing_un = db.query(User).filter(User.username == username).first()
    if existing_un:
        username = f"{username}_{str(uuid.uuid4())[:6]}"

    # 6. Create User record
    new_user = User(
        id=str(uuid.uuid4()),
        company_id=company_id,
        role_id=role.id,
        email=email_clean,
        username=username,
        password_hash=pw_hash,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip() if payload.last_name else None,
        phone=payload.phone.strip() if payload.phone else None,
        is_active=payload.is_active,
    )
    db.add(new_user)
    db.flush()

    # 7. Assign Branches
    assigned_branch_ids = payload.branch_ids or []
    default_branch_id = payload.default_branch_id

    # If no default is designated but branches are provided, make the first one default
    if assigned_branch_ids and not default_branch_id:
        default_branch_id = assigned_branch_ids[0]

    for b_id in assigned_branch_ids:
        b_obj = db.query(Branch).filter(Branch.id == b_id).first()
        if b_obj:
            is_def = (b_id == default_branch_id)
            user_branch = UserBranch(
                id=str(uuid.uuid4()),
                user_id=new_user.id,
                branch_id=b_id,
                is_default=is_def,
            )
            db.add(user_branch)

    db.commit()
    db.refresh(new_user)
    return build_user_response(new_user, db)

@router.put("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_admin)
):
    """
    Update an existing user's details, role assignment, branch scope, or active status.
    Guards against self-lockout.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User", user_id)

    # Scoping check
    if current_user.role and current_user.role.name not in ["SUPER_ADMIN", "SUPERADMIN", "OWNER"]:
        if current_user.company_id and user.company_id != current_user.company_id:
            raise ForbiddenException("Access denied: User belongs to another organization")

    # Guard: Cannot deactivate self
    if payload.is_active is False and str(current_user.id) == str(user.id):
        raise BadRequestException("Self-action forbidden: You cannot deactivate your own administrative account")

    # Guard: Cannot demote own SUPER_ADMIN role
    if payload.role_id and str(current_user.id) == str(user.id):
        current_role_name = current_user.role.name.upper() if current_user.role else ""
        if current_role_name in ["SUPER_ADMIN", "SUPERADMIN", "OWNER"]:
            new_role = db.query(Role).filter(Role.id == payload.role_id).first()
            if new_role and new_role.name.upper() not in ["SUPER_ADMIN", "SUPERADMIN", "OWNER"]:
                raise BadRequestException("Self-action forbidden: You cannot demote your own Super Admin role")

    # Update basic profile info
    if payload.first_name is not None:
        user.first_name = payload.first_name.strip()
    if payload.last_name is not None:
        user.last_name = payload.last_name.strip() if payload.last_name.strip() else None
    if payload.phone is not None:
        user.phone = payload.phone.strip() if payload.phone.strip() else None
    if payload.is_active is not None:
        user.is_active = payload.is_active

    # Update Role if provided
    if payload.role_id is not None:
        role = db.query(Role).filter(Role.id == payload.role_id).first()
        if not role:
            raise NotFoundException("Role", payload.role_id)
        user.role_id = role.id

    # Update password if provided
    if payload.password and payload.password.strip():
        user.password_hash = get_password_hash(payload.password.strip())

    # Update branch assignments if provided
    if payload.branch_ids is not None:
        # Clear existing branch links
        db.query(UserBranch).filter(UserBranch.user_id == user.id).delete()
        db.flush()

        assigned_branch_ids = payload.branch_ids
        default_branch_id = payload.default_branch_id
        if assigned_branch_ids and not default_branch_id:
            default_branch_id = assigned_branch_ids[0]

        for b_id in assigned_branch_ids:
            b_obj = db.query(Branch).filter(Branch.id == b_id).first()
            if b_obj:
                is_def = (b_id == default_branch_id)
                ub = UserBranch(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    branch_id=b_id,
                    is_default=is_def,
                )
                db.add(ub)

    db.commit()
    db.refresh(user)
    return build_user_response(user, db)

@router.patch("/{user_id}/status", response_model=UserResponse, status_code=status.HTTP_200_OK)
def update_user_status(
    user_id: str,
    payload: UserStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_admin)
):
    """Activate or deactivate a user account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User", user_id)

    # Scoping check
    if current_user.role and current_user.role.name not in ["SUPER_ADMIN", "SUPERADMIN", "OWNER"]:
        if current_user.company_id and user.company_id != current_user.company_id:
            raise ForbiddenException("Access denied: User belongs to another organization")

    # Guard: Cannot deactivate self
    if not payload.is_active and str(current_user.id) == str(user.id):
        raise BadRequestException("Self-action forbidden: You cannot deactivate your own account")

    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return build_user_response(user, db)

@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_admin)
):
    """
    Soft-delete / deactivate user.
    Preserves audit trails and database referential integrity.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User", user_id)

    # Guard: Cannot deactivate self
    if str(current_user.id) == str(user.id):
        raise BadRequestException("Self-action forbidden: You cannot deactivate your own account")

    user.is_active = False
    db.commit()
    return {
        "success": True,
        "message": f"User account '{user.email}' deactivated successfully (soft-deleted to preserve audit trail)",
        "user_id": str(user.id),
        "is_active": False,
    }
