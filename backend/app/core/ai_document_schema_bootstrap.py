from app.core.database import engine, Base
from app.models.ai_document import AIDocument

def ensure_ai_document_schema():
    Base.metadata.create_all(bind=engine, tables=[AIDocument.__table__])
