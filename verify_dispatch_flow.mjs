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
  console.log('--- STARTING VERIFICATION FLOW ---');
  const login = await call('POST', '/auth/login', null, { email: 'bbag83434@gmail.com', password: 'admin123' });
  const token = login.data.access_token;
  
  const branches = await call('GET', '/organization/branches', token);
  const outlet = branches.data.find(b => b.name.includes('EMBypass')) || branches.data[1];
  const sectorV = branches.data.find(b => b.name.includes('Salt Lake')) || branches.data[0];
  
  const items = await call('GET', '/kitchen-orders/available-items', token);
  const gj = items.data.find(i => i.name.includes('Gulab Jamun'));
  
  // Get central warehouse ID from db_check_stock logic or just find it
  const whRes = await call('GET', '/inventory/warehouses', token);
  const whItems = Array.isArray(whRes.data) ? whRes.data : whRes.data.items || [];
  const centralWh = whItems.find(w => w.is_central) || whItems.find(w => w.name.toLowerCase().includes('central'));
  
  // 1. Get Initial Stock
  const stockBeforeRes = await call('GET', `/inventory/stock?warehouse_id=${centralWh.id}`, token);
  const stockBeforeItems = Array.isArray(stockBeforeRes.data) ? stockBeforeRes.data : stockBeforeRes.data.items || [];
  const stockBefore = stockBeforeItems.find(i => i.item_id === gj.id)?.quantity || 0;
  console.log('Stock Before:', stockBefore);
  
  // 2. Create Demand
  const d1 = await call('POST', '/kitchen-orders', token, { branch_id: outlet.id, item_id: gj.id, requested_qty: 100 });
  const demandId = d1.data.id;
  console.log(`Demand Created: ${demandId}`);
  
  // 3. Approve Demand
  await call('POST', `/kitchen-orders/${demandId}/approve`, token, { notes: 'ok' });
  console.log('Demand Approved.');
  
  // 4. Poll Dispatch until Deploy finishes
  let dispatchRes;
  for (let i = 0; i < 20; i++) {
     dispatchRes = await call('POST', `/kitchen-orders/${demandId}/dispatch`, token, { dispatched_qty: 90 });
     if (dispatchRes.status === 200 || dispatchRes.status === 201) {
         console.log('Dispatch Success:', dispatchRes.data.status);
         break;
     } else {
         console.log('Dispatch Failed:', dispatchRes.data);
         if (dispatchRes.data.error?.message?.includes("fully dispatched") || dispatchRes.data.detail?.includes("fully dispatched")) {
             console.log('Waiting for deployment... sleeping 15s');
             await new Promise(r => setTimeout(r, 15000));
         } else {
             break;
         }
     }
  }
  
  // 5. Get Stock After
  const stockAfterRes = await call('GET', `/inventory/stock?warehouse_id=${centralWh.id}`, token);
  const stockAfterItems = Array.isArray(stockAfterRes.data) ? stockAfterRes.data : stockAfterRes.data.items || [];
  const stockAfter = stockAfterItems.find(i => i.item_id === gj.id)?.quantity || 0;
  console.log('Stock After:', stockAfter);
  
  // 6. Duplicate Dispatch Test
  console.log('Testing duplicate dispatch...');
  const dupDispatch = await call('POST', `/kitchen-orders/${demandId}/dispatch`, token, { dispatched_qty: 90 });
  console.log('Duplicate Dispatch Res:', dupDispatch.status, dupDispatch.data);
  
}
run();
