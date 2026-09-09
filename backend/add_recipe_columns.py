import asyncio
import os
from sqlalchemy import text
from app.core.database import SessionLocal

def add_columns():
    db = SessionLocal()
    try:
        db.execute(text('ALTER TABLE recipes ADD COLUMN IF NOT EXISTS "totalRecipeCost" NUMERIC(14, 4) DEFAULT 0.0000 NOT NULL;'))
        db.execute(text('ALTER TABLE recipes ADD COLUMN IF NOT EXISTS "unitCost" NUMERIC(14, 4) DEFAULT 0.0000 NOT NULL;'))
        db.execute(text('ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS "unitCost" NUMERIC(14, 4) DEFAULT 0.0000 NOT NULL;'))
        db.commit()
        print("Columns added successfully.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    add_columns()
