/* Final state inspection for Gulab Jamun COMP-001 seed. Writes gj_final_state.txt */
import pg from "pg";
import fs from "fs";
const { Client } = pg;
const DB_URL = process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const CID = "86187627-bceb-4fa4-8add-e44c9f2f24ee";
const GULAB_CODES = ["FG-GULAB-JAMUN-01","SFG-DOUGH-01","SFG-SYRUP-01","RM-MAIDA-01","RM-SUGAR-01","RM-GHEE-01","RM-MAWA-01","RM-OIL-01"];
const out = [];
const log = (...a) => { console.log(...a); out.push(a.join(" ")); };
const L = () => out.push("");
async function main(){
  const c = new Client({ connectionString: DB_URL }); await c.connect();
  const q = (s,p=[]) => c.query(s,p);
  log("=== FINAL STATE: Gulab Jamun BOM for COMP-001 ===\n");
  log("Company:", CID, "(COMP-001)");
  L();
  // 1. items
    const it = await q(`SELECT it.code,it.name,it.type,it."costPrice" AS cpp,it."sellingPrice" AS sp,u.symbol AS unit FROM items it JOIN units u ON u.id=it."unitId" WHERE it."companyId"=$1 AND it.code=ANY($2) ORDER BY it.code`,[CID,GULAB_CODES]);
  log("--- 1. ITEMS ("+it.rowCount+" distinct codes, expect 8) ---");
    for(const r of it.rows) log(`  ${r.code.padEnd(18)} ${r.name.padEnd(42).slice(0,42)} ${r.type.padEnd(15)} cost=$${r.cpp} sell=$${r.sp} unit=${r.unit}`);
  // duplicate check
  const dup = await q(`SELECT code,COUNT(*) cnt FROM items WHERE "companyId"=$1 AND code=ANY($2) GROUP BY code HAVING COUNT(*)>1`,[CID,GULAB_CODES]);
  log(`  duplicates: ${dup.rowCount?dup.rows.map(r=>r.code+"("+r.cnt+")").join(","): "NONE ✓"}`);
  L();
  // 2. recipes
    const recs = await q(`SELECT r.code,r."finishedItemId" AS fin_id,r."yieldQty" AS yq,r."isCurrent" AS ic,r."isActive" AS ia,it.code AS fin_code FROM recipes r JOIN items it ON it.id=r."finishedItemId" WHERE r."companyId"=$1 AND r."isActive"=true ORDER BY r.code`,[CID]);
  log("--- 2. ACTIVE RECIPES ---");
  for(const r of recs.rows) log(`  ${r.code.padEnd(26)} fin=${r.fin_code} yield=${r.yq} current=${r.ic} active=${r.ia}`);
  // recipe items count
  const ric = await q(`SELECT r.code rec, COUNT(ri.id) n FROM recipes r JOIN items it ON it.id=r."finishedItemId" JOIN recipe_items ri ON ri."recipeId"=r.id WHERE r."companyId"=$1 GROUP BY r.code ORDER BY r.code`,[CID]);
  log("  recipe_items per recipe:");
  for(const r of ric.rows) log(`    ${r.rec.padEnd(26)} -> ${r.n} ingredients`);
  L();
  // 3. stock balances
  const wh = await q(`SELECT id FROM warehouses WHERE "companyId"=$1 AND "isCentral"=true LIMIT 1`,[CID]);
  const WH = wh.rows[0]?.id;
  const sb = await q(`SELECT b.quantity,it.code item,u.symbol unit FROM stock_balances b JOIN items it ON it.id=b."itemId" JOIN units u ON u.id=it."unitId" WHERE b."warehouseId"=$1 AND it.code=ANY($2) ORDER BY it.code`,[WH,GULAB_CODES]);
  log(`--- 3. STOCK BALANCES (central kitchen SL-01, ${WH?.slice(0,8)}) ---`);
  for(const r of sb.rows) log(`  ${r.item.padEnd(18)} qty=${r.quantity} ${r.unit}`);
  L();
  // 4. HHG-51F339
  const hhg = await q(`SELECT table_name FROM information_schema.tables t WHERE EXISTS (SELECT 1 FROM items WHERE code='HHG-51F339') UNION ALL SELECT table_name FROM information_schema.tables t WHERE EXISTS (SELECT 1 FROM recipes WHERE code='HHG-51F339')`,[]);
  const hhgItem = await q(`SELECT id,code,name,type FROM items WHERE code='HHG-51F339' AND "companyId"=$1`,[CID]);
  const hhgRec = await q(`SELECT id,code FROM recipes WHERE code='HHG-51F339' AND "companyId"=$1`,[CID]);
  log("--- 4. HHG-51F339 (must be untouched/empty) ---");
  log(`  items: ${hhgItem.rowCount?'PRESENT:'+JSON.stringify(hhgItem.rows[0]):'not present ✓'}`);
  log(`  recipes: ${hhgRec.rowCount?'PRESENT:'+JSON.stringify(hhgRec.rows[0]):'not present ✓'}`);
  L();
  // 5. kitchen orders & production orders (should NOT have been created by this seed)
  const ko = await q(`SELECT COUNT(*) n FROM kitchen_orders ko JOIN items it ON it.id=ko."itemId" WHERE it.code=ANY($1) AND ko."companyId"=$2`,[GULAB_CODES,CID]);
  const po = await q(`SELECT COUNT(*) n FROM production_orders po JOIN recipes r ON r.id=po."recipeId" WHERE r."companyId"=$1`,[CID]);
  const poAll = await q(`SELECT COUNT(*) n FROM production_orders WHERE "companyId"=$1`,[CID]);
  log("--- 5. Kitchen orders / Production orders (seed must NOT create these) ---");
  log(`  kitchen_orders for Gulab items: ${ko.rows[0].n} (expect 0)`);
  log(`  production_orders referencing COMP-001 recipes: ${po.rows[0].n}`);
  log(`  total production_orders for COMP-001: ${poAll.rows[0].n}`);
  L();
  // 6. available-items SQL replication (final)
  const av = await q(`SELECT it.code,it.type,it."isActive" active,EXISTS(SELECT 1 FROM recipes WHERE "finishedItemId"=it.id AND "companyId"=$1 AND "isActive"=true AND "isCurrent"=true) hr FROM items it WHERE it."companyId"=$1 AND it.code='FG-GULAB-JAMUN-01'`,[CID]);
  log("--- 6. available-items (FG only) ---");
  for(const r of av.rows) log(`  ${r.code} type=${r.type} active=${r.active} has_recipe=${r.hr}`);
  log(`\n✅ TOTALS: items=${it.rowCount} recipes=${recs.rowCount} stocked=${sb.rowCount} hhg=${hhgItem.rowCount+hhgRec.rowCount}`);
  await c.end();
  fs.writeFileSync("gj_final_state.txt", out.join("\n"));
  console.log("\n(Written to gj_final_state.txt)");
}
main().catch(e=>{console.error("ERR",e.message);process.exit(1);});
