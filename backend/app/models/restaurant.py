from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, Numeric, Enum as SQLEnum, Text
from sqlalchemy.orm import relationship, synonym
import enum
from app.models.base import BaseModel

class OrderStatus(str, enum.Enum):
    OPEN = "OPEN"
    SENT_TO_KITCHEN = "SENT_TO_KITCHEN"
    IN_PREPARATION = "IN_PREPARATION"
    READY = "READY"
    SERVED = "SERVED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class OrderItemStatus(str, enum.Enum):
    PENDING = "PENDING"
    PREPARING = "PREPARING"
    READY = "READY"
    SERVED = "SERVED"
    CANCELLED = "CANCELLED"

class Floor(BaseModel):
    __tablename__ = "floors"

    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    floor_number = Column("floorNumber", Integer, default=1, nullable=False)

    branchId = synonym("branch_id")
    floorNumber = synonym("floor_number")

class TableStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    OCCUPIED = "OCCUPIED"
    RESERVED = "RESERVED"
    CLEANING = "CLEANING"
    BLOCKED = "BLOCKED"

class DiningTable(BaseModel):
    __tablename__ = "dining_tables"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    table_number = Column("tableNumber", String(50), nullable=False)
    name = Column(String(255), nullable=True)
    capacity = Column(Integer, default=4, nullable=False)
    section = Column(String(100), default="Main Hall", nullable=False)
    status = Column(SQLEnum(TableStatus, name="TableStatus"), default=TableStatus.AVAILABLE, nullable=False)
    active_order_id = Column("activeOrderId", String(36), nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)

    companyId = synonym("company_id")
    branchId = synonym("branch_id")
    tableNumber = synonym("table_number")
    activeOrderId = synonym("active_order_id")
    isActive = synonym("is_active")

    orders = relationship("RestaurantOrder", back_populates="table")

class Menu(BaseModel):
    __tablename__ = "menus"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=True, index=True)
    description = Column(Text, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)

    companyId = synonym("company_id")
    branchId = synonym("branch_id")
    isActive = synonym("is_active")

    categories = relationship("MenuCategory", back_populates="menu", cascade="all, delete-orphan")
    items = relationship("MenuItem", back_populates="menu", cascade="all, delete-orphan")

class MenuCategory(BaseModel):
    __tablename__ = "menu_categories"

    menu_id = Column("menuId", String(36), ForeignKey("menus.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=True, index=True)
    sort_order = Column("sortOrder", Integer, default=0, nullable=False)
    icon = Column(String(50), nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)

    menuId = synonym("menu_id")
    sortOrder = synonym("sort_order")
    isActive = synonym("is_active")

    menu = relationship("Menu", back_populates="categories")
    items = relationship("MenuItem", back_populates="category")

class MenuItem(BaseModel):
    __tablename__ = "menu_items"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    menu_id = Column("menuId", String(36), ForeignKey("menus.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column("categoryId", String(36), ForeignKey("menu_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    finished_item_id = Column("finishedItemId", String(36), nullable=True)
    recipe_id = Column("recipeId", String(36), nullable=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=True, index=True)
    description = Column(Text, nullable=True)
    price = Column(Numeric(14, 4), default=0, nullable=False)
    cost_price = Column("costPrice", Numeric(14, 4), default=0, nullable=False)
    tax_rate = Column("taxRate", Numeric(8, 4), default=0, nullable=False)
    preparation_minutes = Column("preparationMinutes", Integer, default=15, nullable=False)
    is_available = Column("isAvailable", Boolean, default=True, nullable=False)
    image_url = Column("imageUrl", Text, nullable=True)

    companyId = synonym("company_id")
    menuId = synonym("menu_id")
    categoryId = synonym("category_id")
    finishedItemId = synonym("finished_item_id")
    recipeId = synonym("recipe_id")
    costPrice = synonym("cost_price")
    taxRate = synonym("tax_rate")
    preparationMinutes = synonym("preparation_minutes")
    isAvailable = synonym("is_available")
    imageUrl = synonym("image_url")

    menu = relationship("Menu", back_populates="items")
    category = relationship("MenuCategory", back_populates="items")

class RestaurantOrder(BaseModel):
    __tablename__ = "restaurant_orders"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    table_id = Column("tableId", String(36), ForeignKey("dining_tables.id", ondelete="SET NULL"), nullable=True, index=True)
    order_number = Column("orderNumber", String(50), unique=True, nullable=False, index=True)
    source = Column("source", String(20), default="MANUAL", nullable=False, index=True)
    external_order_id = Column("externalOrderId", String(100), nullable=True, index=True)
    status = Column("status", String(50), default="COMPLETED", nullable=False, index=True)
    guest_count = Column("guestCount", Integer, default=1, nullable=False)
    customer_name = Column("customerName", String(255), nullable=True)
    customer_phone = Column("customerPhone", String(50), nullable=True)
    sub_total = Column("subtotal", Numeric(14, 4), default=0, nullable=False)
    tax_amount = Column("taxAmount", Numeric(14, 4), default=0, nullable=False)
    discount_amount = Column("discountAmount", Numeric(14, 4), default=0, nullable=False)
    total_amount = Column("grandTotal", Numeric(14, 4), default=0, nullable=False)
    paid_amount = Column("paidAmount", Numeric(14, 4), default=0, nullable=True)
    notes = Column(Text, nullable=True)

    companyId = synonym("company_id")
    branchId = synonym("branch_id")
    tableId = synonym("table_id")
    orderNumber = synonym("order_number")
    externalOrderId = synonym("external_order_id")
    guestCount = synonym("guest_count")
    customerName = synonym("customer_name")
    customerPhone = synonym("customer_phone")
    subtotal = synonym("sub_total")
    taxAmount = synonym("tax_amount")
    discountAmount = synonym("discount_amount")
    grandTotal = synonym("total_amount")
    paidAmount = synonym("paid_amount")

    table = relationship("DiningTable", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(BaseModel):
    __tablename__ = "order_items"

    order_id = Column("orderId", String(36), ForeignKey("restaurant_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column("menuItemId", String(36), ForeignKey("menu_items.id"), nullable=False, index=True)
    name = Column(String(255), nullable=True)
    quantity = Column(Numeric(14, 4), default=1, nullable=False)
    unit_price = Column("unitPrice", Numeric(14, 4), nullable=False)
    total_price = Column("totalPrice", Numeric(14, 4), nullable=False)
    cogs_amount = Column("cogsAmount", Numeric(14, 4), default=0, nullable=True)
    status = Column("status", String(50), default="SERVED", nullable=True)
    notes = Column(Text, nullable=True)

    orderId = synonym("order_id")
    menuItemId = synonym("item_id")
    unitPrice = synonym("unit_price")
    totalPrice = synonym("total_price")
    cogsAmount = synonym("cogs_amount")

    order = relationship("RestaurantOrder", back_populates="items")
