import logging
from app.core.database import engine, Base
from app.models.customer_support import Complaint

logger = logging.getLogger(__name__)

def ensure_customer_support_schema():
    try:
        Complaint.__table__.create(bind=engine, checkfirst=True)
    except Exception as exc:
        logger.warning('Customer support schema bootstrap skipped: %s', exc)
