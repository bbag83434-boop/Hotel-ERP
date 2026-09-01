const { Client } = require('pg');

const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
});

async function run() {
    await client.connect();
    
    // Core tables to TRUNCATE with CASCADE
    // This will recursively wipe all related transaction, ledger, order, and history data
    const tablesToTruncate = [
        'branches',
        'warehouses',
        'items',
        'suppliers',
        'customers',
        'hr_employees',
        'hotel_rooms',
        'stock_balances',
        'stock_batches',
        'stock_ledgers',
        'purchase_orders',
        'purchase_requests',
        'goods_receive_notes',
        'vendor_bills',
        'recipes',
        'production_orders',
        'stock_transfers',
        'journal_entries',
        'payments',
        'restaurant_orders',
        'online_orders',
        'maintenance_tickets',
        'hotel_bookings',
        'staff',
        'cash_sessions',
        'attendances',
        'complaints'
    ];
    
    try {
        await client.query('BEGIN');
        
        for (let table of tablesToTruncate) {
            const query = 'TRUNCATE TABLE "' + table + '" CASCADE;';
            console.log("Executing:", query);
            await client.query(query);
        }
        
        // Delete all non-admin users
        const deleteUsers = "DELETE FROM users WHERE email != 'bbag83434@gmail.com'";
        console.log("Executing:", deleteUsers);
        const result = await client.query(deleteUsers);
        console.log("Deleted " + result.rowCount + " users.");
        
        await client.query('COMMIT');
        console.log("Cleanup complete!");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error during cleanup:", err);
    } finally {
        await client.end();
    }
}

run().catch(console.error);
