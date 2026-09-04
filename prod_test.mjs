const API = 'https://hotel-erp-muv8.onrender.com/api/v1';

async function run() {
  const login = await fetch(API + '/auth/login', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'bbag83434@gmail.com', password: 'admin123'})
  }).then(r => r.json());
  const token = login.access_token;
  
  const items = await fetch(API + '/kitchen-orders/available-items', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json());
  const gj = items.find(i => i.name.includes('Gulab Jamun'));
  
  const branches = await fetch(API + '/organization/branches', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json());
  const sectorV = branches.find(b => b.name.includes('Salt Lake')) || branches[0];
  
  const prodRes = await fetch(API + '/recipes/production/execute', {
    method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
    body: JSON.stringify({
      item_id: gj.id,
      production_qty: 10,
      branch_id: sectorV.id
    })
  });
  console.log('Production status:', prodRes.status, await prodRes.text());
}
run();
