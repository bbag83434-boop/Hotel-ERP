#!/usr/bin/env python3
"""Safe PostgreSQL backup utility for Part 35.
Never deletes production data and never prints DATABASE_URL/passwords.
"""
import os, shutil, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

url = os.getenv("DATABASE_URL", "").strip()
out_dir = Path(os.getenv("BACKUP_DIR", "./backups"))
if not url:
    raise SystemExit("DATABASE_URL is required")
if shutil.which("pg_dump") is None:
    raise SystemExit("pg_dump is required on the backup host")
out_dir.mkdir(parents=True, exist_ok=True)
ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
out = out_dir / f"hotel_erp_{ts}.dump"
cmd = ["pg_dump", "--format=custom", "--no-owner", "--no-acl", "--file", str(out), url]
try:
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
except subprocess.CalledProcessError as exc:
    if out.exists(): out.unlink()
    print("Backup failed:", exc.stderr[-1000:], file=sys.stderr)
    raise SystemExit(1)
if not out.exists() or out.stat().st_size < 1024:
    if out.exists(): out.unlink()
    raise SystemExit("Backup verification failed: dump is missing or unexpectedly small")
print(f"Backup created and size-verified: {out} ({out.stat().st_size} bytes)")
