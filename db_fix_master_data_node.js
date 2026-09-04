const { Client } = require('pg');
const crypto = require('crypto');

const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });

client.connect().then(async () => {
  try {
    const userRes = await client.query('SELECT * FROM "users" WHERE email = $1', ['bbag83434@gmail.com']);
    const cid = userRes.rows[0].companyId || userRes.rows[0].company_id;
    console.log('Company:', cid);
    
    await client.query('UPDATE items SET "isActive" = true WHERE code = $1', ['GUL-01']);
    console.log('Activated GUL-01');
    
    await client.query('UPDATE items SET "isActive" = true WHERE code = $1', ['FG-GULAB-JAMUN-01']);
    console.log('Activated FG-GULAB-JAMUN-01');
    
    const fgGul = await client.query('SELECT id FROM items WHERE code = $1', ['FG-GULAB-JAMUN-01']);
    if (fgGul.rows.length > 0) {
      await client.query('UPDATE recipes SET "isActive" = true, "isCurrent" = true WHERE "finishedItemId" = $1', [fgGul.rows[0].id]);
      console.log('Activated recipe for FG-GULAB-JAMUN-01');
    }
    
    const malpuaCheck = await client.query('SELECT id FROM items WHERE code = $1', ['MAL-01']);
    let malpuaId;
    if (malpuaCheck.rows.length === 0) {
      const categoryRes = await client.query('SELECT id FROM item_categories LIMIT 1');
      let categoryId = categoryRes.rows.length > 0 ? categoryRes.rows[0].id : null;
      if (!categoryId) {
         categoryId = crypto.randomUUID();
         await client.query('INSERT INTO item_categories (id, "companyId", name, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, NOW(), NOW())', [categoryId, cid, 'Sweets']);
      }
      
      const unitRes = await client.query('SELECT id FROM units WHERE symbol IN (\'pcs\', \'PCS\') LIMIT 1');
      let unitId = unitRes.rows.length > 0 ? unitRes.rows[0].id : null;
      if (!unitId) {
         const altUnitRes = await client.query('SELECT id FROM units LIMIT 1');
         unitId = altUnitRes.rows[0].id;
      }
      
      malpuaId = crypto.randomUUID();
      await client.query(`
        INSERT INTO items (id, "companyId", "categoryId", type, code, name, "unitId", "costPerUnit", "isActive", "createdAt", "updatedAt") 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
      `, [malpuaId, cid, categoryId, 'FINISHED_GOOD', 'MAL-01', 'Malpua (2 pcs)', unitId, 50.0]);
      console.log('Created Malpua Item MAL-01');
    } else {
      malpuaId = malpuaCheck.rows[0].id;
      await client.query('UPDATE items SET "isActive" = true WHERE id = $1', [malpuaId]);
    }
    
    const recipeCheck = await client.query('SELECT id FROM recipes WHERE "finishedItemId" = $1', [malpuaId]);
    if (recipeCheck.rows.length === 0) {
      const rmRes = await client.query('SELECT id, "unitId" FROM items WHERE type = $1 LIMIT 1', ['RAW_MATERIAL']);
      const rmId = rmRes.rows[0].id;
      const rmUnit = rmRes.rows[0].unitId || rmRes.rows[0].unit_id;
      
      const recipeId = crypto.randomUUID();
      await client.query(`
        INSERT INTO recipes (id, "companyId", "finishedItemId", code, name, "expectedYield", "isActive", "isCurrent", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, true, true, NOW(), NOW())
      `, [recipeId, cid, malpuaId, 'REC-MAL-01', 'Malpua Recipe', 1.0]);
      
      await client.query(`
        INSERT INTO recipe_items (id, "recipeId", "itemId", quantity, "unitId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `, [crypto.randomUUID(), recipeId, rmId, 0.5, rmUnit]);
      console.log('Created Recipe for Malpua');
    } else {
      await client.query('UPDATE recipes SET "isActive" = true, "isCurrent" = true WHERE id = $1', [recipeCheck.rows[0].id]);
    }
    
    console.log('Fix applied successfully');
  } catch(e) { console.error(e); }
  client.end();
});
