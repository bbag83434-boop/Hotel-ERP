from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship, synonym
import enum
from app.models.base import BaseModel

class CashSessionStatus(str, enum.Enum):
    OPEN = 'OPEN'
    CLOSED = 'CLOSED'
    RECONCILED = 'RECONCILED'

class CashMovementType(str, enum.Enum):
    FLOAT_START = 'FLOAT_START'
    CASH_SALE = 'CASH_SALE'
    UPI_SALE = 'UPI_SALE'
    CARD_SALE = 'CARD_SALE'
    CASH_IN = 'CASH_IN'
    CASH_OUT = 'CASH_OUT'
    CLOSING_DROP = 'CLOSING_DROP'

class CashSession(BaseModel):
    __tablename__ = 'cash_sessions'
    company_id = Column('companyId', String(36), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False, index=True)
    branch_id = Column('branchId', String(36), ForeignKey('branches.id', ondelete='CASCADE'), nullable=False, index=True)
    cashier_id = Column('cashierId', String(36), ForeignKey('users.id', ondelete='RESTRICT'), nullable=False, index=True)
    session_number = Column('sessionNumber', String(60), nullable=False, unique=True, index=True)
    status = Column(String(20), default=CashSessionStatus.OPEN.value, nullable=False, index=True)
    opening_float = Column('openingFloat', Numeric(14, 2), default=0, nullable=False)
    opened_at = Column('openedAt', DateTime, nullable=False)
    closed_at = Column('closedAt', DateTime, nullable=True)
    closing_cash = Column('closingCash', Numeric(14, 2), nullable=True)
    expected_cash = Column('expectedCash', Numeric(14, 2), nullable=True)
    cash_variance = Column('cashVariance', Numeric(14, 2), nullable=True)
    total_cash_sales = Column('totalCashSales', Numeric(14, 2), default=0, nullable=False)
    total_upi_sales = Column('totalUpiSales', Numeric(14, 2), default=0, nullable=False)
    total_card_sales = Column('totalCardSales', Numeric(14, 2), default=0, nullable=False)
    notes = Column(Text, nullable=True)
    variance_reason = Column('varianceReason', Text, nullable=True)
    reconciled_by_id = Column('reconciledById', String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    reconciled_at = Column('reconciledAt', DateTime, nullable=True)
    reconciliation_notes = Column('reconciliationNotes', Text, nullable=True)

    companyId = synonym('company_id')
    branchId = synonym('branch_id')
    cashierId = synonym('cashier_id')
    sessionNumber = synonym('session_number')
    openingFloat = synonym('opening_float')
    openedAt = synonym('opened_at')
    closedAt = synonym('closed_at')
    closingCash = synonym('closing_cash')
    expectedCash = synonym('expected_cash')
    cashVariance = synonym('cash_variance')
    totalCashSales = synonym('total_cash_sales')
    totalUpiSales = synonym('total_upi_sales')
    totalCardSales = synonym('total_card_sales')

    movements = relationship('CashMovement', back_populates='session', cascade='all, delete-orphan', order_by='CashMovement.created_at.asc()')

Index('ix_cash_sessions_open_branch_cashier', CashSession.company_id, CashSession.branch_id, CashSession.cashier_id, CashSession.status)

class CashMovement(BaseModel):
    __tablename__ = 'cash_movements'
    company_id = Column('companyId', String(36), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False, index=True)
    session_id = Column('sessionId', String(36), ForeignKey('cash_sessions.id', ondelete='CASCADE'), nullable=False, index=True)
    branch_id = Column('branchId', String(36), ForeignKey('branches.id', ondelete='CASCADE'), nullable=False, index=True)
    created_by_id = Column('createdById', String(36), ForeignKey('users.id', ondelete='RESTRICT'), nullable=False)
    order_id = Column('orderId', String(36), ForeignKey('restaurant_orders.id', ondelete='SET NULL'), nullable=True, index=True)
    movement_type = Column('movementType', String(30), nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    reason = Column(String(500), nullable=False)

    session = relationship('CashSession', back_populates='movements')
    companyId = synonym('company_id')
    sessionId = synonym('session_id')
    branchId = synonym('branch_id')
    createdById = synonym('created_by_id')
    orderId = synonym('order_id')
    movementType = synonym('movement_type')
