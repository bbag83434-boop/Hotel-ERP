const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  try {
    const user = await client.query('SELECT * FROM "users" WHERE email = $1', ['bbag83434@gmail.com']);
    console.log('User:', user.rows[0]);
    const cid = user.rows[0].company_id || user.rows[0].companyId;
    
    const items = await client.query('SELECT * FROM items WHERE company_id = $1 OR "companyId" = $1', [cid]).catch(()=>client.query('SELECT * FROM items'));
    console.log('Items mapping:', items.rows.map(i => ({id: i.id, type: i.type, code: i.code})));
    
    const recipes = await client.query('SELECT * FROM recipes').catch(()=>({rows:[]}));
    console.log('Recipes:', recipes.rows.map(r => ({id: r.id, fin: r.finished_item_id || r.finishedItemId})));
  } catch(e) {
    console.error(e);
  } finally {
    client.end();
  }
});
