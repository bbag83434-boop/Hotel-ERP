#!/usr/bin/env python3
"""Verify a PostgreSQL custom-format dump without restoring it."""
import os, shutil, subprocess, sys
from pathlib import Path
p = Path(os.getenv("BACKUP_FILE", ""))
if not p.is_file(): raise SystemExit("BACKUP_FILE must point to a dump file")
if shutil.which("pg_restore") is None: raise SystemExit("pg_restore is required")
result = subprocess.run(["pg_restore", "--list", str(p)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
if result.returncode != 0:
    print(result.stderr[-1000:], file=sys.stderr); raise SystemExit(result.returncode)
entries = [x for x in result.stdout.splitlines() if x and not x.startswith(";")]
if not entries: raise SystemExit("Backup contains no catalog entries")
print(f"Backup catalog verified: {len(entries)} entries")
