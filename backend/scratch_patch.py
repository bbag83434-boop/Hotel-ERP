import sys

file_path = r"C:\Users\Biswanath Bag\OneDrive\Desktop\Hotel-ERP\backend\app\api\v1\endpoints\recipe.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace execute_production_order Step 1 and 2
old_step_1_2_exec = """    # Step 1: Pre-Production Sufficiency Check (Strict Blocking)
    shortages = []
    consumptions_to_process = []
    for ing in recipe.ingredients:
        std_recipe_req = Decimal(str(ing.quantity)) * multiplier
        raw = db.query(Item).filter(Item.id == ing.raw_item_id).first()
        if not raw:
            raise HTTPException(status_code=400, detail=f"Raw item missing: {ing.raw_item_id}")
        try:
            std_req = convert_quantity(db, current_user.company_id, std_recipe_req, ing.unit_id, raw.unit_id)
            custom_req = custom_map.get(ing.raw_item_id)
            act_req = convert_quantity(db, current_user.company_id, custom_req, ing.unit_id, raw.unit_id) if custom_req is not None else std_req
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        bal = db.query(StockBalance).filter(
            StockBalance.warehouse_id == exec_in.kitchen_warehouse_id,
            StockBalance.item_id == ing.raw_item_id,
        ).first()

        avail = Decimal(str(bal.quantity if bal else 0))
        if avail < act_req:
            shortage_qty = act_req - avail
            shortages.append(
                f"{raw.name if raw else ing.raw_item_id} (Required: {act_req}, Available: {avail}, Shortage: {shortage_qty})"
            )

        unit_cost = Decimal(str(raw.cost_price or 0)) if raw else Decimal("0.0000")
        line_cost = act_req * unit_cost
        consumptions_to_process.append((ing, raw, std_req, act_req, unit_cost, line_cost))

    if shortages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Production blocked: Insufficient stock for {', '.join(shortages)}",
        )

    # Generate unique order number
    today_str = datetime.utcnow().strftime("%Y%m%d")
    count_today = db.query(func.count(ProductionOrder.id)).filter(
        ProductionOrder.company_id == current_user.company_id,
        ProductionOrder.order_number.like(f"PRD-{today_str}-%"),
    ).scalar() or 0
    order_number = f"PRD-{today_str}-{str(count_today + 1).zfill(4)}"

    new_order = ProductionOrder(
        company_id=current_user.company_id,
        branch_id=exec_in.branch_id,
        kitchen_warehouse_id=exec_in.kitchen_warehouse_id,
        recipe_id=exec_in.recipe_id,
        order_number=order_number,
        planned_qty=planned_qty,
        actual_yield_qty=actual_yield,
        wastage_qty=wastage_qty,
        status="COMPLETED",
        planned_date=datetime.utcnow(),
        completed_date=datetime.utcnow(),
        total_raw_cost=Decimal("0.0000"),
        unit_food_cost=Decimal("0.0000"),
        notes=exec_in.notes.strip() if exec_in.notes else None,
        idempotency_key=exec_in.idempotency_key,
        created_by_id=current_user.id,
    )
    db.add(new_order)
    db.flush()

    # Step 2: Atomic Raw Material Deduction & Ledger Writing
    total_consumed_cost = Decimal("0.0000")
    for ing, raw, std_req, act_req, unit_cost, line_cost in consumptions_to_process:
        total_consumed_cost += line_cost

        # Lock StockBalance row
        bal = db.query(StockBalance).filter(
            StockBalance.warehouse_id == exec_in.kitchen_warehouse_id,
            StockBalance.item_id == ing.raw_item_id,
        ).with_for_update().first()

        if not bal:
            bal = StockBalance(
                warehouse_id=exec_in.kitchen_warehouse_id,
                item_id=ing.raw_item_id,
                quantity=-act_req,
            )
            db.add(bal)
            db.flush()
        else:
            bal.quantity = Decimal(str(bal.quantity)) - act_req

        # Record Consumption
        consump = ProductionConsumption(
            production_order_id=new_order.id,
            raw_item_id=ing.raw_item_id,
            standard_qty=std_req,
            actual_consumed_qty=act_req,
            unit_cost=unit_cost,
            total_cost=line_cost,
        )
        db.add(consump)

        # Record StockLedger (PRODUCTION_OUT)
        ledger_out = StockLedger(
            warehouse_id=exec_in.kitchen_warehouse_id,
            item_id=ing.raw_item_id,
            movement_type="PRODUCTION_OUT",
            change_qty=-act_req,
            balance_qty=Decimal(str(bal.quantity)),
            unit_cost=unit_cost,
            total_cost=-line_cost,
            reference_type="PRODUCTION_ORDER",
            reference_id=new_order.id,
            notes=f"Production Order #{order_number} Raw Consumption: {raw.name if raw else ing.raw_item_id}",
            created_by_id=current_user.id,
        )
        db.add(ledger_out)"""

