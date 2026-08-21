import enum
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Numeric, Enum as SQLEnum, Text, JSON
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class ReportType(str, enum.Enum):
    EXECUTIVE_SUMMARY = "EXECUTIVE_SUMMARY"
    SALES_SUMMARY = "SALES_SUMMARY"
    INVENTORY_VALUATION = "INVENTORY_VALUATION"
    FOOD_COST_VARIANCE = "FOOD_COST_VARIANCE"
    WASTAGE_SUMMARY = "WASTAGE_SUMMARY"
    PROCUREMENT_SUMMARY = "PROCUREMENT_SUMMARY"

class ReportFrequency(str, enum.Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    BI_WEEKLY = "BI_WEEKLY"
    MONTHLY = "MONTHLY"

class ReportSnapshot(BaseModel):
    __tablename__ = "report_snapshots"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=True, index=True)
    report_type = Column("reportType", String(50), nullable=False, index=True)
    period_start = Column("periodStart", DateTime, nullable=False)
    period_end = Column("periodEnd", DateTime, nullable=False)
    generated_at = Column("generatedAt", DateTime, nullable=False)
    generated_by_id = Column("generatedById", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    metrics = Column(JSON, nullable=False)
    summary_text = Column("summaryText", Text, nullable=True)

    # CamelCase property aliases for consistency
    @property
    def companyId(self):
        return self.company_id

    @property
    def branchId(self):
        return self.branch_id

    @property
    def reportType(self):
        return self.report_type

    @property
    def periodStart(self):
        return self.period_start

    @property
    def periodEnd(self):
        return self.period_end

    @property
    def generatedAt(self):
        return self.generated_at

    @property
    def generatedById(self):
        return self.generated_by_id

    @property
    def summaryText(self):
        return self.summary_text

class ReportSchedule(BaseModel):
    __tablename__ = "report_schedules"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=True, index=True)
    report_type = Column("reportType", String(50), nullable=False)
    frequency = Column(SQLEnum(ReportFrequency), default=ReportFrequency.DAILY, nullable=False)
    recipients = Column(JSON, nullable=True)  # List of emails or telegram chat IDs
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    last_run_at = Column("lastRunAt", DateTime, nullable=True)
    next_run_at = Column("nextRunAt", DateTime, nullable=True)

    # CamelCase property aliases
    @property
    def companyId(self):
        return self.company_id

    @property
    def branchId(self):
        return self.branch_id

    @property
    def reportType(self):
        return self.report_type

    @property
    def isActive(self):
        return self.is_active

    @property
    def lastRunAt(self):
        return self.last_run_at

    @property
    def nextRunAt(self):
        return self.next_run_at
