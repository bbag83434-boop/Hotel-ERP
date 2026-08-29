# Part 35 — Backup / Recovery Runbook

## Backup
Use a secure host with PostgreSQL client tools installed:

```bash
DATABASE_URL="$DATABASE_URL" BACKUP_DIR="./backups" python backend/scripts/backup_database.py
```

The script creates a PostgreSQL custom-format dump, never prints credentials, and verifies that the file exists and is non-trivial.

## Verify

```bash
BACKUP_FILE="./backups/hotel_erp_YYYYMMDDTHHMMSSZ.dump" python backend/scripts/verify_backup.py
```

## Recovery
1. Confirm the target database is a **non-production restore target**.
2. Take a fresh backup of the current target before any restore.
3. Verify the dump with `verify_backup.py`.
4. Restore using PostgreSQL `pg_restore` with credentials supplied through the environment, never committed to Git.
5. Run Alembic migrations only after confirming the application version expected by the backup.
6. Run Part 31 acceptance tests against the restored non-production database.
7. Verify authentication, outlet isolation, purchase/stock integrity, financial controls, and webhook security.
8. Promote only after explicit release approval.

## Monitoring
Monitor these signals:
- `/api/v1/health` availability
- database connectivity and latency
- HTTP 5xx rate
- process memory/CPU
- backup job success/failure
- backup age / last successful backup
- external Telegram/WhatsApp delivery failures

Never put production credentials or database dumps in the repository. Never use a restore/reset command against production as part of routine testing.
