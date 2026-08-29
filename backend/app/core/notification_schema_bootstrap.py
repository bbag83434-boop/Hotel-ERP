from app.core.database import engine, Base
from app.models.notification import Notification

def ensure_notification_schema():
    Base.metadata.create_all(bind=engine, tables=[Notification.__table__])
