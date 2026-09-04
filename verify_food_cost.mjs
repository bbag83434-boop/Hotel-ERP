const API = 'https://hotel-erp-muv8.onrender.com/api/v1';

async function call(method, path, token, body = null) {
  const opts = { method, headers: {} };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(API + path, opts);
    const text = await res.text();
    try { return { status: res.status, data: JSON.parse(text) }; } 
    catch(e) { return { status: res.status, data: text }; }
  } catch (e) {
    return { status: 0, data: e.message };
  }
}

async function run() {
  console.log('--- STARTING FOOD COST TEST ---');
  // First, we need an admin login.
  const login = await call('POST', '/auth/login', null, { email: 'bbag83434@gmail.com', password: 'admin123' });
  if (!login.data.access_token) return console.error('Login failed', login.data);
  const adminToken = login.data.access_token;
  console.log('Admin login: OK');

  // Let's create an outlet user if needed, but wait, do we have one?
  // Let's just try to test the endpoint with the admin token.
  
  // 1. Get Admin Config
  let res = await call('GET', '/food-cost/admin/config', adminToken);
  console.log('GET /food-cost/admin/config (Admin):', res.status, res.status === 200 ? 'OK' : 'FAIL');
  
  // 2. Setup config if not setup
  if (res.status === 200 && res.data.costHeads.length === 0) {
      console.log('Setting up config...');
      res = await call('PUT', '/food-cost/admin/config', adminToken, {
          costHeads: [
              { name: 'Manpower', percentage: 5, isActive: true, sortOrder: 1 },
              { name: 'Gas', percentage: 3, isActive: true, sortOrder: 2 }
          ],
          markupOptions: [
              { label: '50%', percentage: 50, isActive: true, sortOrder: 1 },
              { label: '100%', percentage: 100, isActive: true, sortOrder: 2 }
          ]
      });
      console.log('PUT config:', res.status);
  }
  
  // 3. Get items to do a calculation
  const itemsReq = await call('GET', '/inventory/items?limit=5', adminToken);
  if (!itemsReq.data.items || itemsReq.data.items.length === 0) return console.log('No items found to test calculation.');
  const item = itemsReq.data.items[0];
  console.log(`Using item for test: ${item.name} (${item.unit_id})`);
  
  // 4. Calculate Food Cost
  const calcReq = {
      ingredients: [
          {
              itemId: item.id,
              quantity: 1,
              unitId: item.unit_id
          }
      ],
      calculationDate: new Date().toISOString().split('T')[0]
  };
  
  res = await call('POST', '/food-cost/calculate?markup_percentage=50', adminToken, calcReq);
  console.log('Calculate:', res.status, res.status === 200 ? 'OK' : 'FAIL', res.data.totalCost ? `Total Cost: ${res.data.totalCost}` : '');
  
  if (res.status !== 200) {
      console.log('Calculation Error details:', res.data);
  }
  
  // 5. Save Snapshot
  const saveReq = {
      ...calcReq,
      markupPercentage: 50,
      idempotencyKey: 'test-key-' + Date.now()
  };
  res = await call('POST', '/food-cost/save', adminToken, saveReq);
  console.log('Save snapshot:', res.status, res.status === 200 ? 'OK' : 'FAIL');
  
  console.log('--- TEST COMPLETE ---');
}
run();
