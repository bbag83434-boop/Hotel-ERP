"""Compatibility bootstrap for Maintenance/Asset tables on existing databases."""
from sqlalchemy import text
from app.core.database import engine


def ensure_maintenance_schema() -> None:
    statements = [
        """CREATE TABLE IF NOT EXISTS maintenance_assets (id VARCHAR(36) PRIMARY KEY, \"createdAt\" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, \"updatedAt\" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, \"companyId\" VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE, \"branchId\" VARCHAR(36) NOT NULL REFERENCES branches(id) ON DELETE CASCADE, \"assetCode\" VARCHAR(80) NOT NULL, name VARCHAR(255) NOT NULL, category VARCHAR(100) NOT NULL, location VARCHAR(255), manufacturer VARCHAR(150), \"modelNumber\" VARCHAR(150), \"serialNumber\" VARCHAR(150), \"purchaseDate\" TIMESTAMP, \"warrantyExpiry\" TIMESTAMP, \"serviceContractExpiry\" TIMESTAMP, \"purchaseCost\" NUMERIC(14,2) DEFAULT 0, status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', \"isActive\" BOOLEAN NOT NULL DEFAULT TRUE, notes TEXT)""",
        """CREATE TABLE IF NOT EXISTS maintenance_tickets (id VARCHAR(36) PRIMARY KEY, \"createdAt\" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, \"updatedAt\" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, \"companyId\" VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE, \"branchId\" VARCHAR(36) NOT NULL REFERENCES branches(id) ON DELETE CASCADE, \"assetId\" VARCHAR(36) REFERENCES maintenance_assets(id) ON DELETE SET NULL, \"ticketNumber\" VARCHAR(80) NOT NULL UNIQUE, title VARCHAR(255) NOT NULL, description TEXT NOT NULL, category VARCHAR(100) NOT NULL, priority VARCHAR(30) NOT NULL DEFAULT 'MEDIUM', status VARCHAR(30) NOT NULL DEFAULT 'OPEN', \"assignedToId\" VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL, \"vendorName\" VARCHAR(255), \"estimatedCost\" NUMERIC(14,2) NOT NULL DEFAULT 0, \"actualCost\" NUMERIC(14,2) NOT NULL DEFAULT 0, \"downtimeMinutes\" NUMERIC(12,0) NOT NULL DEFAULT 0, \"openedAt\" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, \"dueAt\" TIMESTAMP, \"completedAt\" TIMESTAMP, resolution TEXT)""",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_maintenance_assets_company_code ON maintenance_assets (\"companyId\", \"assetCode\")",
        "CREATE INDEX IF NOT EXISTS ix_maintenance_assets_branch ON maintenance_assets (\"branchId\")",
        "CREATE INDEX IF NOT EXISTS ix_maintenance_tickets_branch_status ON maintenance_tickets (\"branchId\", status)",
        "CREATE INDEX IF NOT EXISTS ix_maintenance_tickets_asset ON maintenance_tickets (\"assetId\")",
    ]
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
