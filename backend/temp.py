from app.core.database import SessionLocal
from app.models.user import User
from app.models.organization import Branch
db = SessionLocal()
admin = db.query(User).first()
branches = db.query(Branch).filter(Branch.company_id == admin.company_id).all()
for b in branches:
    print(f"Branch: {b.name}, Type: {b.type.value if hasattr(b.type, 'value') else b.type}")
