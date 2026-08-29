from __future__ import annotations
import json
from datetime import datetime
from fastapi import APIRouter, Depends, BackgroundTasks, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_active_user
from app.core.config import settings
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.user import User
from app.models.organization import Branch
from app.models.whatsapp import WhatsAppUserLink, WhatsAppMessageLog
from app.models.audit import AuditLog
from app.services.whatsapp import configured, verify_signature, send_text, WhatsAppError
from app.services.ai_engine import AIEngine

router = APIRouter()

def role_name(user): return (user.role.name if user.role else '').upper()
def is_admin(user): return role_name(user) in {'SUPER_ADMIN','OWNER','HQ_ADMIN'}

def assert_branch(db, user, branch_id):
    if not branch_id: return
    if not db.query(Branch).filter(Branch.id==branch_id, Branch.company_id==user.company_id).first():
        raise ForbiddenException('Invalid outlet scope.')
    if not is_admin(user) and not any(x.branch_id == branch_id for x in user.branches):
        raise ForbiddenException('User is not assigned to the selected outlet.')

class WhatsAppLinkRequest(BaseModel):
    wa_user_id: str = Field(..., min_length=3, max_length=64)
    phone_number_id: str = Field(..., min_length=3, max_length=64)
    user_id: str
    branch_id: str | None = None
    display_name: str | None = Field(None, max_length=255)

class WhatsAppWebhookConfigRequest(BaseModel):
    public_url: str | None = Field(None, max_length=1000)

@router.get('/status')
def status_info(user: User = Depends(get_current_active_user)):
    if not is_admin(user): raise ForbiddenException('Only Head Office administrators can view WhatsApp integration status.')
    return {'success':True,'data':{'configured':configured(),'channel':'WHATSAPP','provider':'Meta WhatsApp Cloud API','webhook_configured':bool(settings.WHATSAPP_WEBHOOK_PUBLIC_URL),'signature_verification':bool(settings.WHATSAPP_APP_SECRET),'production_mode':True}}

@router.post('/link', status_code=201)
def link(payload: WhatsAppLinkRequest, user: User=Depends(get_current_active_user), db: Session=Depends(get_db)):
    if not is_admin(user): raise ForbiddenException('Only Head Office administrators can link WhatsApp users.')
    target=db.query(User).filter(User.id==payload.user_id, User.company_id==user.company_id, User.is_active==True).first()
    if not target: raise NotFoundException('User not found.')
    assert_branch(db,user,payload.branch_id)
    if payload.branch_id and not is_admin(target) and not any(x.branch_id==payload.branch_id for x in target.branches):
        raise ForbiddenException('Target user is not assigned to the selected outlet.')
    existing=db.query(WhatsAppUserLink).filter(WhatsAppUserLink.phone_number_id==payload.phone_number_id, WhatsAppUserLink.wa_user_id==payload.wa_user_id).first()
    if existing and existing.company_id!=user.company_id: raise ForbiddenException('WhatsApp user is already linked to another company.')
    if existing:
        existing.user_id=target.id; existing.branch_id=payload.branch_id; existing.display_name=payload.display_name; existing.is_active=True; existing.linked_at=datetime.utcnow(); row=existing
    else:
        row=WhatsAppUserLink(company_id=user.company_id,user_id=target.id,branch_id=payload.branch_id,phone_number_id=payload.phone_number_id,wa_user_id=payload.wa_user_id,display_name=payload.display_name)
        db.add(row); db.flush()
    db.add(AuditLog(user_id=user.id,action='WHATSAPP_USER_LINKED',entity_type='WhatsAppUserLink',entity_id=row.id,details=json.dumps({'wa_user_id':payload.wa_user_id,'branch_id':payload.branch_id})))
    db.commit(); db.refresh(row)
    return {'success':True,'data':{'id':row.id,'wa_user_id':row.wa_user_id,'phone_number_id':row.phone_number_id,'user_id':row.user_id,'branch_id':row.branch_id,'display_name':row.display_name,'is_active':row.is_active}}

