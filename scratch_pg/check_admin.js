const { Client } = require('pg');

const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
});

async function checkAdmin() {
    await client.connect();
    const res = await client.query('SELECT id, email, "roleId" FROM users WHERE email = $1', ['bbag83434@gmail.com']);
    console.log("Admin user:", res.rows[0]);
    await client.end();
}
checkAdmin().catch(console.error);
