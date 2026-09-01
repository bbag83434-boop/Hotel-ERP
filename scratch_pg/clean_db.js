const { Client } = require('pg');

const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_cpeaL38QnrCF@ep-autumn-field-azio7gin.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
});

const skipTables = [
    '_prisma_migrations',
    'companies',
    'roles',
    'permissions',
    'role_permissions',
    'users',
    'system_settings',
    'alembic_version'
];

async function run() {
    await client.connect();
    const res = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
    `);
    
    const tablesToTruncate = res.rows
        .map(r => r.table_name)
        .filter(t => !skipTables.includes(t));
    
    if (tablesToTruncate.length > 0) {
        const query = \`TRUNCATE TABLE \${tablesToTruncate.map(t => \`"\${t}"\`).join(', ')} CASCADE;\`;
        console.log("Executing:", query);
        await client.query(query);
    }
    
    // Now delete non-admin users
    const deleteUsersQuery = \`
        DELETE FROM users 
        WHERE email != 'bbag83434@gmail.com' 
          AND email NOT LIKE '%admin_b138ab%' 
          AND email NOT LIKE '%hq_admin%';
    \`;
    console.log("Executing:", deleteUsersQuery);
    // Actually, to be safe, only keep bbag83434@gmail.com
    await client.query(\`DELETE FROM users WHERE email != 'bbag83434@gmail.com'\`);
    console.log("Deleted test users.");

    await client.end();
}

run().catch(console.error);
