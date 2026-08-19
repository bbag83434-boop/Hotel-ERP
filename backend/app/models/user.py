import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import BaseModel

class Role(BaseModel):
    __tablename__ = "roles"

    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    is_system = Column("isSystem", Boolean, default=False, nullable=True)

    users = relationship("User", back_populates="role")
    permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")

class Permission(BaseModel):
    __tablename__ = "permissions"

    code = Column(String(100), unique=True, nullable=False, index=True)
    module = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)

    roles = relationship("RolePermission", back_populates="permission")

class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    role_id = Column("roleId", String(36), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_id = Column("permissionId", String(36), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column("createdAt", DateTime, default=datetime.utcnow, nullable=False)

    role = relationship("Role", back_populates="permissions")
    permission = relationship("Permission", back_populates="roles")

class User(BaseModel):
    __tablename__ = "users"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    role_id = Column("roleId", String(36), ForeignKey("roles.id"), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=True, index=True)
    password_hash = Column("passwordHash", String(255), nullable=False)
    first_name = Column("firstName", String(100), nullable=False)
    last_name = Column("lastName", String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    avatar_url = Column("avatarUrl", String(500), nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    refresh_token = Column("refreshToken", String(500), nullable=True)
    last_login_at = Column("lastLoginAt", DateTime, nullable=True)

    company = relationship("Company", back_populates="users")
    role = relationship("Role", back_populates="users")
    branches = relationship("UserBranch", back_populates="user", cascade="all, delete-orphan")

    @property
    def companyId(self):
        return self.company_id

    @companyId.setter
    def companyId(self, value):
        self.company_id = value

    @property
    def roleId(self):
        return self.role_id

    @property
    def firstName(self):
        return self.first_name

    @property
    def lastName(self):
        return self.last_name

    @property
    def isActive(self):
        return self.is_active

class UserBranch(Base):
    __tablename__ = "user_branches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column("userId", String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    is_default = Column("isDefault", Boolean, default=False, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="branches")
