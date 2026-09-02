/*
 * gj_setup.mjs — Idempotent Gulab Jamun BOM seed for COMP-001.
 * Mirrors backend FastAPI inventory/recipe/stock logic (SQLAlchemy models
 * in app/models/inventory.py & recipe.py, StockService.post_stock_movement).
 * Does NOT recreate existing items (upsert by companyId+code). Does NOT
 * touch HHG-51F339. No kitchen orders or production orders are created.
 */
import pg from "pg";
import crypto from "crypto";
const { Client } = pg;

const DB_URL = process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const ADMIN_EMAIL = "bbag83434@gmail.com";
const COMPANY_CODE = "COMP-001";

// Ingredients (RAW_MATERIAL): cost / selling per base unit
const RAW = [
  { code:"RM-MAIDA-01", name:"Refined Wheat Flour (Maida Premium)", unit:"kg", cost:42, selling:0, minStock:25, reorder:50, stock:100 },
  { code:"RM-SUGAR-01", name:"Refined Granulated Cane Sugar",      unit:"kg", cost:45, selling:0, minStock:20, reorder:40, stock:100 },
  { code:"RM-GHEE-01",  name:"Pure Cow Desi Ghee",                 unit:"kg", cost:650, selling:0, minStock:5,  reorder:10, stock:25  },
  { code:"RM-MAWA-01",  name:"Fresh Cow Milk Mawa (Khoya)",       unit:"kg", cost:320, selling:0, minStock:10, reorder:20, stock:25  },
  { code:"RM-OIL-01",   name:"Sunflower Frying Oil",              unit:"L",  cost:120, selling:0, minStock:10, reorder:20, stock:30  },
];
// Semi-finished goods (cost derived from sub-recipes)
const SFI = [
  { code:"SFG-DOUGH-01", name:"Gulab Jamun Dough Base",  unit:"kg", type:"SEMI_FINISHED", cost:219.20, selling:0, stock:20 },
  { code:"SFG-SYRUP-01", name:"Gulab Jamun Sugar Syrup", unit:"kg", type:"SEMI_FINISHED", cost:36.00,  selling:0, stock:20 },
];
// Finished good
const FG = [
  { code:"FG-GULAB-JAMUN-01", name:"Royal Heritage Gulab Jamun (2 pcs portion)", unit:"pcs", type:"FINISHED_GOOD", cost:75.00, selling:120.00, stock:50 },
];
const ALL = [...RAW, ...SFI, ...FG];

const RECIPES = [
  {
    code:"REC-DOUGH-01", name:"Gulab Jamun Dough Base Recipe",
    fin:"SFG-DOUGH-01", yield:"1.0000", prep:20,
    ing:[
      { raw:"RM-MAIDA-01", q:"0.60" },  // 0.60 kg @42   = 25.20
      { raw:"RM-GHEE-01",  q:"0.20" },  // 0.20 kg @650  = 130.00
      { raw:"RM-MAWA-01",  q:"0.20" },  // 0.20 kg @320  = 64.00   => 219.20 /kg
    ],
  },
  {
    code:"REC-SYRUP-01", name:"Gulab Jamun Sugar Syrup Recipe",
    fin:"SFG-SYRUP-01", yield:"1.0000", prep:10,
    ing:[{ raw:"RM-SUGAR-01", q:"0.80" }],  // 0.80 kg @45 = 36.00 /kg
  },
  {
    code:"REC-GULAB-JAMUN-MASTER", name:"Royal Heritage Gulab Jamun Master Recipe",
    fin:"FG-GULAB-JAMUN-01", yield:"2.0000", prep:30,
    ing:[
      { raw:"SFG-DOUGH-01", q:"0.30" },  // 0.30 kg @219.20 = 65.76
      { raw:"SFG-SYRUP-01", q:"0.20" },  // 0.20 kg @36     = 7.20
      { raw:"RM-GHEE-01",   q:"0.10" },  // 0.10 kg @650    = 65.00
      { raw:"RM-OIL-01",    q:"0.10" },  // 0.10 L  @120    = 12.00   => 150.00 / 2 pcs = 75.00 each
    ],
  },
];

function log(...a){ console.log(...a); }
function say(s){ console.log("\n"+s); }
function $n(v){ return Number(v).toFixed(2); }
function uuid(){ return crypto.randomUUID(); }

