from __future__ import annotations
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, BackgroundTasks, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.core.database import get_db
from app.core.auth import get_current_active_user, require_permission
from app.core.exceptions import BadRequestException, NotFoundException, ForbiddenException
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.user import User, UserBranch
from app.models.organization import Branch
from app.models.notification import Notification, NotificationStatus, NotificationChannel
from app.models.telegram import TelegramUserLink
from app.models.audit import AuditLog
from app.services.telegram import send_message, configured, set_webhook, delete_webhook, TelegramError

router = APIRouter()

class TestTelegramRequest(BaseModel):
    chat_id: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1, max_length=4000)

class QueueNotificationRequest(BaseModel):
    chat_id: Optional[str] = Field(None, max_length=255)
    title: Optional[str] = Field(None, max_length=255)
    message: str = Field(..., min_length=1, max_length=4000)
    event_type: Optional[str] = Field(None, max_length=80)
    branch_id: Optional[str] = None
    idempotency_key: Optional[str] = Field(None, min_length=8, max_length=255)


def branch_ok(db, user, branch_id):
    if branch_id and not db.query(Branch).filter(Branch.id == branch_id, Branch.company_id == user.company_id).first():
        raise ForbiddenException('Invalid outlet scope')


def serialize(n):
    return {'id': n.id, 'branchId': n.branch_id, 'channel': n.channel.value if hasattr(n.channel, 'value') else n.channel,
            'chatId': n.chat_id, 'title': n.title, 'message': n.message, 'status': n.status.value if hasattr(n.status, 'value') else n.status,
            'attempts': n.attempts, 'lastError': n.last_error, 'sentAt': n.sent_at, 'eventType': n.event_type,
            'createdAt': n.created_at}

def _role_name(user: User) -> str:
    return (user.role.name if user.role else "").upper()

def _is_telegram_admin(user: User) -> bool:
    return _role_name(user) in {"SUPER_ADMIN", "OWNER", "HQ_ADMIN"}

def _allowed_chat_ids() -> set[str]:
    return {x.strip() for x in (settings.TELEGRAM_ALLOWED_CHAT_IDS or "").split(",") if x.strip()}

def _telegram_link_for_chat(db: Session, chat_id: str):
    return db.query(TelegramUserLink).filter(TelegramUserLink.chat_id == str(chat_id), TelegramUserLink.is_active == True).first()

class TelegramLinkRequest(BaseModel):
    chat_id: str = Field(..., min_length=1, max_length=255)
    user_id: str
    branch_id: Optional[str] = None
    telegram_user_id: Optional[str] = Field(None, max_length=255)
    username: Optional[str] = Field(None, max_length=255)

class TelegramWebhookUpdate(BaseModel):
    update_id: int
    message: Optional[dict] = None

class TelegramWebhookConfigRequest(BaseModel):
    public_url: Optional[str] = Field(None, max_length=1000)

@router.get('/status')
def status_info(user: User = Depends(require_permission('reports:read'))):
    return {'success': True, 'data': {'configured': configured(), 'default_chat_configured': bool(settings.TELEGRAM_DEFAULT_CHAT_ID), 'channel': 'TELEGRAM', 'free_bot_api': True, 'webhook_configured': bool(settings.TELEGRAM_WEBHOOK_PUBLIC_URL), 'inbound_authentication': 'secret-token + linked-chat'}}

