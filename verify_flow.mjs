const API = 'https://hotel-erp-muv8.onrender.com/api/v1';
const EMAIL = 'bbag83434@gmail.com';
const PASS = 'admin123';

async function call(method, path, token, body) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, {
    method, headers: h, body: body ? JSON.stringify(body) : undefined,
  });
  let data; try { data = await r.json(); } catch { data = await r.text(); }
  return { ok: r.ok, status: r.status, data };
}

(async () => {
  const login = await call('POST', '/auth/login', null, { email: EMAIL, password: PASS });
  if (!login.ok) { console.error('Login failed'); process.exit(1); }
  const token = login.data.access_token;
  console.log('1. Login OK');

  const branches = await call('GET', '/branches', token);
  const outlet = branches.data.items?.find(b => b.type === 'OUTLET');
  console.log('2. Outlet:', outlet?.name, outlet?.id);

  const items = await call('GET', '/kitchen-orders/available-items', token);
  const gj = items.data?.find(x => x.code === 'FG-GULAB-JAMUN-01');
  console.log('3. GJ Item:', !!gj, gj?.id);

  if (!outlet || !gj) return;

  // Create demand
  const orderRes = await call('POST', '/kitchen-orders', token, {
    branch_id: outlet.id,
    item_id: gj.id,
    requested_qty: 10
  });
  console.log('4. Demand Creation:', orderRes.status, orderRes.data?.order_number);

  if (!orderRes.ok) return;
  const orderId = orderRes.data.id;

  // Approve demand
  const approveRes = await call('POST', `/kitchen-orders/${orderId}/approve`, token, {});
  console.log('5. HO Approval:', approveRes.status);

  // Sector V visibility
  const orders = await call('GET', '/kitchen-orders?status=APPROVED', token);
  const found = orders.data?.find(o => o.id === orderId);
  console.log('6. Sector V visibility (APPROVED):', !!found);
  
  // Production
  // Need CK config for warehouse
  const configRes = await call('GET', '/recipes/production/central-kitchen/config', token);
  console.log('7. CK config:', configRes.status, configRes.data?.warehouse_name);
  
  if (configRes.ok && configRes.data.warehouse_id) {
    const ckBranchId = configRes.data.branch_id;
    const ckWarehouseId = configRes.data.warehouse_id;

    // Get recipe for GJ
    const recipes = await call('GET', '/recipes?is_active=true', token);
    const gjRecipe = recipes.data?.items?.find(r => r.finished_item_id === gj.id || r.finishedItemId === gj.id);
    console.log('8. GJ Recipe found:', !!gjRecipe, gjRecipe?.id);

    if (gjRecipe) {
        const prodRes = await call('POST', '/recipes/production/execute', token, {
          branch_id: ckBranchId,
          recipe_id: gjRecipe.id,
          planned_qty: 20,
          kitchen_warehouse_id: ckWarehouseId,
          actual_yield_qty: 20,
          wastage_qty: 0
        });
        console.log('9. Continuous production execute:', prodRes.status);
        
        // Stock balance check
        const stk = await call('GET', `/inventory/stock-balances?warehouse_id=${ckWarehouseId}`, token);
        const gjStock = stk.data?.items?.find(s => s.item_id === gj.id);
        console.log('10. Sector V stock for GJ:', gjStock?.quantity);
    }
  }

  // Dispatch
  const dispatchRes = await call('POST', `/kitchen-orders/${orderId}/dispatch`, token, {
    dispatched_qty: 10
  });
  console.log('11. Dispatch:', dispatchRes.status);

  // HO Dispatch approval
  const approveDispatchRes = await call('POST', `/kitchen-orders/${orderId}/approve-dispatch`, token, {});
  console.log('12. HO dispatch approval:', approveDispatchRes.status);

  // Outlet Receive
  const receiveRes = await call('POST', `/kitchen-orders/${orderId}/receive`, token, {
    accepted_qty: 10
  });
  console.log('13. Outlet receiving:', receiveRes.status);

  // Stock check Outlet
  const outStk = await call('GET', `/inventory/stock-balances?warehouse_id=${outlet.default_warehouse_id}`, token);
  const outGjStock = outStk.data?.items?.find(s => s.item_id === gj.id);
  console.log('14. Outlet stock for GJ:', outGjStock?.quantity);

})();
