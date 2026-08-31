import enum
from decimal import Decimal
from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, Enum, Text, Integer, Index, DateTime
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class CustomerType(str, enum.Enum):
    REGULAR = "REGULAR"
    VIP = "VIP"
    CORPORATE = "CORPORATE"

class LoyaltyTransactionType(str, enum.Enum):
    EARN = "EARN"
    REDEEM = "REDEEM"
    EXPIRE = "EXPIRE"
    ADJUSTMENT = "ADJUSTMENT"

class Customer(BaseModel):
    __tablename__ = "customers"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    
    phone = Column(String(50), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    email = Column(String(255), nullable=True)
    customer_type = Column(Enum(CustomerType), default=CustomerType.REGULAR, nullable=False)
    
    total_orders = Column(Integer, default=0, nullable=False)
    total_spent = Column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    loyalty_points = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)

    addresses = relationship("CustomerAddress", back_populates="customer", cascade="all, delete-orphan")
    loyalty_transactions = relationship("LoyaltyTransaction", back_populates="customer", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_customer_company_phone", "company_id", "phone", unique=True),
    )

class CustomerAddress(BaseModel):
    __tablename__ = "customer_addresses"

    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(50), default="Home", nullable=False)  # Home, Office, Other
    address_line = Column(String(255), nullable=False)
    landmark = Column(String(100), nullable=True)
    city = Column(String(100), nullable=False)
    postal_code = Column(String(20), nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)

    customer = relationship("Customer", back_populates="addresses")

class LoyaltyTransaction(BaseModel):
    __tablename__ = "loyalty_transactions"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)
    order_id = Column(String(36), nullable=True, index=True)
    
    transaction_type = Column(Enum(LoyaltyTransactionType), nullable=False)
    points = Column(Integer, nullable=False)
    points_balance_after = Column(Integer, nullable=False)
    amount_equivalent = Column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    description = Column(String(255), nullable=True)

    customer = relationship("Customer", back_populates="loyalty_transactions")

class QRSession(BaseModel):
    __tablename__ = "qr_sessions"

    branch_id = Column(String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    table_id = Column(String(36), ForeignKey("dining_tables.id", ondelete="CASCADE"), nullable=False, index=True)
    
    session_token = Column(String(100), nullable=False, unique=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    customer_name = Column(String(100), nullable=True)
    customer_phone = Column(String(50), nullable=True)
