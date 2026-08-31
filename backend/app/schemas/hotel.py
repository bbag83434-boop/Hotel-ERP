from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.hotel import RoomStatus, BookingStatus, HousekeepingStatus, HousekeepingType

class RoomCreate(BaseModel):
    branch_id:str; room_number:str=Field(min_length=1,max_length=50); room_type:str=Field(min_length=1,max_length=100)
    floor:Optional[str]=None; capacity:float=Field(default=2,gt=0); base_rate:float=Field(default=0,ge=0); amenities:Optional[str]=None
class RoomUpdate(BaseModel):
    room_type:Optional[str]=None; floor:Optional[str]=None; capacity:Optional[float]=Field(default=None,gt=0); base_rate:Optional[float]=Field(default=None,ge=0); status:Optional[RoomStatus]=None; is_active:Optional[bool]=None; amenities:Optional[str]=None
class RoomResponse(BaseModel):
    id:str; branch_id:str; room_number:str; room_type:str; floor:Optional[str]; capacity:float; base_rate:float; status:RoomStatus; is_active:bool; amenities:Optional[str]
    class Config: from_attributes=True
class BookingCreate(BaseModel):
    branch_id:str; room_id:str; guest_name:str=Field(min_length=1,max_length=255); guest_phone:Optional[str]=None; guest_email:Optional[str]=None
    check_in:datetime; check_out:datetime; adults:float=Field(default=1,gt=0); children:float=Field(default=0,ge=0); rate:float=Field(default=0,ge=0); notes:Optional[str]=None
class BookingUpdate(BaseModel):
    status:Optional[BookingStatus]=None; guest_phone:Optional[str]=None; guest_email:Optional[str]=None; notes:Optional[str]=None; rate:Optional[float]=Field(default=None,ge=0)
class BookingResponse(BaseModel):
    id:str; branch_id:str; room_id:str; room_number:Optional[str]; booking_number:str; guest_name:str; guest_phone:Optional[str]; guest_email:Optional[str]; check_in:datetime; check_out:datetime; adults:float; children:float; rate:float; status:BookingStatus; notes:Optional[str]
class HousekeepingCreate(BaseModel):
    branch_id:str; room_id:str; task_type:HousekeepingType=HousekeepingType.DAILY_CLEAN; scheduled_for:datetime; assigned_to_id:Optional[str]=None; notes:Optional[str]=None
class HousekeepingUpdate(BaseModel):
    status:Optional[HousekeepingStatus]=None; assigned_to_id:Optional[str]=None; notes:Optional[str]=None
class HousekeepingResponse(BaseModel):
    id:str; branch_id:str; room_id:str; room_number:Optional[str]; task_type:HousekeepingType; status:HousekeepingStatus; assigned_to_id:Optional[str]; scheduled_for:datetime; completed_at:Optional[datetime]; notes:Optional[str]
class HotelSummary(BaseModel):
    total_rooms:int; available_rooms:int; occupied_rooms:int; dirty_rooms:int; out_of_order_rooms:int; active_bookings:int; pending_housekeeping:int; occupancy_rate:float
