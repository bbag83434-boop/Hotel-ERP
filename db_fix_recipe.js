const { Client } = require('pg');
const crypto = require('crypto');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  try {
    const malpuaCheck = await client.query("SELECT id FROM items WHERE code = 'MAL-01'");
    const malpuaId = malpuaCheck.rows[0].id;
    const userRes = await client.query('SELECT * FROM "users" WHERE email = $1', ['bbag83434@gmail.com']);
    const cid = userRes.rows[0].companyId || userRes.rows[0].company_id;
    
    const recipeCheck = await client.query('SELECT id FROM recipes WHERE "finishedItemId" = $1', [malpuaId]);
    if(recipeCheck.rows.length === 0) {
        const rmRes = await client.query('SELECT id, "unitId" FROM items WHERE type = $1 LIMIT 1', ['RAW_MATERIAL']);
        const recipeId = crypto.randomUUID();
        await client.query('INSERT INTO recipes (id, "companyId", "finishedItemId", code, name, "isActive", "isCurrent", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, true, true, NOW(), NOW())', [recipeId, cid, malpuaId, 'REC-MAL-01', 'Malpua Recipe']);
        console.log('Recipe inserted!');
    } else {
        console.log('Recipe already exists!');
    }
  } catch(e) { console.error(e); }
  client.end();
});
