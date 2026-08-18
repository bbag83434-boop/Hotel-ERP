from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class Role(BaseModel):
    __tablename__ = "roles"

    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    is_system = Column(Boolean, default=False, nullable=False)

    users = relationship("User", back_populates="role")
    permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")

class Permission(BaseModel):
    __tablename__ = "permissions"

    code = Column(String(100), unique=True, nullable=False, index=True)
    module = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)

    roles = relationship("RolePermission", back_populates="permission")

class RolePermission(BaseModel):
    __tablename__ = "role_permissions"

    role_id = Column(String(36), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_id = Column(String(36), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True)

    role = relationship("Role", back_populates="permissions")
    permission = relationship("Permission", back_populates="roles")

class User(BaseModel):
    __tablename__ = "users"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    role_id = Column(String(36), ForeignKey("roles.id"), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    company = relationship("Company", back_populates="users")
    role = relationship("Role", back_populates="users")
    branches = relationship("UserBranch", back_populates="user", cascade="all, delete-orphan")

class UserBranch(BaseModel):
    __tablename__ = "user_branches"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    is_default = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="branches")
