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
  
  const dRes = await fetch(API + '/kitchen-orders', {
    method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
    body: JSON.stringify({ branch_id: outlet.id, item_id: gj.id, requested_qty: 10 })
  });
  const demand = await dRes.json();
  
  const rRes = await fetch(API + `/kitchen-orders/${demand.id}/reject`, {
    method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
    body: JSON.stringify({ reason: 'Not available' })
  });
  console.log('Reject status:', rRes.status, await rRes.text());
}
run();
