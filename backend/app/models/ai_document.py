import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Numeric, Boolean
from app.core.database import Base

class AIDocument(Base):
    __tablename__ = 'ai_documents'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String(36), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey('branches.id', ondelete='SET NULL'), nullable=True, index=True)
    uploaded_by_id = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    document_type = Column(String(50), nullable=False, default='SUPPLIER_INVOICE')
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=False)
    storage_ref = Column(String(500), nullable=False)
    sha256 = Column(String(64), nullable=False, index=True)
    extracted_text = Column(Text, nullable=True)
    extracted_data = Column(Text, nullable=True)
    provider = Column(String(50), nullable=True)
    model = Column(String(100), nullable=True)
    status = Column(String(30), nullable=False, default='UPLOADED', index=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)
    is_duplicate = Column(Boolean, default=False, nullable=False)
