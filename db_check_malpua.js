const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  try {
    const items = await client.query('SELECT id, code, name, type, "isActive" FROM items WHERE name ILIKE \'%malpua%\'');
    console.log('Malpua Items:', items.rows);
  } catch(e) { console.error(e); }
  client.end();
});
