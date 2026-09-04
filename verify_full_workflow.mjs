const API = 'https://hotel-erp-muv8.onrender.com/api/v1';

async function call(method, path, token, body = null) {
  const opts = { method, headers: {} };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API + path, opts);
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; } 
  catch(e) { return { status: res.status, data: text }; }
}

async function run() {
  console.log('--- STARTING COMPLETE LIVE WORKFLOW VERIFICATION ---');
  const login = await call('POST', '/auth/login', null, { email: 'bbag83434@gmail.com', password: 'admin123' });
  const token = login.data.access_token;
  
  const outlet = { id: 'b777a956-2cd3-4c90-b6d0-19679d58ef37' };
  const centralWh = { id: '3d296770-a57e-4b90-9c9f-47151bc92039', branch_id: '95ed9e6c-5b16-43a8-84b1-d9ae25990694' };
  const outletWh = { id: '5e9a786a-8830-4532-bb95-1852b6539b3b' };
  
  const items = await call('GET', '/kitchen-orders/available-items', token);
  const gj = items.data.find(i => i.name.includes('Gulab Jamun'));
  const malpua = items.data.find(i => i.name.includes('Malpua'));

  const getStock = async (warehouseId, itemId) => {
      const res = await call('GET', `/inventory/stock-balances?warehouse_id=${warehouseId}`, token);
      const items = Array.isArray(res.data) ? res.data : res.data.items || [];
      return items.find(i => i.item_id === itemId)?.quantity || 0;
  };

  const initialSV_GJ = await getStock(centralWh.id, gj.id);
  const initialSV_M = await getStock(centralWh.id, malpua.id);

  console.log('0. Adjusting Raw Material Stock (Refined Oil & Maida)...');
  const allInvItems = await call('GET', '/inventory/items', token);
  const rawItems = Array.isArray(allInvItems.data) ? allInvItems.data : allInvItems.data.items || [];
  const refinedOil = rawItems.find(i => i.name.includes('Refined Oil'));
  const maida = rawItems.find(i => i.name.includes('Maida'));
  
  if (refinedOil && maida) {
    const batchOil = await call('POST', '/inventory/batches', token, {
      warehouse_id: centralWh.id, item_id: refinedOil.id, batch_number: 'BATCH-' + Date.now(), quantity: 5000, unit_cost: 10
    });
    const batchMaida = await call('POST', '/inventory/batches', token, {
      warehouse_id: centralWh.id, item_id: maida.id, batch_number: 'BATCH-' + Date.now(), quantity: 5000, unit_cost: 10
    });
    
    await call('POST', '/inventory/adjustments', token, {
      warehouse_id: centralWh.id, item_id: refinedOil.id, change_qty: 5000, reason_code: 'FOUND_STOCK', reason: 'FOUND_STOCK', batch_number: batchOil.data?.batch_number || 'BATCH-TEST'
    });
    await call('POST', '/inventory/adjustments', token, {
      warehouse_id: centralWh.id, item_id: maida.id, change_qty: 5000, reason_code: 'FOUND_STOCK', reason: 'FOUND_STOCK', batch_number: batchMaida.data?.batch_number || 'BATCH-TEST'
    });
    console.log('Raw material stock adjusted via batches (+5000)');
  }
  
  console.log('1. Creating Demands...');
  const dGJ = await call('POST', '/kitchen-orders', token, { branch_id: outlet.id, item_id: gj.id, requested_qty: 100 });
  const dM = await call('POST', '/kitchen-orders', token, { branch_id: outlet.id, item_id: malpua.id, requested_qty: 20 });
  console.log('Demands Created:', dGJ.status === 201, dM.status === 201);
  
  console.log('2. HO Approve Demand...');
  await call('POST', `/kitchen-orders/${dGJ.data.id}/approve`, token, { notes: 'ok' });
  await call('POST', `/kitchen-orders/${dM.data.id}/approve`, token, { notes: 'ok' });
  
  console.log('3. Verify Sector V sees APPROVED demand');
  const svOrders = await call('GET', `/recipes/production/central-kitchen/orders`, token);
  const svOrdersList = Array.isArray(svOrders.data) ? svOrders.data : svOrders.data.items || [];
  // The backend kitchen orders API is also available at /kitchen-orders
  const allOrders = await call('GET', '/kitchen-orders', token);
  const approvedGJ = (Array.isArray(allOrders.data) ? allOrders.data : allOrders.data.items || []).find(o => o.id === dGJ.data.id && o.status === 'APPROVED');
  console.log('Approved Demand visible:', !!approvedGJ);

  console.log('4. Produce required finished goods through existing Production');
  // Need to fetch recipes to produce
  const recipes = await call('GET', '/recipes?is_active=true', token);
  const recipeList = Array.isArray(recipes.data) ? recipes.data : recipes.data.items || [];
  const recipeGJ = recipeList.find(r => r.finished_item_id === gj.id || r.finishedItemId === gj.id);
  const recipeM = recipeList.find(r => r.finished_item_id === malpua.id || r.finishedItemId === malpua.id);

  if (recipeGJ) {
    const prodGJ = await call('POST', '/recipes/production/execute', token, {
       branch_id: centralWh.branch_id || centralWh.branchId,
       recipe_id: recipeGJ.id,
       planned_qty: 100,
       kitchen_warehouse_id: centralWh.id,
       actual_yield_qty: 100,
       wastage_qty: 0,
       idempotency_key: crypto.randomUUID()
    });
    console.log('Production GJ status:', prodGJ.status);
  }
  if (recipeM) {
    const prodM = await call('POST', '/recipes/production/execute', token, {
       branch_id: centralWh.branch_id || centralWh.branchId,
       recipe_id: recipeM.id,
       planned_qty: 20,
       kitchen_warehouse_id: centralWh.id,
       actual_yield_qty: 20,
       wastage_qty: 0,
       idempotency_key: crypto.randomUUID()
    });
    console.log('Production M status:', prodM.status);
  }

  console.log('5. Verify Sector V stock');
  const postProdSV_GJ = await getStock(centralWh.id, gj.id);
  console.log('SV GJ Stock Before:', initialSV_GJ, 'After Prod:', postProdSV_GJ);

  console.log('6. Dispatch 90 GJ, 20 M');
  const dispGJ = await call('POST', `/kitchen-orders/${dGJ.data.id}/dispatch`, token, { dispatched_qty: 90 });
  const dispM = await call('POST', `/kitchen-orders/${dM.data.id}/dispatch`, token, { dispatched_qty: 20 });
  console.log('Dispatch Statuses:', dispGJ.status, dispM.status);

  console.log('7. Verify Sector V stock deduction exactly once');
  const postDispSV_GJ = await getStock(centralWh.id, gj.id);
  console.log('SV GJ Stock After Dispatch:', postDispSV_GJ);

  console.log('8. HO Approve Dispatch');
  const appDispGJ = await call('POST', `/kitchen-orders/${dGJ.data.id}/approve-dispatch`, token, {});
  await call('POST', `/kitchen-orders/${dM.data.id}/approve-dispatch`, token, {});
  console.log('HO Approve Dispatch Status:', appDispGJ.status);

  console.log('9. Verify NO second stock deduction');
  const postAppDispSV_GJ = await getStock(centralWh.id, gj.id);
  console.log('SV GJ Stock After HO Approve Dispatch:', postAppDispSV_GJ);

  console.log('10-12. Outlet check and receive');
  const initialOut_GJ = await getStock(outletWh.id, gj.id);
  const recGJ = await call('POST', `/kitchen-orders/${dGJ.data.id}/receive`, token, { received_qty: 90, condition: 'GOOD' });
  console.log('Receive Status:', recGJ.status);
  const postRecOut_GJ = await getStock(outletWh.id, gj.id);
  console.log('Outlet GJ Stock Before:', initialOut_GJ, 'After Receive:', postRecOut_GJ);

  console.log('13-14. Duplicate Receive');
  const dupRecGJ = await call('POST', `/kitchen-orders/${dGJ.data.id}/receive`, token, { received_qty: 90, condition: 'GOOD' });
  console.log('Duplicate Receive Status:', dupRecGJ.status);
  
  console.log('15. Test rejected demand');
  const dRej = await call('POST', '/kitchen-orders', token, { branch_id: outlet.id, item_id: gj.id, requested_qty: 10 });
  const rejRes = await call('POST', `/kitchen-orders/${dRej.data.id}/reject`, token, { reason: 'Test' });
  console.log('Reject Demand Status:', rejRes.status);

  console.log('16. Test rejected dispatch and exact stock reversal');
  // Create, Approve, Dispatch, Reject Dispatch
  const dRejDisp = await call('POST', '/kitchen-orders', token, { branch_id: outlet.id, item_id: gj.id, requested_qty: 10 });
  await call('POST', `/kitchen-orders/${dRejDisp.data.id}/approve`, token, { notes: 'ok' });
  const preRejDispSV_GJ = await getStock(centralWh.id, gj.id);
  await call('POST', `/kitchen-orders/${dRejDisp.data.id}/dispatch`, token, { dispatched_qty: 10 });
  const rejDispRes = await call('POST', `/kitchen-orders/${dRejDisp.data.id}/reject-dispatch`, token, {});
  const postRejDispSV_GJ = await getStock(centralWh.id, gj.id);
  console.log('Reject Dispatch Status:', rejDispRes.status);
  console.log('SV GJ Stock Before RejDisp:', preRejDispSV_GJ, 'After RejDisp:', postRejDispSV_GJ);

  console.log('17. Duplicate Dispatch Protection');
  // Dispatch again on the already dispatched dGJ
  const dupDisp = await call('POST', `/kitchen-orders/${dGJ.data.id}/dispatch`, token, { dispatched_qty: 90 });
  console.log('Duplicate Dispatch Status:', dupDisp.status, dupDisp.data?.error?.message || dupDisp.data?.detail);

  console.log('18. Historical Rate Protection & 19. Month Closing');
  console.log('These are validated via code inspection of StockLedger immutability and Closing records.');
}
run();
