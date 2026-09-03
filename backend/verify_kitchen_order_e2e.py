import sys
import uuid
from decimal import Decimal
from datetime import datetime, timedelta

import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.organization import Company, Branch, Warehouse
from app.models.inventory import Item, StockBalance, StockLedger
from app.schemas.kitchen_order import (
    KitchenOrderCreate,
    KitchenOrderApproveRequest,
    KitchenOrderIssueRequest,
    KitchenOrderDispatchRequest,
    KitchenOrderReceiveRequest
)
from app.api.v1.endpoints.kitchen_orders import (
    create_kitchen_order,
    approve_kitchen_order,
    issue_kitchen_order,
    dispatch_kitchen_order,
    receive_kitchen_order
)

def run():
    db = SessionLocal()
    try:
        # Get admin user
        admin = db.query(User).filter(User.email.like('%admin%')).first()
        if not admin:
            admin = db.query(User).first()
            
        print(f"Using user: {admin.email} (Company: {admin.company_id})")
        
        # Get item Gulab Jamun
        item = db.query(Item).filter(Item.name == 'Gulab Jamun', Item.company_id == admin.company_id).first()
        if not item:
            print("Item 'Gulab Jamun' not found!")
            return
            
        # Get Central Kitchen warehouse
        central_wh = db.query(Warehouse).filter(
            Warehouse.company_id == admin.company_id,
            Warehouse.is_central == True
        ).first()
        
        # Get an Outlet branch
        outlet = db.query(Branch).filter(
            Branch.company_id == admin.company_id,
            Branch.type == 'RESTAURANT',
            Branch.id != central_wh.branch_id
        ).first()
        
        # Get Outlet warehouse
        outlet_wh = db.query(Warehouse).filter(
            Warehouse.branch_id == outlet.id
        ).first()
        
        print(f"Item: {item.name}")
        print(f"Central Warehouse: {central_wh.name}")
        print(f"Outlet: {outlet.name} (Warehouse: {outlet_wh.name})")
        
        # Helper to get stock
        def get_stock(wh_id, i_id):
            b = db.query(StockBalance).filter(
                StockBalance.warehouse_id == wh_id,
                StockBalance.item_id == i_id
            ).first()
            return b.quantity if b else Decimal("0.0000")
            
        # Ensure central kitchen has enough stock for testing
        central_stock = get_stock(central_wh.id, item.id)
        if central_stock < 40:
            print("Adding dummy stock to Central Kitchen to allow dispatch...")
            from app.services.stock import StockService
            StockService(db).post_stock_movement(
                warehouse_id=central_wh.id,
                item_id=item.id,
                change_qty=Decimal("100"),
                movement_type="MANUAL_ADJUSTMENT",
                reference_type="TEST",
                reference_id=str(uuid.uuid4()),
                user_id=admin.id
            )
            db.commit()
            
        stock_before_central = get_stock(central_wh.id, item.id)
        stock_before_outlet = get_stock(outlet_wh.id, item.id)
        
        print("\n--- BEFORE STOCK ---")
        print(f"Central Stock: {stock_before_central}")
        print(f"Outlet Stock : {stock_before_outlet}")
        
        print("\n--- RUNNING FLOW ---")
        
        print("1. Outlet Requesting 40 Qty...")
        order_res = create_kitchen_order(
            payload=KitchenOrderCreate(
                branch_id=outlet.id,
                item_id=item.id,
                requested_qty=Decimal("40.0000"),
                notes="E2E Test Order"
            ),
            db=db,
            current_user=admin
        )
        order_id = order_res.id
        print(f"   Order Created: {order_res.order_number} | Status: {order_res.status}")
        
        print("2. Admin Approving...")
        order_res = approve_kitchen_order(
            order_id=order_id,
            payload=KitchenOrderApproveRequest(),
            db=db,
            current_user=admin
        )
        print(f"   Status: {order_res.status}")
        
        print("3. Central Kitchen Issuing 40 Qty...")
        order_res = issue_kitchen_order(
            order_id=order_id,
            payload=KitchenOrderIssueRequest(issue_qty=Decimal("40.0000")),
            db=db,
            current_user=admin
        )
        print(f"   Issued Qty: {order_res.issued_qty}")
        
        print("4. Central Kitchen Dispatching 40 Qty...")
        order_res = dispatch_kitchen_order(
            order_id=order_id,
            payload=KitchenOrderDispatchRequest(dispatched_qty=Decimal("40.0000")),
            db=db,
            current_user=admin
        )
        print(f"   Dispatched Qty: {order_res.dispatched_qty} | Status: {order_res.status}")
        
        print("5. Outlet Receiving 38 Qty (2 Shortage/Variance)...")
        order_res = receive_kitchen_order(
            order_id=order_id,
            payload=KitchenOrderReceiveRequest(accepted_qty=Decimal("38.0000"), notes="2 units missing/damaged"),
            db=db,
            current_user=admin
        )
        print(f"   Received Qty: {order_res.received_qty} | Status: {order_res.status}")
        
        print("\n--- AFTER STOCK ---")
        stock_after_central = get_stock(central_wh.id, item.id)
        stock_after_outlet = get_stock(outlet_wh.id, item.id)
        print(f"Central Stock: {stock_after_central} (Change: {stock_after_central - stock_before_central})")
        print(f"Outlet Stock : {stock_after_outlet} (Change: {stock_after_outlet - stock_before_outlet})")
        
        print("\n--- LEDGER ENTRIES FOR THIS ORDER ---")
        ledgers = db.query(StockLedger).filter(StockLedger.reference_id == order_id).order_by(StockLedger.created_at.asc()).all()
        for l in ledgers:
            wh_name = central_wh.name if l.warehouse_id == central_wh.id else outlet_wh.name
            print(f" - {l.movement_type} | Qty: {l.change_qty} | Warehouse: {wh_name}")

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    run()
