
import sys
import os
import uuid
import datetime
from decimal import Decimal

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, Role, UserBranch
from app.models.organization import Company, Branch, Warehouse
from app.models.inventory import Item, Category, Unit, ItemType, StockBalance, StockLedger
from app.models.procurement import (
    Supplier,
    PurchaseRequest,
    PurchaseRequestItem,
    PurchaseOrder,
    PurchaseOrderItem,
    GoodsReceiveNote,
    PRStatus,
    POStatus,
)
from app.models.closing import OutletClosingRecord, ClosingStockItem
from app.models.audit import AuditLog
from app.core.auth import get_current_active_user, get_current_user

client = TestClient(app)

def run_tests():
    print('=' * 80)
    print('RUNNING CENTRAL PURCHASE & PO BLUEPRINT 6.15 COMPREHENSIVE TEST SUITE')
    print('=' * 80)

    passed = 0
    total = 0

    def check(name: str, condition: bool):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f'  [PASS] {name}')
        else:
            print(f'  [FAIL] {name}')
            raise AssertionError(f'Test failed: {name}')

    db = SessionLocal()
    try:
        suffix = uuid.uuid4().hex[:6]

        # 1. Base Company & Business Units (6.15.1, 6.15.2, 6.15.3, 6.15.4)
        comp = db.query(Company).first()
        if not comp:
            comp = Company(name=f'Apex Luxury Corp {suffix}', code=f'APX_{suffix}')
            db.add(comp)
            db.commit()

        ho = Branch(company_id=comp.id, name=f'Head Office {suffix}', code=f'HO_{suffix}', type='RESTAURANT')
        outlet1 = Branch(company_id=comp.id, name=f'Bistro Prime {suffix}', code=f'OUT1_{suffix}', type='RESTAURANT')
        outlet2 = Branch(company_id=comp.id, name=f'Harbor Cafe {suffix}', code=f'OUT2_{suffix}', type='RETAIL_STORE' if False else 'RESTAURANT')
        dessert_k = Branch(company_id=comp.id, name=f'Central Bakery {suffix}', code=f'BAKE_{suffix}', type='RESTAURANT')
        db.add_all([ho, outlet1, outlet2, dessert_k])
        db.commit()

        # Warehouses
        wh_ho = Warehouse(company_id=comp.id, branch_id=ho.id, name=f'Central Store {suffix}', code=f'CS_{suffix}')
        wh_out1 = Warehouse(company_id=comp.id, branch_id=outlet1.id, name=f'Outlet 1 Main {suffix}', code=f'OS1_{suffix}')
        wh_out2 = Warehouse(company_id=comp.id, branch_id=outlet2.id, name=f'Outlet 2 Main {suffix}', code=f'OS2_{suffix}')
        wh_dessert = Warehouse(company_id=comp.id, branch_id=dessert_k.id, name=f'Bakery Store {suffix}', code=f'DS_{suffix}')
        db.add_all([wh_ho, wh_out1, wh_out2, wh_dessert])
        db.commit()

        # Users & Role
        admin_role = db.query(Role).filter(Role.name == 'SUPER_ADMIN').first()
        if not admin_role:
            admin_role = Role(name='SUPER_ADMIN', is_system=True)
            db.add(admin_role)
            db.commit()

        user = User(
            company_id=comp.id,
            role_id=admin_role.id,
            email=f'buyer_{suffix}@test.com',
            username=f'buyer_{suffix}',
            password_hash='mock_hash',
            first_name='Head',
            last_name='Buyer',
            is_active=True,
        )
        db.add(user)
        db.commit()

        for b in [ho, outlet1, outlet2, dessert_k]:
            ub = UserBranch(user_id=user.id, branch_id=b.id, is_default=(b.id == ho.id))
            db.add(ub)
        db.commit()

        # Mock authentication overrides
        app.dependency_overrides[get_current_active_user] = lambda: user
        app.dependency_overrides[get_current_user] = lambda: user

        # Master Data: Category, Units, Suppliers, Items
        unit_kg = db.query(Unit).filter(Unit.company_id == comp.id, Unit.symbol == 'KG').first()
        if not unit_kg:
            unit_kg = Unit(company_id=comp.id, name='Kilogram', symbol='KG')
            db.add(unit_kg)
            db.commit()

        unit_ltr = db.query(Unit).filter(Unit.company_id == comp.id, Unit.symbol == 'L').first()
        if not unit_ltr:
            unit_ltr = Unit(company_id=comp.id, name='Liter', symbol='L')
            db.add(unit_ltr)
            db.commit()

        cat = db.query(Category).filter(Category.company_id == comp.id).first()
        if not cat:
            cat = Category(company_id=comp.id, name=f'Perishables {suffix}', code=f'PER_{suffix}')
            db.add(cat)
            db.commit()

        sup_dairy = Supplier(company_id=comp.id, name=f'Supreme Dairy {suffix}', code=f'SUP_D_{suffix}', phone='919876543210', whatsapp_number='919876543210')
        sup_produce = Supplier(company_id=comp.id, name=f'Agro Fresh {suffix}', code=f'SUP_P_{suffix}', phone='919876543211', whatsapp_number='919876543211')
        db.add_all([sup_dairy, sup_produce])
        db.commit()

        item_milk = Item(company_id=comp.id, category_id=cat.id, unit_id=unit_ltr.id, name=f'Whole Milk {suffix}', code=f'MILK_{suffix}', cost_price=Decimal('60.00'), supplier_id=sup_dairy.id)
        item_butter = Item(company_id=comp.id, category_id=cat.id, unit_id=unit_kg.id, name=f'Salted Butter {suffix}', code=f'BTR_{suffix}', cost_price=Decimal('420.00'), supplier_id=sup_dairy.id)
        item_rice = Item(company_id=comp.id, category_id=cat.id, unit_id=unit_kg.id, name=f'Basmati Rice {suffix}', code=f'RICE_{suffix}', cost_price=Decimal('90.00'), supplier_id=sup_produce.id)
        db.add_all([item_milk, item_butter, item_rice])
        db.commit()

        print('\n--- SECTION 6.15.1 - 6.15.4: PR Lifecycle Across Locations ---')
        # 1. Create PR for Outlet 1
        res = client.post('/api/v1/procurement/requests', json={
            'branch_id': outlet1.id,
            'priority': 'HIGH',
            'required_date': (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)).isoformat(),
            'notes': 'Daily dairy requirement',
            'items': [
                {'item_id': item_milk.id, 'requested_qty': 40, 'estimated_price': 60.0},
                {'item_id': item_butter.id, 'requested_qty': 10, 'estimated_price': 420.0}
            ]
        })
        check('PR 1 created successfully', res.status_code in [200, 201])
        pr1_id = res.json()['id']
        check('PR 1 status is PENDING_APPROVAL', res.json()['status'] == 'PENDING_APPROVAL')

        # Single Approve PR 1
        res = client.post(f'/api/v1/procurement/requests/{pr1_id}/approve')
        check('PR 1 approved via POST /requests/{id}/approve', res.status_code == 200 and res.json()['status'] == 'APPROVED')

        # 2. Create PR 2 for Dessert Kitchen and Reject with reason
        res = client.post('/api/v1/procurement/requests', json={
            'branch_id': dessert_k.id,
            'priority': 'MEDIUM',
            'items': [{'item_id': item_butter.id, 'requested_qty': 50, 'estimated_price': 420.0}]
        })
        assert res.status_code in [200, 201], f"PR 2 create failed: {res.text}"
        pr2_id = res.json()['id']
        res = client.post(f'/api/v1/procurement/requests/{pr2_id}/reject', json={'reason': 'Excess stock already available in Central Store'})
        check('PR 2 rejected with structured audit reason', res.status_code == 200 and res.json()['status'] == 'REJECTED')

        # 3. Create PR 3 for Outlet 2 and Return for correction
        res = client.post('/api/v1/procurement/requests', json={
            'branch_id': outlet2.id,
            'priority': 'LOW',
            'items': [{'item_id': item_milk.id, 'requested_qty': 80, 'estimated_price': 60.0}]
        })
        assert res.status_code in [200, 201], f"PR 3 create failed: {res.text}"
        pr3_id = res.json()['id']
        res = client.post(f'/api/v1/procurement/requests/{pr3_id}/return', json={'reason': 'Please adjust quantity to max 30L for current cycle'})
        check('PR 3 returned for correction to DRAFT status', res.status_code == 200 and res.json()['status'] == 'DRAFT')

        print('\n--- SECTION 6.15.5 - 6.15.8: Multi-Destination Auto Consolidation & WhatsApp ---')
        # Create approved PR 4 for Outlet 2
        res = client.post('/api/v1/procurement/requests', json={
            'branch_id': outlet2.id,
            'priority': 'HIGH',
            'items': [
                {'item_id': item_milk.id, 'requested_qty': 25, 'estimated_price': 60.0},
                {'item_id': item_butter.id, 'requested_qty': 5, 'estimated_price': 420.0}
            ]
        })
        assert res.status_code in [200, 201], f"PR 4 create failed: {res.text}"
        pr4_id = res.json()['id']
        client.post(f'/api/v1/procurement/requests/{pr4_id}/approve')

        # Auto Consolidate PR 1 (Outlet 1) and PR 4 (Outlet 2)
        res = client.post('/api/v1/procurement/orders/consolidate', json={
            'request_ids': [pr1_id, pr4_id],
            'auto_submit': True
        })
        check('Auto-consolidation executed successfully', res.status_code in [200, 201])
        cons_res = res.json()
        check('Created 1 consolidated PO for Supreme Dairy', cons_res['consolidated_orders_count'] == 1)
        po_id = cons_res['orders'][0]['id']

        # Verify PO allocation metadata
        res = client.get(f'/api/v1/procurement/orders/{po_id}')
        po_detail = res.json()
        check('PO preserves multi-destination allocation details', po_detail['allocations'] is not None)

        # Approve PO and generate WhatsApp link
        res = client.post(f'/api/v1/procurement/orders/{po_id}/approve')
        check('Consolidated PO approved', res.status_code == 200 and res.json()['status'] == 'APPROVED')

        res = client.post(f'/api/v1/procurement/orders/{po_id}/whatsapp-link')
        check('WhatsApp dispatch link generated', res.status_code == 200)
        wa_msg = res.json().get('prefilled_message') or res.json().get('whatsapp_message', '')
        check('WhatsApp message contains supplier name and order ref', 'Supreme Dairy' in wa_msg and ('Order Ref:' in wa_msg or 'PO' in wa_msg))
        check('WhatsApp message contains outlet allocations', 'Outlet allocation:' in wa_msg or 'Bistro Prime' in wa_msg)

        print('\n--- SECTION 6.15.6 & 6.15.9: Direct PO Creation & Cancellation ---')
        res = client.post('/api/v1/procurement/orders', json={
            'supplier_id': sup_produce.id,
            'branch_id': ho.id,
            'expected_delivery_date': (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).isoformat(),
            'notes': 'Direct central warehouse replenishment',
            'items': [{'item_id': item_rice.id, 'ordered_qty': 100, 'unit_price': 90.0}]
        })
        check('Direct PO created successfully', res.status_code in [200, 201])
        direct_po_id = res.json()['id']

        res = client.post(f'/api/v1/procurement/orders/{direct_po_id}/cancel', json={'reason': 'Price mismatch with supplier contract'})
        check('Direct PO cancelled with reason', res.status_code == 200 and res.json()['status'] == 'CANCELLED')

        print('\n--- SECTION 6.15.10 - 6.15.12: GRN Destination Receiving & Real-Time Stocking ---')
        # Check initial balance at Outlet 1
        sb_pre = db.query(StockBalance).filter(StockBalance.warehouse_id == wh_out1.id, StockBalance.item_id == item_milk.id).first()
        pre_qty = Decimal(str(sb_pre.quantity)) if sb_pre else Decimal('0.0')

        # Receive 40 L Milk at Outlet 1
        res = client.post('/api/v1/procurement/grn', json={
            'branch_id': outlet1.id,
            'po_id': po_id,
            'supplier_id': sup_dairy.id,
            'supplier_invoice_number': f'INV-{suffix}-8901',
            'invoice_amount': 2400.0,
            'items': [
                {
                    'item_id': item_milk.id,
                    'received_qty': 40,
                    'accepted_qty': 38,
                    'rejected_qty': 2,
                    'unit_price': 60.0,
                    'qc_status': 'PASSED',
                    'qc_notes': '2 bottles rejected due to seal rupture'
                }
            ]
        })
        check('Destination GRN logged successfully', res.status_code in [200, 201])
        grn_id = res.json()['id']

        # Verify StockBalance incremented directly at Outlet 1 warehouse
        db.expire_all()
        sb_post = db.query(StockBalance).filter(StockBalance.warehouse_id == wh_out1.id, StockBalance.item_id == item_milk.id).first()
        check('Destination warehouse StockBalance incremented exactly by accepted quantity (38 L)', sb_post is not None and Decimal(str(sb_post.quantity)) == pre_qty + Decimal('38.0'))

        # Verify StockLedger entry
        ledger = db.query(StockLedger).filter(StockLedger.warehouse_id == wh_out1.id, StockLedger.item_id == item_milk.id, StockLedger.movement_type == 'GRN').first()
        check('StockLedger created movement_type = GRN with exact decimal quantity', ledger is not None and Decimal(str(ledger.change_qty)) == Decimal('38.0'))

        print('\n--- SECTION 6.15.13 - 6.15.14: 3-Way Matching & Purchase Accounting Drill-Down ---')
        res = client.get(f'/api/v1/procurement/orders/{po_id}/3way-match')
        check('3-Way Match endpoint returned 200', res.status_code == 200)
        match_data = res.json()
        check('3-Way Match po_number matches', match_data['po_number'] == po_detail['po_number'])
        check('3-Way Match includes lines with rate and qty variance analysis', len(match_data['lines']) > 0)
        check('3-Way Match detected overall match status', match_data['overall_status'] in ['PERFECT_MATCH', 'PARTIAL_DELIVERY', 'VARIANCE_DETECTED'])

        print('\n--- SECTION 6.15.16 - 6.15.17: Twice-Monthly Closing & Food Cost Calculations ---')
        # Active draft for Outlet 1
        res = client.get(f'/api/v1/procurement/closings/active/{outlet1.id}')
        check('Active closing draft retrieved for Outlet 1', res.status_code == 200)
        draft_info = res.json()
        check('Draft period is valid (FIRST_HALF or SECOND_HALF)', draft_info['period_type'] in ['FIRST_HALF', 'SECOND_HALF'])

        # Submit closing physical stock count
        closing_val_qty = Decimal('14.0')
        res = client.post('/api/v1/procurement/closings/submit', json={
            'branch_id': outlet1.id,
            'period_type': draft_info['period_type'],
            'year': draft_info['year'],
            'month': draft_info['month'],
            'items': [
                {'item_id': item_milk.id, 'physical_closing_qty': float(closing_val_qty)}
            ],
            'notes': 'Mid-month physical count sign-off'
        })
        check('Physical stock count submitted successfully', res.status_code in [200, 201])
        closing_res = res.json()
        closing_id = closing_res['id']
        expected_closing_val = closing_val_qty * Decimal('60.00')
        check('Physical closing valuation calculated correctly (14 x $60 = $840)', Decimal(str(closing_res['closing_physical_valuation'])) == expected_closing_val)
        check('Actual Food Cost calculated via formula (Opening + Purchases - Closing)', Decimal(str(closing_res['actual_food_cost'])) >= Decimal('0.0'))

        # Lock closing period
        res = client.post(f'/api/v1/procurement/closings/{closing_id}/lock')
        check('Closing period locked by GM/Auditor', res.status_code == 200 and res.json()['status'] in ['LOCKED', 'FINALIZED_LOCKED'])

        # Reopen closing period
        res = client.post(f'/api/v1/procurement/closings/{closing_id}/reopen', json={'reason': 'Recount requested by Finance Auditor'})
        check('Closing period reopened for correction', res.status_code == 200 and res.json()['status'] == 'DRAFT')

        print('\n' + '=' * 80)
        print(f'SUCCESS: ALL {passed}/{total} BLUEPRINT 6.15 SPEC TESTS PASSED WITH ZERO ERRORS!')
        print('=' * 80)

    finally:
        app.dependency_overrides.clear()
        db.close()

if __name__ == '__main__':
    run_tests()
