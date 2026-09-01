const fs = require('fs');
let content = fs.readFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/backend/app/api/v1/endpoints/inventory.py', 'utf8');

const helpers = `
def _role_name(user: User) -> str:
    return (user.role.name if user.role else "").strip().upper()

def _is_inventory_manager(user: User) -> bool:
    return _role_name(user) in {
        "SUPER_ADMIN", "SUPERADMIN", "OWNER", "ADMIN", "HQ_ADMIN", "HEAD_OFFICE_ADMIN",
        "CENTRAL_PURCHASE_MANAGER", "CENTRAL_STORE_MANAGER", "GENERAL_MANAGER", "DIRECTOR"
    }

def _user_branch_ids(user: User) -> set:
    return {ub.branch_id for ub in (user.branches or [])}
`;

if (!content.includes('_is_inventory_manager')) {
    content = content.replace('router = APIRouter()', 'router = APIRouter()\n\n' + helpers);
}

// 1. get_stock_balances
let matchStockBalances = content.match(/def get_stock_balances\([\s\S]*?\):\s*query = db\.query\(StockBalance\)\.join\([\s\S]*?\)\.filter\(Item\.company_id == current_user\.company_id\)/);
if (matchStockBalances) {
    let replacement = matchStockBalances[0] + `
    if not _is_inventory_manager(current_user):
        user_bids = list(_user_branch_ids(current_user))
        if not user_bids:
            return [] # No branches -> no stock
        query = query.join(Warehouse, Warehouse.id == StockBalance.warehouse_id).filter(Warehouse.branch_id.in_(user_bids))
`;
    content = content.replace(matchStockBalances[0], replacement);
}

// 2. get_stock_ledger
let matchStockLedger = content.match(/def get_stock_ledger\([\s\S]*?\):\s*query = db\.query\(StockLedger\)\.filter\(StockLedger\.company_id == current_user\.company_id\)/);
if (matchStockLedger) {
    let replacement = matchStockLedger[0] + `
    if not _is_inventory_manager(current_user):
        user_bids = list(_user_branch_ids(current_user))
        if not user_bids:
            return []
        query = query.join(Warehouse, Warehouse.id == StockLedger.warehouse_id).filter(Warehouse.branch_id.in_(user_bids))
`;
    content = content.replace(matchStockLedger[0], replacement);
}

// 3. get_stock_batches
let matchStockBatches = content.match(/def get_stock_batches\([\s\S]*?\):\s*query = db\.query\(StockBatch\)\.join\([\s\S]*?\)\.filter\(Item\.company_id == current_user\.company_id\)/);
if (matchStockBatches) {
    let replacement = matchStockBatches[0] + `
    if not _is_inventory_manager(current_user):
        user_bids = list(_user_branch_ids(current_user))
        if not user_bids:
            return []
        query = query.join(Warehouse, Warehouse.id == StockBatch.warehouse_id).filter(Warehouse.branch_id.in_(user_bids))
`;
    content = content.replace(matchStockBatches[0], replacement);
}

fs.writeFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/backend/app/api/v1/endpoints/inventory.py', content);
console.log('Successfully secured inventory API.');
