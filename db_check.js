const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  const user = await client.query('SELECT company_id FROM "users" WHERE email = $1', ['bbag83434@gmail.com']);
  const cid = user.rows[0].company_id;
  console.log('Company:', cid);
  
  const items = await client.query('SELECT id, code, name, type, is_active FROM items WHERE company_id = $1', [cid]);
  console.log('Items:', items.rows);
  
  const recipes = await client.query('SELECT id, finished_item_id, is_active, is_current FROM recipes WHERE company_id = $1', [cid]);
  console.log('Recipes:', recipes.rows);
  
  client.end();
});
