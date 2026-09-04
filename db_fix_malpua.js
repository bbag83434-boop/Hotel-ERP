const { Client } = require('pg');
const crypto = require('crypto');

const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });

client.connect().then(async () => {
  try {
    const userRes = await client.query('SELECT * FROM "users" WHERE email = $1', ['bbag83434@gmail.com']);
    const cid = userRes.rows[0].companyId || userRes.rows[0].company_id;
    
    const existingItem = await client.query('SELECT "categoryId", "unitId" FROM items WHERE code = $1', ['GUL-01']);
    const categoryId = existingItem.rows[0].categoryId;
    const unitId = existingItem.rows[0].unitId;
    
    const malpuaId = crypto.randomUUID();
    await client.query(`
      INSERT INTO items (id, "companyId", "categoryId", type, code, name, "unitId", "isActive", "createdAt", "updatedAt") 
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
    `, [malpuaId, cid, categoryId, 'FINISHED_GOOD', 'MAL-01', 'Malpua (2 pcs)', unitId]);
    console.log('Created Malpua Item MAL-01');
    
    const rmRes = await client.query('SELECT id, "unitId" FROM items WHERE type = $1 LIMIT 1', ['RAW_MATERIAL']);
    const rmId = rmRes.rows[0].id;
    const rmUnit = rmRes.rows[0].unitId;
    
    const recipeId = crypto.randomUUID();
    await client.query(`
      INSERT INTO recipes (id, "companyId", "finishedItemId", code, name, "isActive", "isCurrent", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, true, true, NOW(), NOW())
    `, [recipeId, cid, malpuaId, 'REC-MAL-01', 'Malpua Recipe']);
    
    await client.query(`
      INSERT INTO recipe_items (id, "recipeId", "itemId", quantity, "unitId", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    `, [crypto.randomUUID(), recipeId, rmId, 0.5, rmUnit]);
    console.log('Created Recipe for Malpua');
    
  } catch(e) { console.error(e); }
  client.end();
});
