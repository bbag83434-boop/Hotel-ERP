import enum
from sqlalchemy import Column, String, ForeignKey, Text, Integer, Numeric, DateTime, Enum
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class ComplaintSeverity(str, enum.Enum):
    LOW = 'LOW'
    MEDIUM = 'MEDIUM'
    HIGH = 'HIGH'
    CRITICAL = 'CRITICAL'

class ComplaintStatus(str, enum.Enum):
    OPEN = 'OPEN'
    IN_PROGRESS = 'IN_PROGRESS'
    RESOLVED = 'RESOLVED'
    CLOSED = 'CLOSED'
    REJECTED = 'REJECTED'

class Complaint(BaseModel):
    __tablename__ = 'complaints'
    company_id = Column(String(36), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey('branches.id', ondelete='CASCADE'), nullable=False, index=True)
    complaint_number = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey('customers.id', ondelete='SET NULL'), nullable=True, index=True)
    order_id = Column(String(36), ForeignKey('restaurant_orders.id', ondelete='SET NULL'), nullable=True, index=True)
    category = Column(String(80), nullable=False)
    severity = Column(Enum(ComplaintSeverity), default=ComplaintSeverity.MEDIUM, nullable=False)
    status = Column(Enum(ComplaintStatus), default=ComplaintStatus.OPEN, nullable=False, index=True)
    description = Column(Text, nullable=False)
    assigned_to = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    investigation = Column(Text, nullable=True)
    action_taken = Column(Text, nullable=True)
    resolution = Column(Text, nullable=True)
    compensation_amount = Column(Numeric(14, 2), default=0, nullable=False)
    root_cause = Column(Text, nullable=True)
    management_review = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    customer = relationship('Customer')
