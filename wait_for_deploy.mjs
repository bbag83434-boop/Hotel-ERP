const API = 'https://hotel-erp-muv8.onrender.com/api/v1';
const delay = ms => new Promise(res => setTimeout(res, ms));

async function call(method, path, token) {
  const opts = { method, headers: {} };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  try {
    const res = await fetch(API + path, opts);
    return res.status;
  } catch (e) {
    return 0;
  }
}

async function run() {
  let token = null;
  
  for(let i=0; i<30; i++) {
     if (!token) {
        const login = await fetch(API + '/auth/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email: 'bbag83434@gmail.com', password: 'admin123' })
        }).then(r=>r.json()).catch(()=>({}));
        token = login.access_token;
     }

     if (token) {
         console.log('Pinging...', i);
         const status = await call('GET', '/food-cost/admin/config', token);
         console.log('Status:', status);
         if (status === 200 || status === 403 || status === 401 || status === 500) {
             if (status !== 404) {
                 console.log('Deployment is LIVE!');
                 return;
             }
         }
     } else {
         console.log('Waiting for API to be up to login...');
     }
     await delay(10000);
  }
}
run();
