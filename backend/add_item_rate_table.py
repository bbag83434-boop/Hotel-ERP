import asyncio
import os
from sqlalchemy import text
from app.core.database import SessionLocal

def create_item_rate():
    db = SessionLocal()
    try:
        db.execute(text("""
        CREATE TABLE IF NOT EXISTS item_rates (
            id VARCHAR(36) PRIMARY KEY,
            "companyId" VARCHAR(36) NOT NULL,
            "itemId" VARCHAR(36) NOT NULL,
            "supplierId" VARCHAR(36),
            rate NUMERIC(14, 4) NOT NULL,
            "unitId" VARCHAR(36),
            "effectiveFrom" TIMESTAMP NOT NULL,
            "effectiveTo" TIMESTAMP,
            "isActive" BOOLEAN DEFAULT true NOT NULL,
            "createdAt" TIMESTAMP DEFAULT current_timestamp NOT NULL,
            "updatedAt" TIMESTAMP DEFAULT current_timestamp NOT NULL
        );
        """))
        db.commit()
        print("Table item_rates created successfully.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_item_rate()
