const fs = require('fs');
let content = fs.readFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/backend/app/api/v1/endpoints/recipe.py', 'utf8');

const markerStart3 = "    for ing in recipe.ingredients:";
const markerEnd3 = "    est_unit_food_cost = total_est_cost / planned_qty if planned_qty > 0 else total_est_cost";

let idxStart3 = content.indexOf(markerStart3, content.indexOf('def preview_production'));
let idxEnd3 = content.indexOf(markerEnd3, idxStart3);

if (idxStart3 !== -1 && idxEnd3 !== -1) {
    const oldBlock = content.substring(idxStart3, idxEnd3);
    const newBlock = `    for ing in recipe.ingredients:
        raw = db.query(Item).filter(Item.id == ing.raw_item_id).first()
        raw_u = db.query(Unit).filter(Unit.id == ing.unit_id).first() if ing.unit_id else (
            db.query(Unit).filter(Unit.id == raw.unit_id).first() if raw and raw.unit_id else None
        )

        std_q = Decimal(str(ing.quantity))
        req_q = std_q * multiplier
        
        batches = db.query(StockBatch).filter(
            StockBatch.warehouse_id == preview_in.kitchen_warehouse_id,
            StockBatch.item_id == ing.raw_item_id,
            StockBatch.quantity > 0,
            StockBatch.is_active == True,
        ).order_by(StockBatch.created_at.asc()).all()

        total_avail_batch = sum([Decimal(str(b.quantity)) for b in batches])
        is_suff = total_avail_batch >= req_q
        shortage = max(Decimal("0.0000"), req_q - total_avail_batch)
        if not is_suff:
            all_avail = False
            
        line_cost = Decimal("0.0000")
        fifo_batches_used = []
        remaining_req = req_q
        
        for b in batches:
            if remaining_req <= Decimal("0.0000"):
                break
            qty_from_batch = min(remaining_req, Decimal(str(b.quantity)))
            remaining_req -= qty_from_batch
            line_cost += qty_from_batch * Decimal(str(b.unit_cost))
            fifo_batches_used.append(f"{b.batch_number}: {qty_from_batch} x {b.unit_cost}")
            
        # If there's shortage, estimate remaining at item's cost price
        if remaining_req > Decimal("0.0000"):
            line_cost += remaining_req * Decimal(str(raw.cost_price or 0))

        total_est_cost += line_cost
        avg_unit_cost = line_cost / req_q if req_q > 0 else Decimal("0.0000")

        items_breakdown.append(
            ProductionPreviewItem(
                raw_item_id=ing.raw_item_id,
                item_name=raw.name if raw else "",
                item_code=raw.code if raw else "",
                unit_symbol=raw_u.symbol if raw_u else None,
                standard_qty_per_unit_yield=std_q,
                required_qty=req_q,
                available_qty=total_avail_batch,
                is_sufficient=is_suff,
                shortage_qty=shortage,
                unit_cost=avg_unit_cost,
                total_cost=line_cost,
                fifo_batches=fifo_batches_used,
            )
        )

`;
    content = content.replace(oldBlock, newBlock);
    fs.writeFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/backend/app/api/v1/endpoints/recipe.py', content);
    console.log('Patched preview_production');
} else {
    console.log('Could not find markers for preview_production');
}
