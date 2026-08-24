from typing import List, Optional, Union, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class RoleInfo(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_system: Optional[bool] = False

    class Config:
        from_attributes = True

class UserBranchDetail(BaseModel):
    id: str
    branch_id: str
    branch_name: str
    branch_code: str
    branch_type: Optional[str] = "RESTAURANT"
    is_default: bool = False

    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: str
    email: str
    username: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role_id: str
    role_name: str
    role: Optional[RoleInfo] = None
    company_id: Optional[str] = None
    is_active: bool = True
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    branches: List[UserBranchDetail] = []

    class Config:
        from_attributes = True

class UserCreateRequest(BaseModel):
    email: str = Field(..., description="Unique email address")
    first_name: str = Field(..., min_length=1, max_length=100, description="User first name")
    last_name: Optional[str] = Field(None, max_length=100, description="User last name")
    username: Optional[str] = Field(None, max_length=100, description="Optional username")
    phone: Optional[str] = Field(None, max_length=50, description="Contact phone number")
    role_id: str = Field(..., description="Role ID to assign")
    branch_ids: Optional[List[str]] = Field(default_factory=list, description="List of assigned branch IDs")
    default_branch_id: Optional[str] = Field(None, description="Primary default branch ID")
    password: Optional[str] = Field(None, min_length=6, description="Optional password; if omitted, Google OAuth/SSO login is enabled")
    is_active: bool = Field(True, description="Whether user account is active")
    company_id: Optional[str] = Field(None, description="Associated company ID")

class UserUpdateRequest(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    role_id: Optional[str] = Field(None, description="New role ID")
    branch_ids: Optional[List[str]] = Field(None, description="Updated list of branch IDs")
    default_branch_id: Optional[str] = Field(None, description="New default branch ID")
    is_active: Optional[bool] = Field(None, description="Active status")
    password: Optional[str] = Field(None, min_length=6, description="New password if resetting")

class UserStatusUpdateRequest(BaseModel):
    is_active: bool = Field(..., description="New active status")

class UserManagementSummary(BaseModel):
    total_users: int = 0
    active_users: int = 0
    inactive_users: int = 0
    super_admins: int = 0
    admins: int = 0
    managers: int = 0
    staff: int = 0
    roles: List[RoleInfo] = []

class PermissionResponse(BaseModel):
    id: str
    code: str
    module: str
    action: str
    description: Optional[str] = None

    class Config:
        from_attributes = True

class RolePermissionAssignRequest(BaseModel):
    permission_codes: List[str] = Field(..., description="List of permission codes to assign to role")

class AuditLogResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    action: str
    entity: str
    entity_id: Optional[str] = None
    details: Optional[Union[str, Dict[str, Any], Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

