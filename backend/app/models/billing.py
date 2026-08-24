from sqlalchemy import Column, String, ForeignKey, Numeric, DateTime, Enum as SQLEnum, Text, Index
from sqlalchemy.orm import relationship, synonym
from app.models.base import BaseModel
import enum
from datetime import datetime
from decimal import Decimal

class BillStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    VERIFIED = "VERIFIED"
    APPROVED = "APPROVED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"

class VendorBill(BaseModel):
    __tablename__ = "vendor_bills"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_id = Column("supplierId", String(36), ForeignKey("suppliers.id"), nullable=False, index=True)
    invoice_number = Column("invoiceNumber", String(100), nullable=False)
    invoice_date = Column("invoiceDate", DateTime, nullable=False)
    due_date = Column("dueDate", DateTime, nullable=True)
    status = Column(SQLEnum(BillStatus, name="BillStatus"), default=BillStatus.DRAFT, nullable=False)
    
    total_amount = Column("totalAmount", Numeric(14, 4), nullable=False)
    tax_amount = Column("taxAmount", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    net_amount = Column("netAmount", Numeric(14, 4), nullable=False)
    
    notes = Column(Text, nullable=True)
    approved_by_id = Column("approvedById", String(36), ForeignKey("users.id"), nullable=True)
    
    companyId = synonym("company_id")
    supplierId = synonym("supplier_id")
    invoiceNumber = synonym("invoice_number")
    invoiceDate = synonym("invoice_date")
    dueDate = synonym("due_date")
    totalAmount = synonym("total_amount")
    taxAmount = synonym("tax_amount")
    netAmount = synonym("net_amount")
    approvedById = synonym("approved_by_id")

    supplier = relationship("Supplier")
    items = relationship("VendorBillItem", back_populates="bill", cascade="all, delete-orphan")
    grn_links = relationship("VendorBillGRNLink", back_populates="bill", cascade="all, delete-orphan")

class VendorBillItem(BaseModel):
    __tablename__ = "vendor_bill_items"
    
    bill_id = Column("billId", String(36), ForeignKey("vendor_bills.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column("itemId", String(36), ForeignKey("items.id"), nullable=False, index=True)
    quantity = Column(Numeric(14, 4), nullable=False)
    unit_price = Column("unitPrice", Numeric(14, 4), nullable=False)
    total_price = Column("totalPrice", Numeric(14, 4), nullable=False)
    
    billId = synonym("bill_id")
    itemId = synonym("item_id")
    unitPrice = synonym("unit_price")
    totalPrice = synonym("total_price")

    bill = relationship("VendorBill", back_populates="items")
    item = relationship("Item")

class VendorBillGRNLink(BaseModel):
    __tablename__ = "vendor_bill_grn_links"
    
    bill_id = Column("billId", String(36), ForeignKey("vendor_bills.id", ondelete="CASCADE"), nullable=False, index=True)
    grn_id = Column("grnId", String(36), ForeignKey("goods_receive_notes.id", ondelete="CASCADE"), nullable=False, index=True)
    
    billId = synonym("bill_id")
    grnId = synonym("grn_id")
    
    bill = relationship("VendorBill", back_populates="grn_links")
    grn = relationship("GoodsReceiveNote")

class Payment(BaseModel):
    __tablename__ = "payments"
    
    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_id = Column("supplierId", String(36), ForeignKey("suppliers.id"), nullable=False, index=True)
    amount = Column(Numeric(14, 4), nullable=False)
    payment_date = Column("paymentDate", DateTime, default=datetime.utcnow, nullable=False)
    payment_method = Column("paymentMethod", String(50), nullable=False)
    reference_number = Column("referenceNumber", String(100), nullable=True)
    status = Column(String(50), default="DRAFT", nullable=False)
    notes = Column(Text, nullable=True)
    
    companyId = synonym("company_id")
    supplierId = synonym("supplier_id")
    paymentDate = synonym("payment_date")
    paymentMethod = synonym("payment_method")
    referenceNumber = synonym("reference_number")
