const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  const items = await client.query('SELECT id, name FROM items WHERE name = $1', ['Gulab Jamun']);
  if(items.rows.length) {
    const stock = await client.query('SELECT warehouse_id, quantity FROM stock_balances WHERE item_id = $1', [items.rows[0].id]);
    console.log(stock.rows);
  }
  client.end();
});
