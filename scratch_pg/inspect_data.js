const { Client } = require('pg');

const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
});

async function inspectData() {
    await client.connect();
    const res = await client.query(`
        SELECT * FROM users LIMIT 10;
    `);
    console.log('USERS:');
    console.table(res.rows);

    await client.end();
}

inspectData().catch(console.error);
