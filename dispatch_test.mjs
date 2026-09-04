
const API = 'https://hotel-erp-muv8.onrender.com/api/v1';

async function run() {
  const login = await fetch(API + '/auth/login', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'bbag83434@gmail.com', password: 'admin123'})
  }).then(r => r.json());
  const token = login.access_token;
  
  const branches = await fetch(API + '/organization/branches', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json());
  const outlet = branches.find(b => b.name.includes('EMBypass')) || branches[1];
  
  const items = await fetch(API + '/kitchen-orders/available-items', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json());
  const gj = items.find(i => i.name.includes('Gulab Jamun'));
  
  // 1. Demand
  const dRes = await fetch(API + '/kitchen-orders', {
    method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
    body: JSON.stringify({ branch_id: outlet.id, item_id: gj.id, requested_qty: 100 })
  });
  const demand = await dRes.json();
  console.log('Demand Created:', demand.id, demand.status);
  
  // 2. Approve
  const aRes = await fetch(API + `/kitchen-orders/${demand.id}/approve`, {
    method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
    body: JSON.stringify({ notes: 'ok' })
  });
  console.log('Approved:', await aRes.json());
  
  // 3. Dispatch
  const dispRes = await fetch(API + `/kitchen-orders/${demand.id}/dispatch`, {
    method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
    body: JSON.stringify({ dispatched_qty: 90 })
  });
  console.log('Dispatch status:', dispRes.status);
  console.log('Dispatch body:', await dispRes.text());
}
run();