@router.get('/links')
def links(user: User=Depends(get_current_active_user), db: Session=Depends(get_db)):
    if not is_admin(user): raise ForbiddenException('Only Head Office administrators can view WhatsApp links.')
    rows=db.query(WhatsAppUserLink).filter(WhatsAppUserLink.company_id==user.company_id).order_by(WhatsAppUserLink.linked_at.desc()).limit(500).all()
    return {'success':True,'data':[{'id':x.id,'wa_user_id':x.wa_user_id,'phone_number_id':x.phone_number_id,'user_id':x.user_id,'branch_id':x.branch_id,'display_name':x.display_name,'is_active':x.is_active,'last_seen_at':x.last_seen_at} for x in rows]}

@router.delete('/links/{link_id}')
def unlink(link_id:str,user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    if not is_admin(user): raise ForbiddenException('Only Head Office administrators can unlink WhatsApp users.')
    row=db.query(WhatsAppUserLink).filter(WhatsAppUserLink.id==link_id,WhatsAppUserLink.company_id==user.company_id).first()
    if not row: raise NotFoundException('WhatsApp link not found.')
    row.is_active=False
    db.add(AuditLog(user_id=user.id,action='WHATSAPP_USER_UNLINKED',entity_type='WhatsAppUserLink',entity_id=row.id,details=f'wa_user_id={row.wa_user_id}'))
    db.commit(); return {'success':True,'data':{'id':row.id,'is_active':False}}

@router.post('/webhook/configure')
def configure(payload:WhatsAppWebhookConfigRequest,user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    if not is_admin(user): raise ForbiddenException('Only Head Office administrators can configure WhatsApp webhook.')
    if not settings.WHATSAPP_VERIFY_TOKEN or len(settings.WHATSAPP_VERIFY_TOKEN)<16: raise BadRequestException('Set WHATSAPP_VERIFY_TOKEN to at least 16 characters.')
    if not settings.WHATSAPP_APP_SECRET or len(settings.WHATSAPP_APP_SECRET)<16: raise BadRequestException('Set WHATSAPP_APP_SECRET to at least 16 characters.')
    public=(payload.public_url or settings.WHATSAPP_WEBHOOK_PUBLIC_URL or '').strip().rstrip('/')
    if not public.startswith('https://'): raise BadRequestException('WhatsApp webhook public URL must use HTTPS.')
    webhook_url=public+'/api/v1/whatsapp/webhook'
    db.add(AuditLog(user_id=user.id,action='WHATSAPP_WEBHOOK_CONFIGURED',entity_type='WhatsAppWebhook',entity_id=None,details=f'url={webhook_url}'))
    db.commit()
    return {'success':True,'data':{'url':webhook_url,'verification_token_configured':True,'signature_verification':True,'provider':'Meta WhatsApp Cloud API'}}

def _safe_reply(db:Session, link:WhatsAppUserLink, text:str):
    try:
        # Send happens outside the webhook request through FastAPI BackgroundTasks.
        import asyncio; asyncio.run(send_text(link.wa_user_id,text))
    except Exception: pass

def _answer(link:WhatsAppUserLink, text:str, db:Session) -> str:
    t=text.lower().strip()
    if t in {'help','/help'}:
        return 'APEX ERP WhatsApp commands:\n/stock — stock summary\n/lowstock — low stock items\n/purchase — purchase request summary\n/help — this help'
    if t in {'stock','/stock'}:
        data=AIEngine(db,link.branch_id).get_stock_recommendations() if link.branch_id else []
        if not data: return 'No current stock recommendations for your authorized outlet.'
        return 'Stock intelligence:\n'+'\n'.join(f"• {x['item_name']}: {x['current_quantity']} / min {x['min_stock_level']} → order {x['suggested_order_quantity']}" for x in data[:10])
    if t in {'lowstock','/lowstock','low stock'}:
        from app.models.inventory import StockBalance, Item
        from app.models.organization import Warehouse
        q=db.query(StockBalance).join(Warehouse,StockBalance.warehouse_id==Warehouse.id).join(Item,Item.id==StockBalance.item_id).filter(Warehouse.branch_id==link.branch_id,Item.company_id==link.company_id,StockBalance.quantity<=StockBalance.min_stock_level).limit(20).all() if link.branch_id else []
        return 'Low stock:\n'+'\n'.join(f"• {r.item.name}: {float(r.quantity or 0)} / min {float(r.min_stock_level or 0)}" for r in q) if q else 'No low-stock items found.'
    if t in {'purchase','/purchase','purchase summary'}:
        from app.models.procurement import PurchaseOrder, GoodsReceiveNote
        po=db.query(PurchaseOrder).filter(PurchaseOrder.company_id==link.company_id,PurchaseOrder.branch_id==link.branch_id).count() if link.branch_id else db.query(PurchaseOrder).filter(PurchaseOrder.company_id==link.company_id).count()
        grn=db.query(GoodsReceiveNote).filter(GoodsReceiveNote.company_id==link.company_id,GoodsReceiveNote.branch_id==link.branch_id).count() if link.branch_id else db.query(GoodsReceiveNote).filter(GoodsReceiveNote.company_id==link.company_id).count()
        return f'Purchase summary:\nPurchase Orders: {po}\nGoods Receipts: {grn}'
    return 'I can answer ERP queries through controlled WhatsApp tools. Try /stock, /lowstock, /purchase or /help.'

@router.get('/webhook')
def verify_webhook(hub_mode:str|None=Query(None,alias='hub.mode'),hub_verify_token:str|None=Query(None,alias='hub.verify_token'),hub_challenge:str|None=Query(None,alias='hub.challenge')):
    if hub_mode=='subscribe' and hub_verify_token and hub_verify_token==settings.WHATSAPP_VERIFY_TOKEN:
        return int(hub_challenge or '0')
    raise HTTPException(status_code=403,detail='WhatsApp webhook verification failed.')

@router.post('/webhook')
async def webhook(request:Request,background_tasks:BackgroundTasks,db:Session=Depends(get_db),x_hub_signature_256:str|None=Header(None)):
    raw=await request.body()
    if not verify_signature(raw,x_hub_signature_256): raise HTTPException(status_code=401,detail='Invalid WhatsApp webhook signature.')
    try: payload=json.loads(raw.decode('utf-8'))
    except Exception: raise HTTPException(status_code=400,detail='Invalid webhook JSON.')
    for entry in payload.get('entry') or []:
        for change in entry.get('changes') or []:
            value=change.get('value') or {}; metadata=value.get('metadata') or {}; phone_id=str(metadata.get('phone_number_id') or '')
            for msg in value.get('messages') or []:
                msg_id=str(msg.get('id') or ''); wa_id=str(msg.get('from') or '')
                if not msg_id or not wa_id: continue
                if db.query(WhatsAppMessageLog).filter(WhatsAppMessageLog.message_id==msg_id).first(): continue
                link=db.query(WhatsAppUserLink).filter(WhatsAppUserLink.phone_number_id==phone_id,WhatsAppUserLink.wa_user_id==wa_id,WhatsAppUserLink.is_active==True).first()
                body=((msg.get('text') or {}).get('body') if msg.get('type')=='text' else None)
                log=WhatsAppMessageLog(message_id=msg_id,company_id=link.company_id if link else None,branch_id=link.branch_id if link else None,wa_user_id=wa_id,direction='INBOUND',message_type=str(msg.get('type') or 'unknown'),body=body,status='RECEIVED')
                db.add(log)
                if link:
                    link.last_seen_at=datetime.utcnow()
                    if body:
                        reply=_answer(link,body,db)
                        background_tasks.add_task(_safe_reply,db,link,reply)
                db.commit()
    return {'ok':True}