new_step_1_2_exec = """    # Step 1: Pre-Production Sufficiency Check (Strict Blocking with FIFO)
    shortages = []
    consumptions_to_process = []
    for ing in recipe.ingredients:
        std_recipe_req = Decimal(str(ing.quantity)) * multiplier
        raw = db.query(Item).filter(Item.id == ing.raw_item_id).first()
        if not raw:
            raise HTTPException(status_code=400, detail=f"Raw item missing: {ing.raw_item_id}")
        try:
            std_req = convert_quantity(db, current_user.company_id, std_recipe_req, ing.unit_id, raw.unit_id)
            custom_req = custom_map.get(ing.raw_item_id)
            act_req = convert_quantity(db, current_user.company_id, custom_req, ing.unit_id, raw.unit_id) if custom_req is not None else std_req
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        # Lock active batches for this item in FIFO order
        batches = db.query(StockBatch).filter(
            StockBatch.warehouse_id == exec_in.kitchen_warehouse_id,
            StockBatch.item_id == ing.raw_item_id,
            StockBatch.quantity > 0,
            StockBatch.is_active == True,
        ).order_by(StockBatch.created_at.asc()).with_for_update().all()

        total_avail_batch = sum([Decimal(str(b.quantity)) for b in batches])

        if total_avail_batch < act_req:
            shortage_qty = act_req - total_avail_batch
            shortages.append(
                f"{raw.name if raw else ing.raw_item_id} (Required: {act_req}, Available: {total_avail_batch}, Shortage: {shortage_qty})"
            )
        else:
            consumptions_to_process.append((ing, raw, std_req, act_req, batches))

    if shortages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Production blocked: Insufficient FIFO stock for {', '.join(shortages)}",
        )

    # Generate unique order number
    today_str = datetime.utcnow().strftime("%Y%m%d")
    count_today = db.query(func.count(ProductionOrder.id)).filter(
        ProductionOrder.company_id == current_user.company_id,
        ProductionOrder.order_number.like(f"PRD-{today_str}-%"),
    ).scalar() or 0
    order_number = f"PRD-{today_str}-{str(count_today + 1).zfill(4)}"

    new_order = ProductionOrder(
        company_id=current_user.company_id,
        branch_id=exec_in.branch_id,
        kitchen_warehouse_id=exec_in.kitchen_warehouse_id,
        recipe_id=exec_in.recipe_id,
        order_number=order_number,
        planned_qty=planned_qty,
        actual_yield_qty=actual_yield,
        wastage_qty=wastage_qty,
        status="COMPLETED",
        planned_date=datetime.utcnow(),
        completed_date=datetime.utcnow(),
        total_raw_cost=Decimal("0.0000"),
        unit_food_cost=Decimal("0.0000"),
        notes=exec_in.notes.strip() if exec_in.notes else None,
        idempotency_key=exec_in.idempotency_key,
        created_by_id=current_user.id,
    )
    db.add(new_order)
    db.flush()

    # Step 2: Atomic Raw Material Deduction & Ledger Writing (FIFO)
    total_consumed_cost = Decimal("0.0000")
    for ing, raw, std_req, act_req, batches in consumptions_to_process:
        remaining_req = act_req
        
        # Lock StockBalance row
        bal = db.query(StockBalance).filter(
            StockBalance.warehouse_id == exec_in.kitchen_warehouse_id,
            StockBalance.item_id == ing.raw_item_id,
        ).with_for_update().first()
        
        if not bal:
            bal = StockBalance(
                warehouse_id=exec_in.kitchen_warehouse_id,
                item_id=ing.raw_item_id,
                quantity=-act_req,
            )
            db.add(bal)
            db.flush()
        else:
            bal.quantity = Decimal(str(bal.quantity)) - act_req
            db.flush()

        for b in batches:
            if remaining_req <= Decimal("0.0000"):
                break
                
            qty_from_batch = min(remaining_req, Decimal(str(b.quantity)))
            b.quantity = Decimal(str(b.quantity)) - qty_from_batch
            remaining_req -= qty_from_batch
            
            unit_cost = Decimal(str(b.unit_cost))
            line_cost = qty_from_batch * unit_cost
            total_consumed_cost += line_cost
            
            # Record Consumption per batch
            consump = ProductionConsumption(
                production_order_id=new_order.id,
                raw_item_id=ing.raw_item_id,
                stock_batch_id=b.id,
                batch_number=b.batch_number,
                standard_qty=std_req * (qty_from_batch / act_req) if act_req > Decimal("0") else Decimal("0"),
                actual_consumed_qty=qty_from_batch,
                unit_cost=unit_cost,
                total_cost=line_cost,
            )
            db.add(consump)

            # Record StockLedger (PRODUCTION_OUT) per batch
            ledger_out = StockLedger(
                warehouse_id=exec_in.kitchen_warehouse_id,
                item_id=ing.raw_item_id,
                batch_number=b.batch_number,
                movement_type="PRODUCTION_OUT",
                change_qty=-qty_from_batch,
                balance_qty=Decimal(str(bal.quantity)),
                unit_cost=unit_cost,
                total_cost=-line_cost,
                reference_type="PRODUCTION_ORDER",
                reference_id=new_order.id,
                notes=f"Production Order #{order_number} Raw Consumption: {raw.name if raw else ing.raw_item_id} (Batch: {b.batch_number})",
                created_by_id=current_user.id,
            )
            db.add(ledger_out)"""

