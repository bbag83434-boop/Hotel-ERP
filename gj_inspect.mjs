import pg from 'pg';
import fs from 'fs';
const DATABASE_URL = "postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
const out = [];
const log = (s) => out.push(s);
const P = (q, p = []) => client.query(q, p);

(async () => {
  try {
    await client.connect();
    const cid = "86187627-bceb-4fa4-8add-e44c9f2f24ee";

    log("=== BRANCHES ===");
    log(JSON.stringify((await P("SELECT id,name,code,type FROM branches WHERE \"companyId\"=$1", [cid])).rows));

    log("\n=== WAREHOUSES ===");
    log(JSON.stringify((await P("SELECT id,name,code,\"isCentral\",\"isActive\",\"branchId\" FROM warehouses WHERE \"companyId\"=$1", [cid])).rows));

    log("\n=== STANDARD UNITS ===");
    log(JSON.stringify((await P("SELECT id,name,symbol FROM units WHERE \"companyId\"=$1 AND symbol IN ('kg','l','pcs','ml','gm','qty','L')", [cid])).rows));

    log("\n=== CATEGORIES ===");
    log(JSON.stringify((await P("SELECT id,name,code FROM categories WHERE \"companyId\"=$1 ORDER BY name", [cid])).rows));

    log("\n=== KEY ITEMS ===");
    log(JSON.stringify((await P("SELECT id,name,code,type::text,\"categoryId\",\"unitId\",\"costPrice\",\"sellingPrice\",\"isActive\" FROM items WHERE \"companyId\"=$1 AND code IN ('FG-GULAB-JAMUN-01','RM-MAIDA-01','RM-MAWA-01','RM-SUGAR-FINE','RM-DESI-GHEE','RM-PANEER-CRUMB','RM-FLOUR-01','RM-GHEE-01','RM-SUGAR-01','RM-OIL-01','MI-GULAB-JAMUN','HHG-51F339') ORDER BY code", [cid])).rows));

    log("\n=== ALL FG/SFI items ===");
    log(JSON.stringify((await P("SELECT id,code,name,type::text,\"isActive\" FROM items WHERE \"companyId\"=$1 AND type IN ('FINISHED_GOOD','SEMI_FINISHED') ORDER BY code", [cid])).rows));

    log("\n=== RECIPES ===");
    log(JSON.stringify((await P("SELECT id,\"finishedItemId\",name,code,version,\"yieldQty\",\"isCurrent\",\"isActive\" FROM recipes WHERE \"companyId\"=$1 ORDER BY code,version", [cid])).rows));

    log("\n=== RECIPE_ITEMS ===");
    log(JSON.stringify((await P("SELECT ri.\"recipeId\",r.code AS rc,ri.\"rawItemId\",i.code AS raw_code,i.name AS rn,i.type::text AS rt,ri.\"unitId\",u.symbol,ri.quantity,ri.\"usableYield\",ri.\"wastePercentage\",ri.\"costContribution\",ri.notes FROM recipe_items ri JOIN recipes r ON r.id=ri.\"recipeId\" JOIN items i ON i.id=ri.\"rawItemId\" LEFT JOIN units u ON u.id=ri.\"unitId\" WHERE r.\"companyId\"=$1 ORDER BY r.code", [cid])).rows));

    log("\n=== STOCK BALANCES (gulab-related) ===");
    log(JSON.stringify((await P("SELECT sb.\"warehouseId\",w.code AS wc,i.code AS ic,sb.quantity FROM stock_balances sb JOIN items i ON i.id=sb.\"itemId\" JOIN warehouses w ON w.id=sb.\"warehouseId\" WHERE i.\"companyId\"=$1 AND (lower(i.code) LIKE '%gulab%' OR lower(i.code) LIKE '%gj%' OR lower(i.code) LIKE '%mawa%' OR lower(i.code) LIKE '%sugar%' OR lower(i.code) LIKE '%ghee%' OR lower(i.code) LIKE '%maida%' OR lower(i.code) LIKE '%flour%' OR lower(i.code) LIKE '%oil%' OR lower(i.code) LIKE '%dough%' OR lower(i.code) LIKE '%syrup%') ORDER BY w.code,i.code", [cid])).rows));

    log("\n=== HHG-51F339 search ===");
    log(JSON.stringify((await P("SELECT t,tid||'' AS id,code,name FROM (SELECT 'items' AS t,id,code,name FROM items WHERE code ILIKE '%HHG-51F339%' OR name ILIKE '%HHG-51F339%' UNION ALL SELECT 'recipes',id,code,name FROM recipes WHERE code ILIKE '%HHG-51F339%' OR name ILIKE '%HHG-51F339%' UNION ALL SELECT 'recipe_items',id,null::text,notes FROM recipe_items WHERE notes ILIKE '%HHG-51F339%' UNION ALL SELECT 'warehouse',id,code,name FROM warehouses WHERE code ILIKE '%HHG-51F339%' OR name ILIKE '%HHG-51F339%' UNION ALL SELECT 'branch',id,code,name FROM branches WHERE code ILIKE '%HHG-51F339%' OR name ILIKE '%HHG-51F339%' UNION ALL SELECT 'menu_item',id,code,name FROM menu_items WHERE code ILIKE '%HHG-51F339%' OR name ILIKE '%HHG-51F339%') s")).rows));

    log("\n=== ALL items (company, summary by type) ===");
    log(JSON.stringify((await P("SELECT type::text AS t, count(*) FROM items WHERE \"companyId\"=$1 GROUP BY type", [cid])).rows));
  } catch (e) {
    log("ERROR: " + e.stack);
  } finally {
    fs.writeFileSync('inspect_out.txt', out.join('\n'));
    log("\n=== WROTE inspect_out.txt ===");
    await client.end();
    process.exit(0);
  }
})();
