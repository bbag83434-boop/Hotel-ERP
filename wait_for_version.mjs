const API = 'https://hotel-erp-muv8.onrender.com/api/v1';
const delay = ms => new Promise(res => setTimeout(res, ms));

async function run() {
  for(let i=0; i<60; i++) {
     try {
         const res = await fetch(API + '/health').then(r=>r.json());
         console.log(res.data.version, res.data.uptimeSeconds);
         if (res.data.version === '2.0.1-food-cost') {
             console.log('NEW VERSION DEPLOYED!');
             return;
         }
     } catch(e) {
         console.log('Error', e.message);
     }
     await delay(10000);
  }
}
run();
