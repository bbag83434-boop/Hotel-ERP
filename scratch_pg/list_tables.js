const { Client } = require('pg');

const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
});

async function run() {
    await client.connect();
    const res = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
    `);
    res.rows.forEach(r => console.log(r.table_name));
    await client.end();
}

run().catch(console.error);
