from app.core.database import SessionLocal
from sqlalchemy import text
db = SessionLocal()
missing_columns = [
    '"approvedById" VARCHAR(36) NULL',
    '"approvedAt" TIMESTAMP WITHOUT TIME ZONE NULL',
    '"rejectedById" VARCHAR(36) NULL',
    '"rejectedAt" TIMESTAMP WITHOUT TIME ZONE NULL',
    '"rejectionReason" VARCHAR(500) NULL',
    '"cancelledById" VARCHAR(36) NULL',
    '"cancelledAt" TIMESTAMP WITHOUT TIME ZONE NULL',
    '"cancelReason" VARCHAR(500) NULL',
    '"createdById" VARCHAR(36) NULL'
]
for col in missing_columns:
    try:
        db.execute(text(f'ALTER TABLE kitchen_orders ADD COLUMN {col};'))
        db.commit()
        print(f"Added {col}")
    except Exception as e:
        db.rollback()
        print(f"Failed {col}: {e}")