content = content.replace(old_step_1_2_exec, new_step_1_2_exec)

# Replace update_production_order_status Step
old_update_status = """        # Check stock sufficiency before completing
        shortages = []
        for pc in po.consumptions:
            qty_to_deduct = Decimal(str(pc.actual_consumed_qty if pc.actual_consumed_qty > 0 else pc.standard_qty))
            raw_item = db.query(Item).filter(Item.id == pc.raw_item_id).first()
            bal = db.query(StockBalance).filter(
                StockBalance.warehouse_id == po.kitchen_warehouse_id,
                StockBalance.item_id == pc.raw_item_id,
            ).first()
            avail = Decimal(str(bal.quantity if bal else 0))
            if avail < qty_to_deduct:
                shortages.append(
                    f"{raw_item.name if raw_item else pc.raw_item_id} (Required: {qty_to_deduct}, Available: {avail}, Shortage: {qty_to_deduct - avail})"
                )

        if shortages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Production blocked: Insufficient stock for {', '.join(shortages)}",
            )

        # 1. Deduct raw materials (PRODUCTION_OUT) with row locking
        total_consumed_cost = Decimal("0.0000")
        for pc in po.consumptions:
            qty_to_deduct = Decimal(str(pc.actual_consumed_qty if pc.actual_consumed_qty > 0 else pc.standard_qty))
            raw_item = db.query(Item).filter(Item.id == pc.raw_item_id).first()
            unit_cost = Decimal(str(raw_item.cost_price or 0)) if raw_item else Decimal("0.0000")
            line_cost = qty_to_deduct * unit_cost
            total_consumed_cost += line_cost

            # Lock StockBalance for raw material
            bal = db.query(StockBalance).filter(
                StockBalance.warehouse_id == po.kitchen_warehouse_id,
                StockBalance.item_id == pc.raw_item_id,
            ).with_for_update().first()

            if not bal:
                bal = StockBalance(
                    warehouse_id=po.kitchen_warehouse_id,
                    item_id=pc.raw_item_id,
                    quantity=-qty_to_deduct,
                )
                db.add(bal)
                db.flush()
            else:
                bal.quantity = Decimal(str(bal.quantity)) - qty_to_deduct

            # StockLedger entry for raw consumption
            ledger_out = StockLedger(
                warehouse_id=po.kitchen_warehouse_id,
                item_id=pc.raw_item_id,
                movement_type="PRODUCTION_OUT",
                change_qty=-qty_to_deduct,
                balance_qty=Decimal(str(bal.quantity)),
                unit_cost=unit_cost,
                total_cost=-line_cost,
                reference_type="PRODUCTION_ORDER",
                reference_id=po.id,
                notes=f"Production Order #{po.order_number} Raw Consumption: {raw_item.name if raw_item else pc.raw_item_id}",
                created_by_id=current_user.id,
            )
            db.add(ledger_out)"""

