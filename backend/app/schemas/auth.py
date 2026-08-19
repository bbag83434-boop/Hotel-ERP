from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field

class LoginRequest(BaseModel):
    email: str = Field(..., description="Email address or username")
    password: str = Field(..., min_length=4, description="User password")
    branch_id: Optional[str] = Field(None, description="Active outlet scope ID")

class GoogleOAuthRequest(BaseModel):
    id_token: str = Field(..., description="Google OAuth ID Token")
    branch_id: Optional[str] = Field(None, description="Active outlet scope ID")

class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., description="Valid JWT Refresh Token")

class BranchScopeInfo(BaseModel):
    id: str
    name: str
    code: str
    type: str
    is_default: bool = False

class UserProfileResponse(BaseModel):
    id: str
    email: str
    username: str
    first_name: str
    last_name: Optional[str] = None
    role: str
    is_active: bool
    company_id: Optional[str] = None
    permissions: List[str] = []
    assigned_branches: List[BranchScopeInfo] = []
    active_branch: Optional[BranchScopeInfo] = None

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # in seconds
    user: UserProfileResponse
