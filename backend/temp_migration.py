from app.core.database import SessionLocal
from sqlalchemy import text
db = SessionLocal()
try:
    db.execute(text('ALTER TABLE kitchen_orders ADD COLUMN "issuedQty" NUMERIC(14,4) NOT NULL DEFAULT 0.0000;'))
    db.commit()
    print("Added issuedQty!")
except Exception as e:
    print(e)
