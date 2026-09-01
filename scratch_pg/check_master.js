const { Client } = require('pg');

const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
});

async function checkMasterData() {
    await client.connect();
    
    for (let table of ['categories', 'units', 'unit_conversions']) {
        const res = await client.query('SELECT count(*) FROM "' + table + '"');
        console.log(table + " count: " + res.rows[0].count);
    }

    await client.end();
}
checkMasterData().catch(console.error);
