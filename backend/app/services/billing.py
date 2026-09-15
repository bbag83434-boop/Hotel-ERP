from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from app.models.billing import VendorBill, VendorBillItem, VendorBillGRNLink, BillStatus
from app.models.procurement import GoodsReceiveNote, GoodsReceiveItem, PurchaseOrderItem
from app.core.exceptions import AppException

MONEY_TOLERANCE = Decimal("0.01")


@dataclass
class ThreeWayMatchResult:
    matched: bool
    po_id: str | None = None
    variances: List[Dict[str, Any]] = field(default_factory=list)
    lines: List[Dict[str, Any]] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {"matched": self.matched, "po_id": self.po_id, "variances": self.variances, "lines": self.lines}


class BillingService:
    def __init__(self, db: Session):
        self.db = db
        self.tolerance = MONEY_TOLERANCE

    def perform_three_way_match(self, bill_id: str):
        bill = self.db.query(VendorBill).filter(VendorBill.id == bill_id).first()
        if not bill:
            raise AppException(status_code=404, message="Bill not found")

        # A bill is a document to verify, never a source of PO or GRN values.
        # Only its explicitly linked, posted GRNs participate in this match.
        linked_grn_ids = list(dict.fromkeys(link.grn_id for link in (bill.grn_links or [])))
        result = ThreeWayMatchResult(matched=False)
        if not linked_grn_ids:
            result.variances.append({"code": "NO_GRN_LINK", "message": "A bill must link at least one approved GRN."})
            return result

        all_linked_grns = self.db.query(GoodsReceiveNote).filter(GoodsReceiveNote.id.in_(linked_grn_ids)).all()
        found_ids = {g.id for g in all_linked_grns}
        for grn_id in linked_grn_ids:
            if grn_id not in found_ids:
                result.variances.append({"code": "GRN_NOT_FOUND", "grn_id": grn_id})
        for grn in all_linked_grns:
            if grn.status != "APPROVED":
                result.variances.append({"code": "GRN_NOT_APPROVED", "grn_id": grn.id, "status": grn.status})
            if grn.supplier_id != bill.supplier_id:
                result.variances.append({"code": "GRN_SUPPLIER_MISMATCH", "grn_id": grn.id})
            if grn.company_id != bill.company_id:
                result.variances.append({"code": "GRN_COMPANY_MISMATCH", "grn_id": grn.id})
            if not grn.po_id:
                result.variances.append({"code": "GRN_WITHOUT_PO", "grn_id": grn.id})

        po_ids = {g.po_id for g in all_linked_grns if g.po_id}
        if len(po_ids) != 1:
            result.variances.append({"code": "MULTIPLE_POS", "message": "All GRNs on a bill must belong to one purchase order."})
            return result
        result.po_id = next(iter(po_ids))
        if result.variances:
            return result

        grns = self.db.query(GoodsReceiveNote).filter(
            GoodsReceiveNote.id.in_(linked_grn_ids),
            GoodsReceiveNote.status == "APPROVED"
        ).all()
        approved_grn_ids = [g.id for g in grns]
        bill_items = bill.items if getattr(bill, 'items', None) else self.db.query(VendorBillItem).filter(VendorBillItem.bill_id == bill.id).all()
        if not bill_items:
            result.variances.append({"code": "NO_BILL_LINES", "message": "A bill must contain invoice lines."})
            return result

        # Sum invoice lines by item. This avoids allowing duplicate invoice lines to
        # bypass the received-quantity check.
        invoice_by_item = {}
        for bill_item in bill_items:
            entry = invoice_by_item.setdefault(bill_item.item_id, {"quantity": Decimal("0"), "prices": [], "line_total": Decimal("0")})
            entry["quantity"] += Decimal(str(bill_item.quantity))
            entry["prices"].append(Decimal(str(bill_item.unit_price)))
            entry["line_total"] += Decimal(str(bill_item.total_price))

        for item_id, invoice in invoice_by_item.items():
            # Aggregate accepted qty from linked APPROVED GRNs
            grn_items = self.db.query(GoodsReceiveItem).filter(
                GoodsReceiveItem.item_id == item_id,
                GoodsReceiveItem.grn_id.in_(approved_grn_ids)
            ).all()
            total_received = sum((Decimal(str(gi.accepted_qty)) for gi in grn_items), Decimal("0"))
            po_item_ids = [gi.po_item_id for gi in grn_items if gi.po_item_id]
            po_items = self.db.query(PurchaseOrderItem).filter(PurchaseOrderItem.id.in_(po_item_ids)).all()
            line = {"item_id": item_id, "invoice_qty": invoice["quantity"], "approved_grn_qty": total_received}
            if not po_items:
                result.variances.append({"code": "ITEM_NOT_ON_LINKED_PO", "item_id": item_id})
                result.lines.append(line)
                continue

            po_qty = sum((Decimal(str(p.ordered_qty)) for p in po_items), Decimal("0"))
            po_prices = {Decimal(str(p.unit_price)) for p in po_items}
            line["po_qty"] = po_qty
            line["po_unit_prices"] = sorted(str(price) for price in po_prices)
            if invoice["quantity"] != total_received:
                result.variances.append({"code": "QUANTITY_VARIANCE", "item_id": item_id, "invoice_qty": str(invoice["quantity"]), "approved_grn_qty": str(total_received)})
            if total_received > po_qty:
                result.variances.append({"code": "GRN_EXCEEDS_PO", "item_id": item_id, "approved_grn_qty": str(total_received), "po_qty": str(po_qty)})
            if len(po_prices) != 1:
                result.variances.append({"code": "AMBIGUOUS_PO_PRICE", "item_id": item_id})
            else:
                po_price = next(iter(po_prices))
                line["po_unit_price"] = po_price
                for invoice_price in set(invoice["prices"]):
                    if abs(invoice_price - po_price) > self.tolerance:
                        result.variances.append({"code": "PRICE_VARIANCE", "item_id": item_id, "po_unit_price": str(po_price), "invoice_unit_price": str(invoice_price)})
            for bill_item in (bi for bi in bill_items if bi.item_id == item_id):
                expected_total = Decimal(str(bill_item.quantity)) * Decimal(str(bill_item.unit_price))
                if abs(Decimal(str(bill_item.total_price)) - expected_total) > self.tolerance:
                    result.variances.append({"code": "LINE_AMOUNT_VARIANCE", "item_id": item_id})
            result.lines.append(line)

        computed_subtotal = sum((Decimal(str(item.total_price)) for item in bill_items), Decimal("0"))
        if abs(Decimal(str(bill.total_amount)) - computed_subtotal) > self.tolerance:
            result.variances.append({"code": "BILL_TOTAL_VARIANCE", "stored_total": str(bill.total_amount), "computed_total": str(computed_subtotal)})
        computed_net = computed_subtotal + Decimal(str(bill.tax_amount))
        if abs(Decimal(str(bill.net_amount)) - computed_net) > self.tolerance:
            result.variances.append({"code": "BILL_NET_AMOUNT_VARIANCE", "stored_net": str(bill.net_amount), "computed_net": str(computed_net)})

        result.matched = not result.variances
        if result.matched:
            bill.status = BillStatus.VERIFIED
            self.db.commit()
        return result

    def approve_bill(self, bill_id: str, user_id: str):
        bill = self.db.query(VendorBill).filter(VendorBill.id == bill_id).first()
        if bill.status != BillStatus.VERIFIED:
            raise AppException(status_code=400, message="Bill must be verified before approval")
            
        bill.status = BillStatus.APPROVED
        bill.approved_by_id = user_id
        self.db.commit()


