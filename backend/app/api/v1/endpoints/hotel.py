import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_active_user
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException
from app.models.user import User, UserBranch
from app.models.organization import Branch
from app.models.audit import AuditLog
from app.models.hotel import HotelRoom, HotelBooking, HousekeepingTask, RoomStatus, BookingStatus, HousekeepingStatus
from app.schemas.hotel import RoomCreate, RoomUpdate, RoomResponse, BookingCreate, BookingUpdate, BookingResponse, HousekeepingCreate, HousekeepingUpdate, HousekeepingResponse, HotelSummary
router=APIRouter()
ADMIN={'ADMIN','SUPER_ADMIN','SUPERADMIN','OWNER','DIRECTOR','HQ_ADMIN','HEAD_OFFICE_ADMIN','GENERAL_MANAGER','AREA_MANAGER'}
def admin(u): return bool(u.role and u.role.name.upper() in ADMIN)
def access(branch_id,u,db):
    b=db.query(Branch).filter(Branch.id==branch_id,Branch.company_id==u.company_id).first()
    if not b: raise NotFoundException('Outlet not found.')
    if not admin(u) and not db.query(UserBranch).filter(UserBranch.user_id==u.id,UserBranch.branch_id==branch_id).first(): raise ForbiddenException('Access denied for this outlet.')
    return b
def visible(q,model,u,db,branch_id=None):
    q=q.filter(model.company_id==u.company_id)
    if branch_id: access(branch_id,u,db); return q.filter(model.branch_id==branch_id)
    if not admin(u):
        ids=[x[0] for x in db.query(UserBranch.branch_id).filter(UserBranch.user_id==u.id).all()]; q=q.filter(model.branch_id.in_(ids))
    return q
