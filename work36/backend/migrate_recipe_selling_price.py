"""
Migration: Add selling_price_per_unit column to recipes table.
Run this script once from the backend directory:
  python migrate_recipe_selling_price.py

This is idempotent — safe to run multiple times.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in environment (.env file)")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    # Check if column already exists (idempotent)
    result = conn.execute(text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'recipes' AND column_name = 'sellingPricePerUnit'
    """))
    existing = result.fetchone()
    if existing:
        print("Column 'sellingPricePerUnit' already exists in recipes table — skipping.")
    else:
        conn.execute(text("""
            ALTER TABLE recipes
            ADD COLUMN "sellingPricePerUnit" NUMERIC(14,4) NOT NULL DEFAULT 0
        """))
        print("Column 'sellingPricePerUnit' added to recipes table successfully.")

print("Migration completed successfully.")
