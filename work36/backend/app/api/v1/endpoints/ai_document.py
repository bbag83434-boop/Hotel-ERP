from __future__ import annotations
import hashlib, json, os, uuid
from datetime import datetime
from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_active_user, require_outlet_scope, require_permission
from app.core.exceptions import BadRequestException, ForbiddenException, ConflictException
from app.models.user import User
from app.models.ai_document import AIDocument
from app.schemas.ai_document import AIDocumentUploadRequest
from app.services.ai_document import decode_file, extract_text, deterministic_fields, ai_extract
from app.services.ai_provider import AIProviderError

router = APIRouter()

def _role(user): return (user.role.name if user.role else '').upper()
def _branch_ok(user, branch_id):
    if _role(user) in {'SUPER_ADMIN','OWNER','HQ_ADMIN'}: return
    if not any(x.branch_id == branch_id for x in user.branches): raise ForbiddenException('Document access denied for this outlet.')

@router.post('/upload')
def upload_and_extract(payload: AIDocumentUploadRequest = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user), outlet_id: str = Depends(require_outlet_scope)):
    branch_id = payload.branch_id or outlet_id
    _branch_ok(current_user, branch_id)
    raw = decode_file(payload.file_type, payload.file_base64)
    digest = hashlib.sha256(raw).hexdigest()
    duplicate = db.query(AIDocument).filter(AIDocument.company_id == current_user.company_id, AIDocument.sha256 == digest).first()
    if duplicate:
        return {'success': True, 'duplicate': True, 'data': {'id': duplicate.id, 'status': duplicate.status, 'file_name': duplicate.file_name, 'is_duplicate': True, 'extracted_data': json.loads(duplicate.extracted_data) if duplicate.extracted_data else None}}
    upload_dir = os.path.join(os.getcwd(), 'uploads', 'ai-documents'); os.makedirs(upload_dir, exist_ok=True)
    safe_name = f'{uuid.uuid4().hex[:16]}_{os.path.basename(payload.file_name).replace(" ", "_")}'
    path = os.path.join(upload_dir, safe_name)
    with open(path,'wb') as f: f.write(raw)
    doc = AIDocument(company_id=current_user.company_id, branch_id=branch_id, uploaded_by_id=current_user.id, document_type=payload.document_type.upper(), file_name=payload.file_name, file_type=payload.file_type, storage_ref=f'uploads/ai-documents/{safe_name}', sha256=digest, status='UPLOADED')
    db.add(doc); db.flush()
    text = extract_text(raw, payload.file_type); doc.extracted_text = text
    data = deterministic_fields(text)
    if payload.auto_extract:
        try:
            ai_data, provider, model = ai_extract(text)
            data.update({k:v for k,v in ai_data.items() if v not in (None,'',[])})
            doc.provider, doc.model = provider, model; doc.status = 'PROCESSED'
        except AIProviderError as exc:
            doc.status = 'REVIEW_REQUIRED'; doc.error_message = str(exc)
        except Exception as exc:
            doc.status = 'REVIEW_REQUIRED'; doc.error_message = str(exc)
    else:
        doc.status = 'TEXT_EXTRACTED' if text else 'REVIEW_REQUIRED'
    doc.extracted_data = json.dumps(data, default=str); doc.processed_at = datetime.utcnow()
    db.commit(); db.refresh(doc)
    return {'success': True, 'duplicate': False, 'data': {'id': doc.id, 'status': doc.status, 'file_name': doc.file_name, 'storage_ref': doc.storage_ref, 'extracted_data': data, 'provider': doc.provider, 'model': doc.model, 'is_duplicate': False, 'created_at': doc.created_at.isoformat(), 'processed_at': doc.processed_at.isoformat()}}

@router.get('')
def list_documents(status_filter: str|None=None, db: Session=Depends(get_db), current_user: User=Depends(require_permission('ai:query'))):
    q=db.query(AIDocument).filter(AIDocument.company_id==current_user.company_id)
    if status_filter: q=q.filter(AIDocument.status==status_filter)
    rows=q.order_by(AIDocument.created_at.desc()).limit(100).all()
    return {'success':True,'data':[{'id':x.id,'file_name':x.file_name,'document_type':x.document_type,'status':x.status,'provider':x.provider,'model':x.model,'created_at':x.created_at.isoformat(),'processed_at':x.processed_at.isoformat() if x.processed_at else None} for x in rows]}
