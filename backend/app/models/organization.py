from sqlalchemy import Column, String, Boolean, ForeignKey, Index, Numeric
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel

class BranchType(str, enum.Enum):
    HEAD_OFFICE = "HEAD_OFFICE"
    CENTRAL_STORE = "CENTRAL_STORE"
    DESSERT_KITCHEN = "DESSERT_KITCHEN"
    RESTAURANT = "RESTAURANT"
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
    logo_url = Column("logoUrl", String(500), nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)

    branches = relationship("Branch", back_populates="company", cascade="all, delete-orphan")
    users = relationship("User", back_populates="company")
    departments = relationship("Department", back_populates="company", cascade="all, delete-orphan")

class Branch(BaseModel):
    __tablename__ = "branches"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)
    type = Column(String(50), default="RESTAURANT", nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(String(500), nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)

    company = relationship("Company", back_populates="branches")
    warehouses = relationship("Warehouse", back_populates="branch")
    closing_records = relationship("OutletClosingRecord", back_populates="branch")
    departments = relationship("Department", back_populates="branch")

class Department(BaseModel):
    __tablename__ = "departments"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(150), nullable=False)
    code = Column(String(50), nullable=False)
    is_active = Column("isActive", Boolean, default=True, nullable=False)

    company = relationship("Company", back_populates="departments")
    branch = relationship("Branch", back_populates="departments")

    __table_args__ = (
        Index("idx_dept_company_code", "companyId", "code", unique=True),
    )

class Warehouse(BaseModel):
    __tablename__ = "warehouses"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)
    is_central = Column("isCentral", Boolean, default=False, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)

    branch = relationship("Branch", back_populates="warehouses")
    locations = relationship("StoreLocation", back_populates="warehouse", cascade="all, delete-orphan")

class StoreLocation(BaseModel):
    __tablename__ = "store_locations"

    warehouse_id = Column("warehouseId", String(36), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column("itemId", String(36), ForeignKey("items.id", ondelete="SET NULL"), nullable=True)
    aisle = Column(String(50), nullable=True)
    rack = Column(String(50), nullable=True)
    shelf = Column(String(50), nullable=True)
    bin = Column(String(50), nullable=True)
    capacity = Column(Numeric(14, 4), nullable=True)

    warehouse = relationship("Warehouse", back_populates="locations")
