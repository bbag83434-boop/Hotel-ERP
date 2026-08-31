from app.core.database import Base, engine
from app.models import HotelRoom, HotelBooking, HousekeepingTask

def ensure_hotel_schema():
    Base.metadata.create_all(bind=engine, tables=[HotelRoom.__table__, HotelBooking.__table__, HousekeepingTask.__table__])
