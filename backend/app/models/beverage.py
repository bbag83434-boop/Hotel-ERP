import enum, uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, DateTime, Text, Index
from app.models.base import BaseModel

class BeverageType(str, enum.Enum):
    BEVERAGE='BEVERAGE'; ALCOHOL='ALCOHOL'
class BeverageTxnType(str, enum.Enum):
    OPENING='OPENING'; PURCHASE='PURCHASE'; TRANSFER_IN='TRANSFER_IN'; TRANSFER_OUT='TRANSFER_OUT'; SALE='SALE'; COMPLIMENTARY='COMPLIMENTARY'; BREAKAGE='BREAKAGE'; WASTAGE='WASTAGE'; ADJUSTMENT='ADJUSTMENT'

class BeverageItem(BaseModel):
    __tablename__='beverage_items'
    company_id=Column('companyId',String(36),ForeignKey('companies.id',ondelete='CASCADE'),nullable=False,index=True)
    branch_id=Column('branchId',String(36),ForeignKey('branches.id',ondelete='CASCADE'),nullable=False,index=True)
    code=Column(String(80),nullable=False)
    name=Column(String(255),nullable=False)
    category=Column(String(100),nullable=False)
    beverage_type=Column('beverageType',String(30),nullable=False,default=BeverageType.BEVERAGE.value)
    unit=Column(String(40),nullable=False,default='bottle')
    pack_size=Column('packSize',Numeric(12,3),nullable=False,default=1)
    cost_price=Column('costPrice',Numeric(14,2),nullable=False,default=0)
    selling_price=Column('sellingPrice',Numeric(14,2),nullable=False,default=0)
    active=Column(Boolean,nullable=False,default=True)
    notes=Column(Text,nullable=True)
    __table_args__=(Index('ix_beverage_item_company_code','companyId','code',unique=True),)

class BeverageLedger(BaseModel):
    __tablename__='beverage_ledger'
    company_id=Column('companyId',String(36),ForeignKey('companies.id',ondelete='CASCADE'),nullable=False,index=True)
    branch_id=Column('branchId',String(36),ForeignKey('branches.id',ondelete='CASCADE'),nullable=False,index=True)
    item_id=Column('itemId',String(36),ForeignKey('beverage_items.id',ondelete='CASCADE'),nullable=False,index=True)
    txn_type=Column('txnType',String(40),nullable=False,index=True)
    quantity=Column(Numeric(12,3),nullable=False)
    reference=Column(String(120),nullable=True)
    notes=Column(Text,nullable=True)
    created_by=Column('createdBy',String(36),ForeignKey('users.id',ondelete='SET NULL'),nullable=True)
