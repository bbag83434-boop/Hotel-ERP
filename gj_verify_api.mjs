/*
 * gj_verify_api.mjs — Verify Gulab Jamun BOM via the LIVE deployed backend API.
 * Hits https://hotel-erp-muv8.onrender.com (the real Python FastAPI + Neon DB).
 * Confirms: login -> available-items -> items -> recipes -> stock-balances.
 */
const API = "https://hotel-erp-muv8.onrender.com/api/v1";
const EMAIL = "bbag83434@gmail.com";
const PASS = "admin123";

async function call(method, path, token, body) {
  const h = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, {
    method, headers: h, body: body ? JSON.stringify(body) : undefined,
  });
  let data; try { data = await r.json(); } catch { data = await r.text(); }
  if (!r.ok) { console.error(`  ✗ ${method} ${path} -> ${r.status}`, JSON.stringify(data).slice(0, 300)); }
  return { ok: r.ok, status: r.status, data };
}

(async () => {
  console.log("=== STEP 1: Login (POST /auth/login) ===");
  const login = await call("POST", "/auth/login", null, { email: EMAIL, password: PASS });
  if (!login.ok) { console.error("Login failed."); process.exit(1); }
  const token = login.data.access_token;
  const u = login.data.user;
  console.log(`  ✓ login 200 — email=${u.email} role=${u.role} company=${u.company_id || "(n/a)"}`);
  if (!u.company_id) { console.error("  No company_id in user profile — cannot proceed."); process.exit(1); }

  console.log("\n=== STEP 2: Available Kitchen Order items (GET /kitchen-orders/available-items) ===");
  const items = await call("GET", "/kitchen-orders/available-items?search=gulab", token);
  console.log(`  status ${items.status}`);
  const list = Array.isArray(items.data) ? items.data : [];
  const gj = list.find((x) => x.code === "FG-GULAB-JAMUN-01");
  if (gj) {
    console.log(`  ✓ GULAB JAMUN FOUND in available-items:`);
    console.log(`    code=${gj.code}`);
    console.log(`    name=${gj.name}`);
    console.log(`    type=${gj.type}`);
    console.log(`    category=${gj.category_name}`);
    console.log(`    unit=${gj.unit_symbol}`);
    console.log(`    cost_price=${gj.cost_price}  selling_price=${gj.selling_price}`);
    console.log(`    has_recipe=${gj.has_recipe}`);
    console.log(`\n  ✅ Gulab Jamun appears in Outlet → Kitchen Orders → + New Kitchen Order.`);
  } else {
    console.log("  ✗ FG-GULAB-JAMUN-01 NOT in available-items!");
    console.log("  all returned:", JSON.stringify(list).slice(0, 500));
  }

  console.log("\n=== STEP 3: All Gulab items via inventory API (GET /inventory/items) ===");
  const inv = await call("GET", "/inventory/items?search=gulab", token);
  const invList = Array.isArray(inv.data) ? inv.data : (inv.data?.items || []);
  for (const it of invList) console.log(`  ${it.code}  ${it.name}  type=${it.type}  unit=${it.unit_symbol||it.unit_id}  cost=${it.cost_price}`);

  console.log("\n=== STEP 4: Gulab recipes via API (GET /recipes) ===");
  const rec = await call("GET", "/recipes?is_active=true", token);
  const recList = Array.isArray(rec.data) ? rec.data : (rec.data?.items || []);
  const gjRecs = recList.filter((r) => /gulab|dough|syrop|syru|jamun/i.test(r.code || "") || /gulab|dough|jamun/i.test(r.name || ""));
  for (const r of gjRecs) console.log(`  ${r.code}  fin=${r.finished_item_code||r.finishedItemId}  yield=${r.yield_qty}  active/current=${r.is_active}/${r.is_current}`);

  console.log("\n=== STEP 5: Stock balances in central kitchen (GET /inventory/stock-balances) ===");
  const stk = await call("GET", "/inventory/stock-balances?warehouse_id=3d296770-a57e-4b90-9c9f-47151bc92039", token);
  const stkList = Array.isArray(stk.data) ? stk.data : (stk.data?.items || []);
  const gjStock = stkList.filter((s) => s.item_code && /gulab|dough|syru|maid|sugar|ghee|mawa|oil/i.test(s.item_code || ""));
  for (const s of gjStock) console.log(`  ${s.item_code}  qty=${s.quantity}  unit=${s.unit_symbol}`);

  console.log("\n=== SUMMARY ===");
  console.log(gj ? "✅ VERIFIED: Gulab Jamun is orderable from Outlet → Kitchen Orders → + New Kitchen Order" : "❌ Gulab Jamun NOT yet visible");
  console.log(`   company_id=${u.company_id} | role=${u.role}`);
})();
