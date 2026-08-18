from sqlalchemy import Column, String, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel

class BranchType(str, enum.Enum):
    HEAD_OFFICE = "HEAD_OFFICE"
    CENTRAL_STORE = "CENTRAL_STORE"
    DESSERT_KITCHEN = "DESSERT_KITCHEN"
    RESTAURANT_OUTLET = "RESTAURANT_OUTLET"
    HOTEL = "HOTEL"
    HYBRID = "HYBRID"

class Company(BaseModel):
    __tablename__ = "companies"

    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(String(500), nullable=True)
    logo_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    branches = relationship("Branch", back_populates="company", cascade="all, delete-orphan")
    users = relationship("User", back_populates="company")

class Branch(BaseModel):
    __tablename__ = "branches"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)
    type = Column(SQLEnum(BranchType), default=BranchType.RESTAURANT_OUTLET, nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    company = relationship("Company", back_populates="branches")
    warehouses = relationship("Warehouse", back_populates="branch")
    closing_records = relationship("OutletClosingRecord", back_populates="branch")

class Warehouse(BaseModel):
    __tablename__ = "warehouses"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)
    is_central = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    branch = relationship("Branch", back_populates="warehouses")
