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
  console.log('--- STARTING E2E TEST ---');
  const login = await call('POST', '/auth/login', null, { email: 'bbag83434@gmail.com', password: 'admin123' });
  const token = login.data.access_token;
  if (!token) return console.error('Login failed', login.data);
  
  // 1. Get branches
  const branches = await call('GET', '/organization/branches', token);
  if (!Array.isArray(branches.data)) return console.log('Could not get branches', branches);
  
  const outlet = branches.data.find(b => b.name.includes('EMBypass')) || branches.data[1];
  const sectorV = branches.data.find(b => b.name.includes('Salt Lake')) || branches.data[0];
  console.log(`Outlet: ${outlet.name}, SectorV: ${sectorV.name}`);
  
  // Get items
  const items = await call('GET', '/kitchen-orders/available-items', token);
  const gj = items.data.find(i => i.name.includes('Gulab Jamun'));
  const mal = items.data.find(i => i.name.includes('Malpua'));
  console.log(`Items: GJ=${gj?.id} MAL=${mal?.id}`);
  
  if(!gj || !mal) return console.log('Items missing, aborting.');
  
  // 1. DEMAND
  console.log('\\n1. CREATING DEMAND');
  const d1 = await call('POST', '/kitchen-orders', token, { branch_id: outlet.id, item_id: gj.id, requested_qty: 100 });
  const d2 = await call('POST', '/kitchen-orders', token, { branch_id: outlet.id, item_id: mal.id, requested_qty: 20 });
  console.log(`Demand 1: ${d1.status}, ID: ${d1.data.id}`);
  console.log(`Demand 2: ${d2.status}, ID: ${d2.data.id}`);
  
  // 2. HO APPROVAL
  console.log('\\n2. HO APPROVAL');
  const a1 = await call('POST', `/kitchen-orders/${d1.data.id}/approve`, token, { notes: 'ok' });
  const a2 = await call('POST', `/kitchen-orders/${d2.data.id}/approve`, token, { notes: 'ok' });
  console.log(`Approve 1: ${a1.status} - ${a1.data.status}`);
  console.log(`Approve 2: ${a2.status} - ${a2.data.status}`);
  
  // 3. SECTOR V DEMAND VISIBILITY
  console.log('\\n3. SECTOR V DEMAND');
  const activeOrders = await call('GET', '/kitchen-orders?status=APPROVED', token);
  const found = activeOrders.data.items?.filter(i => i.id === d1.data.id || i.id === d2.data.id);
  console.log(`Visible in Sector V list: ${found?.length === 2}`);
  
  // 4. PRODUCTION (skipping direct production execution since it's separate, but we check if we can dispatch)
  console.log('\\n4. PRODUCTION');
  // we assume stock is sufficient or we can dispatch directly if stock checking is loose. 
  // Let's just do dispatch and see if it fails due to stock.
  
  // 5. DISPATCH
  console.log('\\n5. DISPATCH');
  const disp1 = await call('POST', `/kitchen-orders/${d1.data.id}/dispatch`, token, { dispatched_qty: 90 });
  const disp2 = await call('POST', `/kitchen-orders/${d2.data.id}/dispatch`, token, { dispatched_qty: 20 });
  console.log(`Dispatch 1: ${disp1.status} - `, disp1.status === 200 ? disp1.data.status : disp1.data);
  console.log(`Dispatch 2: ${disp2.status} - `, disp2.status === 200 ? disp2.data.status : disp2.data);
  
  if (disp1.status !== 200 && disp1.data.detail?.includes('Insufficient stock')) {
     console.log('Stock insufficient, we need to produce first.');
     // Call production endpoint
     // Wait, production execution API is /recipes/production/execute
     // We need the recipe for GJ and Malpua
     // But let's check what happened first.
  } else if (disp1.status === 200) {
      // 7. HO DISPATCH APPROVAL
      console.log('\\n7. HO DISPATCH APPROVAL');
      const da1 = await call('POST', `/kitchen-orders/${d1.data.id}/approve-dispatch`, token, {});
      console.log(`Dispatch Approve 1: ${da1.status} - ${da1.data.status}`);
      
      // 8. OUTLET RECEIVE
      console.log('\\n8. OUTLET RECEIVE');
      const r1 = await call('POST', `/kitchen-orders/${d1.data.id}/receive`, token, { accepted_qty: 90 });
      console.log(`Receive 1: ${r1.status} - ${r1.data.status}`);
      
      // 9. DUPLICATE RECEIVE
      console.log('\\n9. DUPLICATE RECEIVE');
      const r1dup = await call('POST', `/kitchen-orders/${d1.data.id}/receive`, token, { accepted_qty: 90 });
      console.log(`Duplicate Receive 1: ${r1dup.status} - `, r1dup.data);
  }
}
run();