def audit(db,u,action,entity,eid,detail): db.add(AuditLog(id=str(uuid.uuid4()),user_id=u.id,action=action,entity=entity,entity_id=eid,details=detail))
def room_resp(r): return RoomResponse.model_validate(r)
def booking_resp(b): return BookingResponse(id=b.id,branch_id=b.branch_id,room_id=b.room_id,room_number=b.room.room_number if b.room else None,booking_number=b.booking_number,guest_name=b.guest_name,guest_phone=b.guest_phone,guest_email=b.guest_email,check_in=b.check_in,check_out=b.check_out,adults=b.adults,children=b.children,rate=b.rate,status=b.status,notes=b.notes)
def hk_resp(t): return HousekeepingResponse(id=t.id,branch_id=t.branch_id,room_id=t.room_id,room_number=t.room.room_number if t.room else None,task_type=t.task_type,status=t.status,assigned_to_id=t.assigned_to_id,scheduled_for=t.scheduled_for,completed_at=t.completed_at,notes=t.notes)
@router.get('/summary',response_model=HotelSummary)
def summary(branch_id:Optional[str]=None,u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    q=visible(db.query(HotelRoom),HotelRoom,u,db,branch_id); rooms=q.filter(HotelRoom.is_active.is_(True)).all(); total=len(rooms)
    counts={s.value:sum(1 for r in rooms if getattr(r.status,'value',r.status)==s.value) for s in RoomStatus}
    bq=visible(db.query(HotelBooking),HotelBooking,u,db,branch_id); active=bq.filter(HotelBooking.status.in_([BookingStatus.RESERVED,BookingStatus.CHECKED_IN])).count()
    hq=visible(db.query(HousekeepingTask),HousekeepingTask,u,db,branch_id); pending=hq.filter(HousekeepingTask.status.in_([HousekeepingStatus.PENDING,HousekeepingStatus.IN_PROGRESS])).count()
    return HotelSummary(total_rooms=total,available_rooms=counts['AVAILABLE'],occupied_rooms=counts['OCCUPIED'],dirty_rooms=counts['DIRTY'],out_of_order_rooms=counts['OUT_OF_ORDER'],active_bookings=active,pending_housekeeping=pending,occupancy_rate=round((counts['OCCUPIED']/total*100) if total else 0,2))
@router.get('/rooms',response_model=list[RoomResponse])
def rooms(branch_id:Optional[str]=None,search:Optional[str]=None,status:Optional[RoomStatus]=None,u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    q=visible(db.query(HotelRoom),HotelRoom,u,db,branch_id)
    if search:q=q.filter(or_(HotelRoom.room_number.ilike(f'%{search}%'),HotelRoom.room_type.ilike(f'%{search}%')))
    if status:q=q.filter(HotelRoom.status==status)
    return q.order_by(HotelRoom.room_number).all()
@router.post('/rooms',response_model=RoomResponse,status_code=201)
def create_room(p:RoomCreate,u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    access(p.branch_id,u,db)
    if db.query(HotelRoom).filter(HotelRoom.company_id==u.company_id,HotelRoom.branch_id==p.branch_id,HotelRoom.room_number==p.room_number).first(): raise BadRequestException('Room number already exists in this outlet.')
    r=HotelRoom(id=str(uuid.uuid4()),company_id=u.company_id,status=RoomStatus.AVAILABLE,is_active=True,**p.model_dump());db.add(r);audit(db,u,'CREATE','HotelRoom',r.id,r.room_number);db.commit();db.refresh(r);return r
@router.patch('/rooms/{room_id}',response_model=RoomResponse)
def update_room(room_id:str,p:RoomUpdate,u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    r=db.query(HotelRoom).filter(HotelRoom.id==room_id,HotelRoom.company_id==u.company_id).first()
    if not r: raise NotFoundException('Room not found.')
    access(r.branch_id,u,db)
    for k,v in p.model_dump(exclude_unset=True).items(): setattr(r,k,v)
    audit(db,u,'UPDATE','HotelRoom',r.id,str(p.model_dump(exclude_unset=True)));db.commit();db.refresh(r);return r
@router.get('/bookings',response_model=list[BookingResponse])
def bookings(branch_id:Optional[str]=None,status:Optional[BookingStatus]=None,search:Optional[str]=None,u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    q=visible(db.query(HotelBooking),HotelBooking,u,db,branch_id).join(HotelRoom,HotelBooking.room_id==HotelRoom.id)
    if status:q=q.filter(HotelBooking.status==status)
    if search:q=q.filter(or_(HotelBooking.booking_number.ilike(f'%{search}%'),HotelBooking.guest_name.ilike(f'%{search}%'),HotelRoom.room_number.ilike(f'%{search}%')))
    return q.order_by(HotelBooking.check_in.desc()).all()
@router.post('/bookings',response_model=BookingResponse,status_code=201)
def create_booking(p:BookingCreate,u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    access(p.branch_id,u,db)
    if p.check_out<=p.check_in: raise BadRequestException('Check-out must be after check-in.')
    room=db.query(HotelRoom).filter(HotelRoom.id==p.room_id,HotelRoom.company_id==u.company_id,HotelRoom.branch_id==p.branch_id,HotelRoom.is_active.is_(True)).first()
    if not room: raise NotFoundException('Room not found.')
    if room.status==RoomStatus.OUT_OF_ORDER: raise BadRequestException('Room is out of order.')
    overlap=db.query(HotelBooking).filter(HotelBooking.room_id==room.id,HotelBooking.status.in_([BookingStatus.RESERVED,BookingStatus.CHECKED_IN]),HotelBooking.check_in<p.check_out,HotelBooking.check_out>p.check_in).first()
    if overlap: raise BadRequestException('Room is already booked for the selected period.')
    n=f"HTL-{datetime.utcnow().strftime('%Y%m%d')}-{db.query(func.count(HotelBooking.id)).filter(HotelBooking.company_id==u.company_id).scalar()+1:04d}"
    b=HotelBooking(id=str(uuid.uuid4()),company_id=u.company_id,booking_number=n,status=BookingStatus.RESERVED,**p.model_dump());db.add(b);audit(db,u,'CREATE','HotelBooking',b.id,n);db.commit();db.refresh(b);return b
@router.patch('/bookings/{booking_id}',response_model=BookingResponse)
def update_booking(booking_id:str,p:BookingUpdate,u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    b=db.query(HotelBooking).filter(HotelBooking.id==booking_id,HotelBooking.company_id==u.company_id).first()
    if not b: raise NotFoundException('Booking not found.')
    access(b.branch_id,u,db)
    data=p.model_dump(exclude_unset=True)
    if data.get('status')==BookingStatus.CHECKED_IN: b.room.status=RoomStatus.OCCUPIED
    if data.get('status')==BookingStatus.CHECKED_OUT: b.room.status=RoomStatus.DIRTY
    if data.get('status')==BookingStatus.CANCELLED and b.room.status==RoomStatus.OCCUPIED: b.room.status=RoomStatus.DIRTY
    for k,v in data.items(): setattr(b,k,v)
    audit(db,u,'UPDATE','HotelBooking',b.id,str(data));db.commit();db.refresh(b);return b
@router.get('/housekeeping',response_model=list[HousekeepingResponse])
def housekeeping(branch_id:Optional[str]=None,status:Optional[HousekeepingStatus]=None,u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    q=visible(db.query(HousekeepingTask),HousekeepingTask,u,db,branch_id).join(HotelRoom,HousekeepingTask.room_id==HotelRoom.id)
    if status:q=q.filter(HousekeepingTask.status==status)
    return q.order_by(HousekeepingTask.scheduled_for.asc()).all()
@router.post('/housekeeping',response_model=HousekeepingResponse,status_code=201)
def create_hk(p:HousekeepingCreate,u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    access(p.branch_id,u,db); r=db.query(HotelRoom).filter(HotelRoom.id==p.room_id,HotelRoom.company_id==u.company_id,HotelRoom.branch_id==p.branch_id).first()
    if not r: raise NotFoundException('Room not found.')
    t=HousekeepingTask(id=str(uuid.uuid4()),company_id=u.company_id,status=HousekeepingStatus.PENDING,**p.model_dump());db.add(t);audit(db,u,'CREATE','HousekeepingTask',t.id,f'Room {r.room_number}');db.commit();db.refresh(t);return t
@router.patch('/housekeeping/{task_id}',response_model=HousekeepingResponse)
def update_hk(task_id:str,p:HousekeepingUpdate,u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    t=db.query(HousekeepingTask).filter(HousekeepingTask.id==task_id,HousekeepingTask.company_id==u.company_id).first()
    if not t: raise NotFoundException('Housekeeping task not found.')
    access(t.branch_id,u,db);data=p.model_dump(exclude_unset=True)
    for k,v in data.items(): setattr(t,k,v)
    if t.status==HousekeepingStatus.COMPLETED: t.completed_at=datetime.utcnow(); t.room.status=RoomStatus.INSPECTION
    if t.status==HousekeepingStatus.INSPECTED: t.completed_at=t.completed_at or datetime.utcnow(); t.room.status=RoomStatus.AVAILABLE
    audit(db,u,'UPDATE','HousekeepingTask',t.id,str(data));db.commit();db.refresh(t);return t
