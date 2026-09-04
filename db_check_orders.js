const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  const res = await client.query('SELECT status, "requestedQty", "dispatchedQty" FROM kitchen_orders ORDER BY "createdAt" DESC LIMIT 2');
  console.log(res.rows);
  client.end();
});
