import os
import sys
from sqlalchemy import text
from app.core.database import engine

def migrate_reports():
    print("=== MIGRATING PART 10: REPORTS & ANALYTICS FOUNDATION TABLES ===")
    with engine.begin() as conn:
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS report_snapshots (
            id VARCHAR(36) PRIMARY KEY,
            "companyId" VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            "branchId" VARCHAR(36) REFERENCES branches(id) ON DELETE CASCADE,
            "reportType" VARCHAR(50) NOT NULL,
            "periodStart" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            "periodEnd" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            "generatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            "generatedById" VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
            title VARCHAR(255) NOT NULL,
            metrics JSON NOT NULL,
            "summaryText" TEXT,
            "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_reports_company_branch ON report_snapshots ("companyId", "branchId");
        CREATE INDEX IF NOT EXISTS idx_reports_type ON report_snapshots ("reportType");
        CREATE INDEX IF NOT EXISTS idx_reports_period ON report_snapshots ("periodStart", "periodEnd");

        CREATE TABLE IF NOT EXISTS report_schedules (
            id VARCHAR(36) PRIMARY KEY,
            "companyId" VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            "branchId" VARCHAR(36) REFERENCES branches(id) ON DELETE CASCADE,
            "reportType" VARCHAR(50) NOT NULL,
            frequency VARCHAR(50) NOT NULL DEFAULT 'DAILY',
            recipients JSON,
            "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
            "lastRunAt" TIMESTAMP WITHOUT TIME ZONE,
            "nextRunAt" TIMESTAMP WITHOUT TIME ZONE,
            "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_schedules_company_active ON report_schedules ("companyId", "isActive");
        """))
    print("=== PART 10 REPORTS MIGRATION COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    migrate_reports()
