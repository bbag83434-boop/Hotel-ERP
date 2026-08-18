from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, Numeric, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel

class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    PREPARING = "PREPARING"
    SERVED = "SERVED"
    BILLED = "BILLED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"

class Floor(BaseModel):
    __tablename__ = "floors"

    branch_id = Column(String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    floor_number = Column(Integer, default=1, nullable=False)

    tables = relationship("DiningTable", back_populates="floor")

class DiningTable(BaseModel):
    __tablename__ = "dining_tables"

    branch_id = Column(String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    floor_id = Column(String(36), ForeignKey("floors.id", ondelete="SET NULL"), nullable=True, index=True)
    table_number = Column(String(50), nullable=False)
    capacity = Column(Integer, default=4, nullable=False)
    is_occupied = Column(Boolean, default=False, nullable=False)

    floor = relationship("Floor", back_populates="tables")
    orders = relationship("RestaurantOrder", back_populates="table")

class RestaurantOrder(BaseModel):
    __tablename__ = "restaurant_orders"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    table_id = Column(String(36), ForeignKey("dining_tables.id", ondelete="SET NULL"), nullable=True, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    status = Column(SQLEnum(OrderStatus), default=OrderStatus.PENDING, nullable=False, index=True)
    guest_count = Column(Integer, default=1, nullable=False)
    sub_total = Column(Numeric(14, 4), default=0, nullable=False)
    tax_amount = Column(Numeric(14, 4), default=0, nullable=False)
    discount_amount = Column(Numeric(14, 4), default=0, nullable=False)
    total_amount = Column(Numeric(14, 4), default=0, nullable=False)

    table = relationship("DiningTable", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(BaseModel):
    __tablename__ = "order_items"

    order_id = Column(String(36), ForeignKey("restaurant_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(36), ForeignKey("items.id"), nullable=False, index=True)
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Numeric(14, 4), nullable=False)
    total_price = Column(Numeric(14, 4), nullable=False)
    notes = Column(String(255), nullable=True)

    order = relationship("RestaurantOrder", back_populates="items")