new_update_status = """        # Check stock sufficiency before completing (FIFO batches)
        shortages = []
        consumptions_to_process = []
        for pc in po.consumptions:
            qty_to_deduct = Decimal(str(pc.actual_consumed_qty if pc.actual_consumed_qty > 0 else pc.standard_qty))
            raw_item = db.query(Item).filter(Item.id == pc.raw_item_id).first()
            
            batches = db.query(StockBatch).filter(
                StockBatch.warehouse_id == po.kitchen_warehouse_id,
                StockBatch.item_id == pc.raw_item_id,
                StockBatch.quantity > 0,
                StockBatch.is_active == True,
            ).order_by(StockBatch.created_at.asc()).with_for_update().all()
            
            total_avail_batch = sum([Decimal(str(b.quantity)) for b in batches])
            
            if total_avail_batch < qty_to_deduct:
                shortages.append(
                    f"{raw_item.name if raw_item else pc.raw_item_id} (Required: {qty_to_deduct}, Available: {total_avail_batch}, Shortage: {qty_to_deduct - total_avail_batch})"
                )
            else:
                consumptions_to_process.append((pc, raw_item, qty_to_deduct, batches))

        if shortages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Production blocked: Insufficient FIFO stock for {', '.join(shortages)}",
            )

        # 1. Deduct raw materials (PRODUCTION_OUT) with row locking and FIFO batches
        total_consumed_cost = Decimal("0.0000")
        
        # Clear existing consumptions as we are replacing them with exact batch consumptions
        db.query(ProductionConsumption).filter(ProductionConsumption.production_order_id == po.id).delete()
        db.flush()
        
        for pc, raw_item, qty_to_deduct, batches in consumptions_to_process:
            remaining_req = qty_to_deduct
            
            # Lock StockBalance for raw material
            bal = db.query(StockBalance).filter(
                StockBalance.warehouse_id == po.kitchen_warehouse_id,
                StockBalance.item_id == pc.raw_item_id,
            ).with_for_update().first()

            if not bal:
                bal = StockBalance(
                    warehouse_id=po.kitchen_warehouse_id,
                    item_id=pc.raw_item_id,
                    quantity=-qty_to_deduct,
                )
                db.add(bal)
                db.flush()
            else:
                bal.quantity = Decimal(str(bal.quantity)) - qty_to_deduct
                db.flush()
            
            for b in batches:
                if remaining_req <= Decimal("0.0000"):
                    break
                
                qty_from_batch = min(remaining_req, Decimal(str(b.quantity)))
                b.quantity = Decimal(str(b.quantity)) - qty_from_batch
                remaining_req -= qty_from_batch
                
                unit_cost = Decimal(str(b.unit_cost))
                line_cost = qty_from_batch * unit_cost
                total_consumed_cost += line_cost
                
                # Create exact batch consumption
                consump = ProductionConsumption(
                    production_order_id=po.id,
                    raw_item_id=pc.raw_item_id,
                    stock_batch_id=b.id,
                    batch_number=b.batch_number,
                    standard_qty=Decimal(str(pc.standard_qty)) * (qty_from_batch / qty_to_deduct) if qty_to_deduct > Decimal("0") else Decimal("0"),
                    actual_consumed_qty=qty_from_batch,
                    unit_cost=unit_cost,
                    total_cost=line_cost,
                )
                db.add(consump)

                # StockLedger entry for raw consumption
                ledger_out = StockLedger(
                    warehouse_id=po.kitchen_warehouse_id,
                    item_id=pc.raw_item_id,
                    batch_number=b.batch_number,
                    movement_type="PRODUCTION_OUT",
                    change_qty=-qty_from_batch,
                    balance_qty=Decimal(str(bal.quantity)),
                    unit_cost=unit_cost,
                    total_cost=-line_cost,
                    reference_type="PRODUCTION_ORDER",
                    reference_id=po.id,
                    notes=f"Production Order #{po.order_number} Raw Consumption: {raw_item.name if raw_item else pc.raw_item_id} (Batch: {b.batch_number})",
                    created_by_id=current_user.id,
                )
                db.add(ledger_out)"""

content = content.replace(old_update_status, new_update_status)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied to recipe.py successfully!")