@router.post('/telegram/link', status_code=201)
def link_telegram_chat(payload: TelegramLinkRequest, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if not _is_telegram_admin(user):
        raise ForbiddenException('Only Head Office administrators can link Telegram chats.')
    target = db.query(User).filter(User.id == payload.user_id, User.company_id == user.company_id, User.is_active == True).first()
    if not target:
        raise NotFoundException('User not found.')
    if payload.branch_id:
        branch_ok(db, user, payload.branch_id)
        if not any(b.branch_id == payload.branch_id for b in target.branches) and _role_name(target) not in {"SUPER_ADMIN", "OWNER", "HQ_ADMIN"}:
            raise ForbiddenException('Target user is not assigned to the selected outlet.')
    existing = db.query(TelegramUserLink).filter(TelegramUserLink.chat_id == payload.chat_id).first()
    if existing and existing.company_id != user.company_id:
        raise ForbiddenException('Telegram chat is already linked to another company.')
    if existing:
        existing.user_id = target.id; existing.branch_id = payload.branch_id; existing.telegram_user_id = payload.telegram_user_id
        existing.username = payload.username; existing.is_active = True; existing.linked_at = datetime.utcnow()
        link = existing
    else:
        link = TelegramUserLink(company_id=user.company_id, user_id=target.id, branch_id=payload.branch_id, chat_id=payload.chat_id, telegram_user_id=payload.telegram_user_id, username=payload.username)
        db.add(link)
    db.add(AuditLog(user_id=user.id, action='TELEGRAM_CHAT_LINKED', entity_type='TelegramUserLink', entity_id=link.id, details=f'chat_id={payload.chat_id};target_user={target.id};branch_id={payload.branch_id or "HQ"}'))
    db.commit(); db.refresh(link)
    return {'success': True, 'data': {'id': link.id, 'chat_id': link.chat_id, 'user_id': link.user_id, 'branch_id': link.branch_id, 'username': link.username, 'is_active': link.is_active}}

@router.get('/telegram/links')
def telegram_links(user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if not _is_telegram_admin(user):
        raise ForbiddenException('Only Head Office administrators can view Telegram links.')
    rows = db.query(TelegramUserLink).filter(TelegramUserLink.company_id == user.company_id).order_by(desc(TelegramUserLink.linked_at)).limit(500).all()
    return {'success': True, 'data': [{'id': x.id, 'chat_id': x.chat_id, 'user_id': x.user_id, 'branch_id': x.branch_id, 'username': x.username, 'is_active': x.is_active, 'last_seen_at': x.last_seen_at} for x in rows]}

@router.delete('/telegram/links/{link_id}')
def unlink_telegram_chat(link_id: str, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if not _is_telegram_admin(user):
        raise ForbiddenException('Only Head Office administrators can unlink Telegram chats.')
    link = db.query(TelegramUserLink).filter(TelegramUserLink.id == link_id, TelegramUserLink.company_id == user.company_id).first()
    if not link:
        raise NotFoundException('Telegram link not found.')
    link.is_active = False
    db.add(AuditLog(user_id=user.id, action='TELEGRAM_CHAT_UNLINKED', entity_type='TelegramUserLink', entity_id=link.id, details=f'chat_id={link.chat_id}'))
    db.commit()
    return {'success': True, 'data': {'id': link.id, 'is_active': False}}

@router.post('/telegram/webhook/configure')
async def configure_telegram_webhook(payload: TelegramWebhookConfigRequest, user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if not _is_telegram_admin(user):
        raise ForbiddenException('Only Head Office administrators can configure the Telegram webhook.')
    if not configured():
        raise BadRequestException('Telegram bot is not configured.')
    public_url = (payload.public_url or settings.TELEGRAM_WEBHOOK_PUBLIC_URL or '').strip().rstrip('/')
    if not public_url.startswith('https://'):
        raise BadRequestException('Telegram webhook public URL must use HTTPS.')
    if not settings.TELEGRAM_WEBHOOK_SECRET or len(settings.TELEGRAM_WEBHOOK_SECRET) < 16:
        raise BadRequestException('Set TELEGRAM_WEBHOOK_SECRET to at least 16 characters.')
    webhook_url = public_url + '/api/v1/notifications/telegram/webhook'
    try:
        result = await set_webhook(webhook_url, settings.TELEGRAM_WEBHOOK_SECRET)
    except TelegramError as exc:
        raise BadRequestException(str(exc)) from exc
    db.add(AuditLog(user_id=user.id, action='TELEGRAM_WEBHOOK_CONFIGURED', entity_type='TelegramWebhook', entity_id=None, details=f'url={webhook_url}'))
    db.commit()
    return {'success': True, 'data': {'url': webhook_url, 'telegram_ok': result.get('ok', False)}}

@router.delete('/telegram/webhook')
async def remove_telegram_webhook(user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if not _is_telegram_admin(user):
        raise ForbiddenException('Only Head Office administrators can remove the Telegram webhook.')
    if not configured():
        raise BadRequestException('Telegram bot is not configured.')
    try:
        result = await delete_webhook()
    except TelegramError as exc:
        raise BadRequestException(str(exc)) from exc
    db.add(AuditLog(user_id=user.id, action='TELEGRAM_WEBHOOK_REMOVED', entity_type='TelegramWebhook', entity_id=None, details='webhook removed'))
    db.commit()
    return {'success': True, 'data': {'telegram_ok': result.get('ok', False)}}

def _send_webhook_reply(chat_id: str, reply: str):
    import asyncio
    try:
        asyncio.run(send_message(chat_id, reply))
    except TelegramError:
        pass

@router.post('/telegram/webhook')
def telegram_webhook(update: TelegramWebhookUpdate, background_tasks: BackgroundTasks, x_telegram_bot_api_secret_token: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not settings.TELEGRAM_WEBHOOK_SECRET or x_telegram_bot_api_secret_token != settings.TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail='Invalid Telegram webhook secret.')
    message = update.message or {}
    chat = message.get('chat') or {}
    sender = message.get('from') or {}
    chat_id = str(chat.get('id') or '')
    text = str(message.get('text') or '').strip()
    if not chat_id:
        return {'ok': True}
    allowlist = _allowed_chat_ids()
    link = _telegram_link_for_chat(db, chat_id)
    if allowlist and chat_id not in allowlist:
        return {'ok': True}
    if not link:
        return {'ok': True, 'ignored': 'unlinked_chat'}
    link.last_seen_at = datetime.utcnow()
    link.telegram_user_id = str(sender.get('id') or link.telegram_user_id or '') or None
    link.username = sender.get('username') or link.username
    db.commit()
    # Reuse the existing deterministic Smart Requirement assistant; no new business logic or fake data.
    if text in {'/start', '/help'}:
        reply = ('APEX ERP Telegram Assistant\n\n'
                 'Supported: /stock, /lowstock, /order, /pending, /tomorrow\n'
                 'You can also ask a stock/purchase question in natural language.\n'
                 'Read-only queries only; approvals and mutations remain inside the ERP.')
    elif text in {'/stock', '/lowstock', '/order', '/pending', '/tomorrow'} or text:
        questions = {'/stock': 'status', '/lowstock': 'low stock', '/order': 'what do I need to order?', '/pending': 'what is pending?', '/tomorrow': 'what do I need for tomorrow?'}
        question = questions.get(text, text)
        if not link.branch_id:
            reply = 'This Telegram chat is linked to Head Office. Ask an outlet-specific question only after an outlet is assigned to the Telegram link.'
        else:
            from app.api.v1.endpoints.procurement import ask_smart_requirement_assistant
            from app.schemas.procurement import SmartAIAskRequest
            result = ask_smart_requirement_assistant(SmartAIAskRequest(branch_id=link.branch_id, question=question), db, db.query(User).filter(User.id == link.user_id).first())
            reply = result.answer_text
    else:
        reply = 'Unsupported Telegram request. Use /help.'
    # Webhook must stay fast and must not fail the update if outbound delivery is unavailable.
    background_tasks.add_task(_send_webhook_reply, chat_id, reply)
    return {'ok': True}

@router.post('/test')
async def test_telegram(payload: TestTelegramRequest, user: User = Depends(require_permission('reports:read')), db: Session = Depends(get_db)):
    try:
        result = await send_message(payload.chat_id, payload.message)
    except TelegramError as exc:
        raise BadRequestException(str(exc)) from exc
    db.add(AuditLog(user_id=user.id, action='TELEGRAM_TEST_SENT', entity_type='Notification', entity_id=None, details=f'chat_id={payload.chat_id}'))
    db.commit()
    return {'success': True, 'data': {'message_id': result.get('result', {}).get('message_id'), 'chat_id': payload.chat_id}}

def _deliver_notification(notification_id: str):
    db = SessionLocal()
    try:
        n = db.query(Notification).filter(Notification.id == notification_id).first()
        if not n or n.status != NotificationStatus.PENDING:
            return
        text = f'{n.title}\n\n{n.message}' if n.title else n.message
        try:
            import asyncio
            asyncio.run(send_message(n.chat_id, text))
            n.status = NotificationStatus.SENT
            n.attempts = (n.attempts or 0) + 1
            n.sent_at = datetime.utcnow()
            n.last_error = None
        except TelegramError as exc:
            n.status = NotificationStatus.FAILED
            n.attempts = (n.attempts or 0) + 1
            n.last_error = str(exc)
        db.commit()
    finally:
        db.close()

@router.post('/queue', status_code=201)
def queue_notification(payload: QueueNotificationRequest, background_tasks: BackgroundTasks, user: User = Depends(require_permission('reports:read')), db: Session = Depends(get_db)):
    chat_id = payload.chat_id or settings.TELEGRAM_DEFAULT_CHAT_ID
    if not chat_id:
        raise BadRequestException('Telegram chat ID is not configured.')
    branch_ok(db, user, payload.branch_id)
    if payload.idempotency_key:
        existing = db.query(Notification).filter(Notification.company_id == user.company_id, Notification.idempotency_key == payload.idempotency_key).first()
        if existing:
            return {'success': True, 'data': serialize(existing), 'deduplicated': True}
    n = Notification(company_id=user.company_id, branch_id=payload.branch_id, channel=NotificationChannel.TELEGRAM,
                     chat_id=chat_id, title=payload.title, message=payload.message, status=NotificationStatus.PENDING,
                     event_type=payload.event_type, idempotency_key=payload.idempotency_key)
    db.add(n)
    db.flush()
    db.add(AuditLog(user_id=user.id, action='TELEGRAM_NOTIFICATION_QUEUED', entity_type='Notification', entity_id=n.id, details=f'status=PENDING;event={payload.event_type or "MANUAL"}'))
    db.commit()
    db.refresh(n)
    background_tasks.add_task(_deliver_notification, n.id)
    return {'success': True, 'data': serialize(n)}

@router.get('/history')
def history(status_filter: Optional[str] = Query(None, alias='status'), branch_id: Optional[str] = None,
           user: User = Depends(require_permission('reports:read')), db: Session = Depends(get_db)):
    branch_ok(db, user, branch_id)
    q = db.query(Notification).filter(Notification.company_id == user.company_id)
    if branch_id: q = q.filter(Notification.branch_id == branch_id)
    if status_filter:
        try: q = q.filter(Notification.status == NotificationStatus(status_filter.upper()))
        except ValueError: raise BadRequestException('Invalid notification status')
    return {'success': True, 'data': [serialize(x) for x in q.order_by(desc(Notification.created_at)).limit(300).all()]}

@router.post('/retry/{notification_id}')
def retry(notification_id: str, background_tasks: BackgroundTasks, user: User = Depends(require_permission('reports:read')), db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notification_id, Notification.company_id == user.company_id).first()
    if not n: raise NotFoundException('Notification not found')
    if n.status != NotificationStatus.FAILED: raise BadRequestException('Only failed notifications can be retried')
    n.status = NotificationStatus.PENDING
    n.last_error = None
    db.add(AuditLog(user_id=user.id, action='TELEGRAM_NOTIFICATION_RETRY_QUEUED', entity_type='Notification', entity_id=n.id, details=f'attempt={n.attempts + 1}'))
    db.commit(); db.refresh(n)
    background_tasks.add_task(_deliver_notification, n.id)
    return {'success': True, 'data': serialize(n), 'queued': True}
