from app.core.database import SessionLocal
from app.models.organization import Warehouse
import uuid

db = SessionLocal()
try:
    wh = Warehouse(
        id=str(uuid.uuid4()),
        company_id='86187627-bceb-4fa4-8add-e44c9f2f24ee',
        branch_id='b777a956-2cd3-4c90-b6d0-19679d58ef37',
        name='EMBypass Store',
        code='EMB-001',
        is_central=False,
        is_active=True
    )
    db.add(wh)
    db.commit()
    print("Warehouse created!")
except Exception as e:
    db.rollback()
    print(e)
