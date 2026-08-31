from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class AIDocumentUploadRequest(BaseModel):
    branch_id: Optional[str] = None
    document_type: str = Field(default='SUPPLIER_INVOICE', min_length=3, max_length=50)
    file_name: str = Field(..., min_length=1, max_length=255)
    file_type: str = Field(..., min_length=3, max_length=100)
    file_base64: str = Field(..., min_length=10)
    auto_extract: bool = True

class AIDocumentResponse(BaseModel):
    id: str
    document_type: str
    file_name: str
    file_type: str
    storage_ref: str
    status: str
    extracted_data: Optional[Dict[str, Any]] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    is_duplicate: bool = False
    created_at: str
    processed_at: Optional[str] = None
