from typing import List, Optional, Union
from pydantic import BaseModel, Field
from datetime import datetime, date

# Company Schemas
class CompanyBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: str = Field(..., max_length=50)
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool = True

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: Optional[bool] = None

class CompanyResponse(CompanyBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Branch Schemas
class BranchBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: str = Field(..., max_length=50)
    type: str = Field("RESTAURANT", description="RESTAURANT, HOTEL, HYBRID")
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    company_id: Optional[str] = None
    is_active: bool = True

class BranchCreate(BranchBase):
    pass

class BranchUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    type: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None

class BranchResponse(BranchBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Store Location Schemas
class StoreLocationBase(BaseModel):
    warehouse_id: str
    item_id: Optional[str] = None
    aisle: Optional[str] = None
    rack: Optional[str] = None
    shelf: Optional[str] = None
    bin: Optional[str] = None
    capacity: Optional[float] = None

class StoreLocationCreate(StoreLocationBase):
    pass

class StoreLocationResponse(StoreLocationBase):
    id: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Warehouse Schemas
class WarehouseBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: str = Field(..., max_length=50)
    branch_id: Optional[str] = None
    company_id: Optional[str] = None
    is_central: bool = False
    is_active: bool = True

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    branch_id: Optional[str] = None
    is_central: Optional[bool] = None
    is_active: Optional[bool] = None

class WarehouseResponse(WarehouseBase):
    id: str
    locations: List[StoreLocationResponse] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Department Schemas
class DepartmentBase(BaseModel):
    name: str = Field(..., max_length=150)
    code: str = Field(..., max_length=50)
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    is_active: bool = True

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    is_active: Optional[bool] = None

class DepartmentResponse(DepartmentBase):
    id: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Staff Schemas
class StaffBase(BaseModel):
    employee_code: str = Field(..., max_length=50)
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: Optional[str] = None
    phone: Optional[str] = None
    designation: str = Field(..., max_length=100)
    department: Optional[str] = None
    branch_id: str
    company_id: Optional[str] = None
    user_id: Optional[str] = None
    joining_date: Optional[Union[date, str]] = None
    base_salary: float = 0.00
    hourly_rate: float = 0.00
    status: str = "ACTIVE"
    is_active: bool = True

class StaffCreate(StaffBase):
    pass

class StaffUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    branch_id: Optional[str] = None
    base_salary: Optional[float] = None
    hourly_rate: Optional[float] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None

class StaffResponse(StaffBase):
    id: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Assignment Schemas
class UserAssignBranchRequest(BaseModel):
    user_id: str
    branch_id: str
    is_default: bool = False

class UserAssignRoleRequest(BaseModel):
    user_id: str
    role_id: str
