import logging
from sqlalchemy import text
from app.core.database import engine, Base
from app.models.billing import VendorBill, VendorBillItem, VendorBillGRNLink, Payment

logger = logging.getLogger(__name__)

def ensure_billing_schema():
    Base.metadata.create_all(bind=engine, tables=[VendorBill.__table__, VendorBillItem.__table__, VendorBillGRNLink.__table__, Payment.__table__])
    # Existing deployments may already have payments; add the optional bill link idempotently.
    with engine.begin() as conn:
        try:
            conn.execute(text('ALTER TABLE payments ADD COLUMN IF NOT EXISTS "billId" VARCHAR(36)'))
            conn.execute(text('CREATE INDEX IF NOT EXISTS ix_payments_billId ON payments ("billId")'))
        except Exception as exc:
            logger.warning('Billing bill-link migration skipped: %s', exc)
