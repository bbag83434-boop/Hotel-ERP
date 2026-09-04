const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  const branches = await client.query('SELECT id, name, type FROM branches');
  console.log('BRANCHES:', branches.rows);
  const wh = await client.query('SELECT id, name, "branchId", "isCentral" FROM warehouses');
  console.log('WAREHOUSES:', wh.rows);
  client.end();
});
