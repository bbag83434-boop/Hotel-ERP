from typing import List, Optional, Callable
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.models.user import User, RolePermission, Permission
from app.models.organization import Branch

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    auth_header: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db)
) -> User:
    actual_token = token
    if not actual_token and auth_header:
        if auth_header.lower().startswith("bearer "):
            parts = auth_header.split(None, 1)
            if len(parts) != 2 or not parts[1].strip():
                raise UnauthorizedException("Invalid Authorization header")
            actual_token = parts[1].strip()

    if not actual_token:
        raise UnauthorizedException("Authentication credentials were not provided")

    payload = decode_access_token(actual_token)
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedException("Invalid token payload")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise UnauthorizedException("User not found or account removed")

    return user

def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.is_active:
        raise UnauthorizedException("User account is inactive")
    return current_user

def require_permission(required_permission: str) -> Callable:
    def permission_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
    ) -> User:
        # SUPER_ADMIN / OWNER bypass
        if current_user.role and current_user.role.name in ["SUPER_ADMIN", "OWNER", "HQ_ADMIN"]:
            return current_user

        # Query user's role permissions
        user_perms = (
            db.query(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .filter(RolePermission.role_id == current_user.role_id)
            .all()
        )
        perm_codes = {p[0] for p in user_perms}

        if required_permission not in perm_codes and "*:*" not in perm_codes:
            raise ForbiddenException(f"Permission denied: Missing required permission '{required_permission}'")

        return current_user
    return permission_checker

def require_outlet_scope(
    outlet_id: Optional[str] = Header(None, alias="X-Outlet-Id"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> str:
    # Never silently infer an outlet for a scoped request. Missing scope must fail closed.
    if not outlet_id or not outlet_id.strip():
        raise ForbiddenException("X-Outlet-Id header is required for outlet-scoped requests")
    outlet_id = outlet_id.strip()

    # Verify if user has access to requested outlet
    if current_user.role and current_user.role.name in ["SUPER_ADMIN", "OWNER", "HQ_ADMIN", "CENTRAL_PURCHASE_MANAGER"]:
        return outlet_id

    user_branch_ids = {ub.branch_id for ub in current_user.branches}
    if outlet_id not in user_branch_ids:
        raise ForbiddenException(f"Access denied: User is not authorized for outlet scope '{outlet_id}'")

    return outlet_id
