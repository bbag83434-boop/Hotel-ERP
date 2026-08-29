#!/usr/bin/env node
// This project uses FastAPI + Alembic, not Prisma.
// Keep this command as a safe informational bridge instead of pretending
// that a Prisma operation was executed successfully.
const args = process.argv.slice(2);
console.log('[APEX ERP] Prisma is not used. Database migrations are managed by Alembic.');
if (args.length) console.log(`[APEX ERP] Received command: prisma ${args.join(' ')}`);
process.exitCode = 0;
