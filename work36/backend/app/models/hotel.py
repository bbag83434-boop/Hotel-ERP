import enum
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Float, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class RoomStatus(str, enum.Enum):
    AVAILABLE='AVAILABLE'; OCCUPIED='OCCUPIED'; DIRTY='DIRTY'; INSPECTION='INSPECTION'; OUT_OF_ORDER='OUT_OF_ORDER'
class BookingStatus(str, enum.Enum):
    RESERVED='RESERVED'; CHECKED_IN='CHECKED_IN'; CHECKED_OUT='CHECKED_OUT'; CANCELLED='CANCELLED'
class HousekeepingStatus(str, enum.Enum):
    PENDING='PENDING'; IN_PROGRESS='IN_PROGRESS'; COMPLETED='COMPLETED'; INSPECTED='INSPECTED'
class HousekeepingType(str, enum.Enum):
    DAILY_CLEAN='DAILY_CLEAN'; DEEP_CLEAN='DEEP_CLEAN'; CHECKOUT_CLEAN='CHECKOUT_CLEAN'; TURNDOWN='TURNDOWN'; INSPECTION='INSPECTION'

class HotelRoom(BaseModel):
    __tablename__='hotel_rooms'
    company_id=Column(String(36),ForeignKey('companies.id'),nullable=False,index=True)
    branch_id=Column(String(36),ForeignKey('branches.id'),nullable=False,index=True)
    room_number=Column(String(50),nullable=False,index=True)
    room_type=Column(String(100),nullable=False)
    floor=Column(String(50),nullable=True)
    capacity=Column(Float,default=2,nullable=False)
    base_rate=Column(Float,default=0,nullable=False)
    status=Column(Enum(RoomStatus),default=RoomStatus.AVAILABLE,nullable=False,index=True)
    is_active=Column(Boolean,default=True,nullable=False)
    amenities=Column(String(1000),nullable=True)

class HotelBooking(BaseModel):
    __tablename__='hotel_bookings'
    company_id=Column(String(36),ForeignKey('companies.id'),nullable=False,index=True)
    branch_id=Column(String(36),ForeignKey('branches.id'),nullable=False,index=True)
    room_id=Column(String(36),ForeignKey('hotel_rooms.id'),nullable=False,index=True)
    booking_number=Column(String(80),nullable=False,unique=True,index=True)
    guest_name=Column(String(255),nullable=False)
    guest_phone=Column(String(50),nullable=True)
    guest_email=Column(String(255),nullable=True)
    check_in=Column(DateTime,nullable=False,index=True)
    check_out=Column(DateTime,nullable=False,index=True)
    adults=Column(Float,default=1,nullable=False)
    children=Column(Float,default=0,nullable=False)
    rate=Column(Float,default=0,nullable=False)
    status=Column(Enum(BookingStatus),default=BookingStatus.RESERVED,nullable=False,index=True)
    notes=Column(String(1000),nullable=True)
    room=relationship('HotelRoom')

class HousekeepingTask(BaseModel):
    __tablename__='hotel_housekeeping_tasks'
    company_id=Column(String(36),ForeignKey('companies.id'),nullable=False,index=True)
    branch_id=Column(String(36),ForeignKey('branches.id'),nullable=False,index=True)
    room_id=Column(String(36),ForeignKey('hotel_rooms.id'),nullable=False,index=True)
    task_type=Column(Enum(HousekeepingType),default=HousekeepingType.DAILY_CLEAN,nullable=False)
    status=Column(Enum(HousekeepingStatus),default=HousekeepingStatus.PENDING,nullable=False,index=True)
    assigned_to_id=Column(String(36),ForeignKey('users.id'),nullable=True)
    scheduled_for=Column(DateTime,nullable=False,index=True)
    completed_at=Column(DateTime,nullable=True)
    notes=Column(String(1000),nullable=True)
    room=relationship('HotelRoom')
