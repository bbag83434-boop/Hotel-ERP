const { Client } = require('pg');

const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });

client.connect().then(async () => {
  try {
    const userRes = await client.query('SELECT company_id FROM "users" WHERE email = $1', ['bbag83434@gmail.com']);
    const cid = userRes.rows[0].company_id;
    console.log('Company:', cid);
    
    // 1. Activate Gulab Jamun Item (GUL-01)
    await client.query('UPDATE items SET "isActive" = true WHERE code = $1 AND company_id = $2', ['GUL-01', cid]);
    console.log('Activated GUL-01');
    
    // 2. Check if Malpua exists
    const malpuaCheck = await client.query('SELECT id FROM items WHERE code = $1 AND company_id = $2', ['MAL-01', cid]);
    let malpuaId;
    if (malpuaCheck.rows.length === 0) {
      // Find a valid unit and category first
      const categoryRes = await client.query('SELECT id FROM item_categories WHERE company_id = $1 LIMIT 1', [cid]);
      let categoryId = categoryRes.rows.length > 0 ? categoryRes.rows[0].id : null;
      if (!categoryId) {
         // Create category
         const catRes = await client.query('INSERT INTO item_categories (id, company_id, name, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW()) RETURNING id', [cid, 'Sweets']);
         categoryId = catRes.rows[0].id;
      }
      
      const unitRes = await client.query('SELECT id FROM units WHERE company_id = $1 AND symbol IN (\'pcs\', \'PCS\', \'nos\', \'NOS\') LIMIT 1', [cid]);
      let unitId = unitRes.rows.length > 0 ? unitRes.rows[0].id : null;
      if (!unitId) {
         const altUnitRes = await client.query('SELECT id FROM units WHERE company_id = $1 LIMIT 1', [cid]);
         unitId = altUnitRes.rows[0].id; // Fallback to any unit
      }
      
      // Insert Malpua
      const insertMalpua = await client.query(`
        INSERT INTO items (id, company_id, category_id, type, code, name, unit_id, "costPerUnit", "isActive", "createdAt", "updatedAt") 
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW()) RETURNING id
      `, [cid, categoryId, 'FINISHED_GOOD', 'MAL-01', 'Malpua (2 pcs)', unitId, 50.0]);
      malpuaId = insertMalpua.rows[0].id;
      console.log('Created Malpua Item MAL-01 with ID', malpuaId);
    } else {
      malpuaId = malpuaCheck.rows[0].id;
      await client.query('UPDATE items SET "isActive" = true WHERE id = $1', [malpuaId]);
      console.log('Malpua already exists, activated it');
    }
    
    // 3. Ensure Recipe exists for Malpua
    const recipeCheck = await client.query('SELECT id FROM recipes WHERE "finishedItemId" = $1 AND company_id = $2', [malpuaId, cid]);
    if (recipeCheck.rows.length === 0) {
      // Find a raw material to use as ingredient
      const rmRes = await client.query('SELECT id, unit_id FROM items WHERE type = $1 AND company_id = $2 LIMIT 1', ['RAW_MATERIAL', cid]);
      const rmId = rmRes.rows[0].id;
      const rmUnit = rmRes.rows[0].unit_id;
      
      // Create Recipe
      const insertRecipe = await client.query(`
        INSERT INTO recipes (id, company_id, "finishedItemId", code, name, "expectedYield", "isActive", "isCurrent", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, true, NOW(), NOW()) RETURNING id
      `, [cid, malpuaId, 'REC-MAL-01', 'Malpua Recipe', 1.0]);
      const recipeId = insertRecipe.rows[0].id;
      
      // Create Recipe Item
      await client.query(`
        INSERT INTO recipe_items (id, recipe_id, item_id, quantity, unit_id, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
      `, [recipeId, rmId, 0.5, rmUnit]);
      console.log('Created Recipe for Malpua REC-MAL-01');
    } else {
      const recipeId = recipeCheck.rows[0].id;
      await client.query('UPDATE recipes SET "isActive" = true, "isCurrent" = true WHERE id = $1', [recipeId]);
      console.log('Activated existing Recipe for Malpua');
    }
    
    console.log('Fix applied successfully');
  } catch(e) { console.error(e); }
  client.end();
});
