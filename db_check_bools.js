const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  try {
    const recipes = await client.query('SELECT id, "finishedItemId", "isActive", "isCurrent" FROM recipes');
    console.log(recipes.rows);
    const items = await client.query('SELECT id, code, "isActive" FROM items WHERE code IN (\'GUL-01\', \'FG-GULAB-JAMUN-01\')');
    console.log(items.rows);
  } catch(e) { console.error(e); }
  client.end();
});
