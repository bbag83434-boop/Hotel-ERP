const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  const items = await client.query("SELECT id, name FROM items WHERE name IN ('Refined Oil', 'Maida')");
  console.log('ITEMS:', items.rows);
  
  for (let row of items.rows) {
    const qty = 50000;
    // Insert into StockBatch
    const batchId = require('crypto').randomUUID();
    await client.query(
      `INSERT INTO stock_batches (id, warehouse_id, item_id, quantity, unit_cost, batch_number, created_at, updated_at) 
       VALUES ($1, '3d296770-a57e-4b90-9c9f-47151bc92039', $2, $3, 10, $4, NOW(), NOW())`,
      [batchId, row.id, qty, 'BATCH-TEST-01']
    );
    // Update or Insert into StockBalance
    const bal = await client.query(`SELECT id FROM stock_balances WHERE warehouse_id = '3d296770-a57e-4b90-9c9f-47151bc92039' AND item_id = $1`, [row.id]);
    if (bal.rows.length > 0) {
      await client.query(`UPDATE stock_balances SET quantity = quantity + $1 WHERE id = $2`, [qty, bal.rows[0].id]);
    } else {
      await client.query(
        `INSERT INTO stock_balances (id, warehouse_id, item_id, quantity, created_at, updated_at) VALUES ($1, '3d296770-a57e-4b90-9c9f-47151bc92039', $2, $3, NOW(), NOW())`,
        [require('crypto').randomUUID(), row.id, qty]
      );
    }
  }
  console.log('Stock inserted successfully!');
  client.end();
});
