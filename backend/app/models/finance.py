from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel

class AccountType(str, enum.Enum):
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"
    REVENUE = "REVENUE"
    EXPENSE = "EXPENSE"

class JournalStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    POSTED = "POSTED"
    VOID = "VOID"

class ChartOfAccount(BaseModel):
    __tablename__ = "chart_of_accounts"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(50), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    type = Column(SQLEnum(AccountType), nullable=False)
    balance = Column(Numeric(14, 4), default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    journal_lines = relationship("JournalEntryLine", back_populates="account")

class JournalEntry(BaseModel):
    __tablename__ = "journal_entries"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)
    entry_number = Column(String(50), unique=True, nullable=False, index=True)
    date = Column(DateTime, nullable=False)
    reference_type = Column(String(50), nullable=True) # POS_SALE, CLOSING_ENTRY, GRN_PURCHASE
    reference_id = Column(String(36), nullable=True)
    narration = Column(String(500), nullable=False)
    status = Column(SQLEnum(JournalStatus), default=JournalStatus.POSTED, nullable=False)
    total_debit = Column(Numeric(14, 4), nullable=False)
    total_credit = Column(Numeric(14, 4), nullable=False)

    lines = relationship("JournalEntryLine", back_populates="journal_entry", cascade="all, delete-orphan")

class JournalEntryLine(BaseModel):
    __tablename__ = "journal_entry_lines"

    journal_entry_id = Column(String(36), ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(String(36), ForeignKey("chart_of_accounts.id"), nullable=False, index=True)
    debit = Column(Numeric(14, 4), default=0, nullable=False)
    credit = Column(Numeric(14, 4), default=0, nullable=False)
    narration = Column(String(255), nullable=True)

    journal_entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("ChartOfAccount", back_populates="journal_lines")

class AccountsPayable(BaseModel):
    __tablename__ = "accounts_payable"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)
    supplier_id = Column(String(36), ForeignKey("suppliers.id"), nullable=False, index=True)
    invoice_number = Column(String(100), nullable=False)
    invoice_date = Column(DateTime, nullable=False)
    due_date = Column(DateTime, nullable=True)
    amount = Column(Numeric(14, 4), nullable=False)
    paid_amount = Column(Numeric(14, 4), default=0, nullable=False)
    balance = Column(Numeric(14, 4), nullable=False)
    status = Column(String(50), default="UNPAID", nullable=False)
