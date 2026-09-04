const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  try {
    const userRes = await client.query('SELECT * FROM "users" WHERE email = $1', ['bbag83434@gmail.com']);
    const cid = userRes.rows[0].companyId || userRes.rows[0].company_id;
    const branches = await client.query('SELECT id, name, type FROM organizations WHERE "companyId" = $1 OR company_id = $1', [cid]);
    console.log(branches.rows);
  } catch(e) { console.error(e); }
  client.end();
});
