const fs = require('fs');
let content = fs.readFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/backend/app/api/v1/endpoints/inventory.py', 'utf8');

// 4. get_low_stock_alerts
let matchLowStock = content.match(/def get_low_stock_alerts\([\s\S]*?\):\s*query = db\.query\(StockBalance\)\.join\([\s\S]*?\)\.filter\(Item\.company_id == current_user\.company_id\)/);
if (matchLowStock) {
    let replacement = matchLowStock[0] + `
    if not _is_inventory_manager(current_user):
        user_bids = list(_user_branch_ids(current_user))
        if not user_bids:
            return []
        query = query.join(Warehouse, Warehouse.id == StockBalance.warehouse_id).filter(Warehouse.branch_id.in_(user_bids))
`;
    content = content.replace(matchLowStock[0], replacement);
    console.log('Secured get_low_stock_alerts');
}

fs.writeFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/backend/app/api/v1/endpoints/inventory.py', content);