async function run(){
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  const q = (sql,p=[]) => client.query(sql,p);
  try{
    // ---- resolve master data ----
    say("=== STEP 0: Resolve COMP-001 master data ===");
    const c = await q(`SELECT id FROM companies WHERE code=$1`,[COMPANY_CODE]);
    if(!c.rowCount) throw new Error(`Company ${COMPANY_CODE} not found`);
    const CID = c.rows[0].id; log(`Company: ${COMPANY_CODE} => ${CID}`);

    const w = await q(`SELECT id,"branchId","name","code" FROM warehouses WHERE "companyId"=$1 AND "isCentral"=true AND "isActive"=true LIMIT 1`,[CID]);
    if(!w.rowCount) throw new Error("No central kitchen warehouse found");
        const WH_ID=w.rows[0].id, BRANCH_ID=(w.rows[0].branchId||w.rows[0].branch_id||w.rows[0].branchid||null);
    log(`Warehouse: ${w.rows[0].code} => ${WH_ID} (branch ${BRANCH_ID})`);

    const u = await q(`SELECT id FROM users WHERE email=$1 AND "isActive"=true LIMIT 1`,[ADMIN_EMAIL]);
    const USER_ID = u.rowCount ? u.rows[0].id : null;
    log(`Admin user: ${USER_ID||"(none - created_by left NULL)"}`);

    const unitMap={};
    for(const [k,sym] of [["KG","kg"],["LITRE","L"],["PCS","pcs"]]){
      const r=await q(`SELECT id FROM units WHERE "companyId"=$1 AND symbol=$2 AND "isActive"=true LIMIT 1`,[CID,sym]);
      if(!r.rowCount) throw new Error(`Unit '${sym}' not found`);
      unitMap[k]=r.rows[0].id; log(`Unit '${sym}' => ${unitMap[k]}`);
    }
    const unitIdOf=(item)=> item.unit==="kg"?unitMap.KG : item.unit==="L"?unitMap.LITRE : unitMap.PCS;

    // category: reuse D-01 else create CAT-SWEETS-01
    const cR=await q(`SELECT id FROM categories WHERE "companyId"=$1 AND (code='D-01' OR code='CAT-SWEETS-01') AND "isActive"=true LIMIT 1`,[CID]);
    let CAT_ID;
    if(cR.rowCount){ CAT_ID=cR.rows[0].id; log(`Category: existing => ${CAT_ID}`); }
    else {
      const ins=await q(`INSERT INTO categories ("companyId",name,code,"isActive","createdAt","updatedAt") VALUES($1,'Dessert & Sweets','CAT-SWEETS-01',true,now(),now()) RETURNING id`,[CID]);
      CAT_ID=ins.rows[0].id; log(`Category: created => ${CAT_ID} (CAT-SWEETS-01)`);
    }

    say("=== STEP 0b: HHG-51F339 safety check ===");
    const h=await q(`SELECT id,code,type FROM items WHERE code='HHG-51F339' AND "companyId"=$1`,[CID]);
    if(h.rowCount) log("⚠ HHG-51F339 item exists — leaving untouched:",h.rows[0]);
        else log("✓ HHG-51F339 not present — will not create or touch it.");
    say("=== STEP 0c: Pre-existing Gulab items (reuse check) ===");
    const existingItems = await q(`SELECT id,code FROM items WHERE "companyId"=$1 AND code=ANY($2)`,[CID, ALL.map(i=>i.code)]);
    const existingByCode = Object.fromEntries(existingItems.rows.map(r=>[r.code,r]));
    for (const it of ALL) log(`  ${existingByCode[it.code]?'[pre-existing]':'[missing]    '} ${it.code}`);
        say("=== STEP 1: Upsert Items (idempotent by companyId+code) ===");
    const costByCode=Object.fromEntries(ALL.map(i=>[i.code,Number(i.cost)]));
    const itemIds={},itemUnit={};
        const ic=`id,"companyId","categoryId","unitId",name,code,type,"costPrice","sellingPrice","minStockLevel","reorderQty","isActive","createdAt","updatedAt"`;
    for(const it of ALL){
      const uid=unitIdOf(it);itemUnit[it.code]=uid;
      const r=await q(`INSERT INTO items (${ic}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,now(),now()) `+
        `ON CONFLICT ("companyId", code) DO UPDATE SET `+
        `name=EXCLUDED.name,"categoryId"=EXCLUDED."categoryId","unitId"=EXCLUDED."unitId",type=EXCLUDED.type,`+
        `"costPrice"=EXCLUDED."costPrice","sellingPrice"=EXCLUDED."sellingPrice","minStockLevel"=EXCLUDED."minStockLevel",`+
        `"reorderQty"=EXCLUDED."reorderQty","isActive"=true,"updatedAt"=now() RETURNING id`,
                        [uuid(),CID,CAT_ID,uid,it.name,it.code,it.type||"RAW_MATERIAL",it.cost,it.selling,it.minStock||0,it.reorder||0]);
      itemIds[it.code]=r.rows[0].id;
            log(`  ${existingByCode[it.code]?'[reuse]':'[create]'} ${it.code} ${it.type||"RAW_MATERIAL"} ${it.unit} cost=$${it.cost} sell=$${it.selling} id=${itemIds[it.code].slice(0,8)}`);
    }
    say("=== STEP 2: Upsert Stock balances + ledger (idempotent by notes=key) ===");
    for(const it of ALL){
      const iid=itemIds[it.code],key=`gj_seed_stock_${it.code}`;
      if((await q(`SELECT 1 FROM stock_ledgers WHERE notes=$1 LIMIT 1`,[key])).rowCount){log(`  [skip] ${it.code} stock already seeded`);continue;}
      const cur=(await q(`SELECT quantity FROM stock_balances WHERE "warehouseId"=$1 AND "itemId"=$2`,[WH_ID,iid]));
            const current=cur.rowCount?Number(cur.rows[0].quantity):0;const target=Number(it.stock);const change=target-current;
      await q(`INSERT INTO stock_balances (id,"warehouseId","itemId",quantity,"minStockLevel","reorderQty","updatedAt") `+
        `VALUES ($1,$2,$3,$4,$5,$6,now()) ON CONFLICT ("warehouseId","itemId") DO UPDATE SET quantity=$4,"minStockLevel"=EXCLUDED."minStockLevel","reorderQty"=EXCLUDED."reorderQty","updatedAt"=now()`,[uuid(),WH_ID,iid,target,it.minStock,it.reorder]);
            await q(`INSERT INTO stock_ledgers (id,"companyId","branchId","warehouseId","itemId","unitId","movementType","changeQty","balanceQty","unitCost","totalCost","referenceType","referenceId","idempotencyKey","isEmergencyOverride",notes,"createdById","createdAt") `+
        `VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,false,$15,$16,now())`,
        [uuid(),CID,BRANCH_ID,WH_ID,iid,itemUnit[it.code],"ADJUSTMENT",change,target,it.cost,(change*it.cost).toFixed(2),"SEED",key,key,key,USER_ID]);
      log(`  [seed] ${it.code} ${$n(current)} -> ${$n(target)} ${it.unit} (ledger note='${key}')`);
    }
    say("=== STEP 3: Upsert Recipes (BOM) + recipe_items ===");
        const rc=`id,"companyId","finishedItemId",name,code,version,"effectiveDate","isCurrent",description,"yieldQty","preparationMinutes",instructions,"isActive","createdAt","updatedAt"`;
    for(const rec of RECIPES){
      const finId=itemIds[rec.fin];
      const r=await q(`INSERT INTO recipes (${rc}) VALUES ($1,$2,$3,$4,$5,$6,now(),true,$7,$8,$9,$10,true,now(),now()) `+
        `ON CONFLICT ("companyId",code,version) DO UPDATE SET name=EXCLUDED.name,"finishedItemId"=EXCLUDED."finishedItemId","isCurrent"=true,"isActive"=true,"yieldQty"=EXCLUDED."yieldQty","preparationMinutes"=EXCLUDED."preparationMinutes",instructions=EXCLUDED.instructions,"updatedAt"=now() RETURNING id`,
        [uuid(),CID,finId,rec.name,rec.code,1,rec.name+` recipe for ${rec.fin}`,rec.yield,rec.prep,rec.name+` (BOM: ${rec.ing.length} ingredients)`]);
      const rid=r.rows[0].id;await q(`DELETE FROM recipe_items WHERE "recipeId"=$1`,[rid]);
      for(const ing of rec.ing){
        const cost=costByCode[ing.raw]||0;const cc=(Number(ing.q)*cost).toFixed(2);const u=itemUnit[ing.raw];
                await q(`INSERT INTO recipe_items (id,"recipeId","rawItemId","unitId",quantity,"grossQuantity","usableYield","wastePercentage","costContribution",notes) VALUES ($1,$2,$3,$4,$5,$5,100.00,0.00,$6,$7)`,[uuid(),rid,itemIds[ing.raw],u,Number(ing.q),Number(cc),`${rec.code}:${ing.raw}`]);
        log(`    ${ing.raw} ${$n(ing.q)} ${ALL.find(x=>x.code===ing.raw).unit} @$${cost} => contrib $${cc}`);
      }
      log(`  [recipe] ${rec.code} id=${rid.slice(0,8)} fin=${rec.fin} yield=${rec.yield} (${rec.ing.length} ing)`);
    }
    say("=== STEP 4: SQL verify (replicates available-items filter) ===");
    const a=await q(`SELECT it.id,it.code,it.type,u.symbol FROM items it JOIN units u ON u.id=it."unitId" WHERE it."companyId"=$1 AND it."isActive"=true AND it.type IN ('FINISHED_GOOD','SEMI_FINISHED') ORDER BY it.type,it.code`,[CID]);
        const rf=(await q(`SELECT DISTINCT "finishedItemId" FROM recipes WHERE "companyId"=$1 AND "isActive"=true AND "isCurrent"=true`,[CID])).rows.map(x=>x.finishedItemId||x.finisheditemid);
    const fs=new Set(rf);
    for(const x of a.rows) log(`  ${x.type.padEnd(14)} ${x.code.padEnd(22)} unit=${x.symbol} has_recipe=${fs.has(x.id)}`);
    const gj=a.rows.find(x=>x.code==="FG-GULAB-JAMUN-01");
    log(gj?`\n✅ Gulab Jamun FG present in SQL available-items view (has_recipe=${fs.has(gj.id)}).`:`\n❌ Gulab Jamun FG MISSING from SQL view.`);
    await client.end();
    log("✅ SQL setup complete. Run gj_verify_api.mjs for live-API verification.");
  } catch(e){ await client.end(); console.error("\n❌ FAILED:",e.message); process.exit(1);}
}

run();
