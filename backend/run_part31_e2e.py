"""Run Part 31 runtime acceptance tests safely.

Usage:
  DATABASE_URL='postgresql://<non-production-db>' python run_part31_e2e.py

The runner refuses production environments and does not seed/reset data.
"""
from __future__ import annotations
import os
import subprocess
import sys


def main() -> int:
    env = os.environ.copy()
    environment = env.get("ENVIRONMENT", env.get("NODE_ENV", "development")).lower()
    database_url = env.get("DATABASE_URL", "").strip()

    if environment == "production":
        print("BLOCKED: Part 31 test runner refuses ENVIRONMENT=production")
        return 2
    if not database_url:
        print("BLOCKED: DATABASE_URL is required for runtime E2E tests")
        return 2
    if any(token in database_url.lower() for token in ("localhost", "127.0.0.1")):
        print("INFO: local database detected; runtime tests may be destructive if a test is misconfigured")
    if os.environ.get("PART31_ALLOW_DB_TESTS") != "1":
        print("BLOCKED: set PART31_ALLOW_DB_TESTS=1 after reviewing the non-production database target")
        return 2

    cmd = [sys.executable, "-m", "pytest", "-q", "test_part31_runtime.py"]
    return subprocess.call(cmd, env=env)


if __name__ == "__main__":
    raise SystemExit(main())
