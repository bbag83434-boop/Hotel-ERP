const { Client } = require('pg');

const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
});

async function inspectData() {
    await client.connect();
    const res = await client.query(`
        SELECT email, username, "firstName", "lastName" FROM users ORDER BY "createdAt" ASC LIMIT 50;
    `);
    console.table(res.rows);

    await client.end();
}

inspectData().catch(console.error);
