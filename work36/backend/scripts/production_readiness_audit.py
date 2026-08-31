#!/usr/bin/env python3
"""Offline production-readiness audit for Hotel ERP Parts 1-36.

This audit is non-destructive. It never connects to a database, deploys, migrates,
seeds, resets, or calls external providers. Live release checks remain explicit.
"""
from __future__ import annotations
import ast, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
required = [
    "backend/app/main.py",
    "backend/app/api/v1/api.py",
    "backend/app/core/security_hardening.py",
    "backend/scripts/backup_database.py",
    "backend/scripts/verify_backup.py",
    "backend/run_part31_e2e.py",
    "backend/test_part31_e2e_contract.py",
    "backend/test_part31_runtime.py",
    "ops/BACKUP_RECOVERY_RUNBOOK.md",
    "DEPLOYMENT.md",
    "render.yaml",
    "frontend/package.json",
    "frontend/out/index.html",
    "frontend/out/manifest.json",
]
for rel in required:
    if not (ROOT / rel).exists():
        raise SystemExit(f"FAIL missing: {rel}")

for p in BACKEND.rglob("*.py"):
    if "__pycache__" in p.parts:
        continue
    ast.parse(p.read_text(encoding="utf-8"), filename=str(p))

pkg = json.loads((FRONTEND / "package.json").read_text(encoding="utf-8"))
assert pkg.get("scripts", {}).get("build"), "frontend build script missing"
assert pkg.get("dependencies", {}).get("next"), "Next.js dependency missing"

for env in ROOT.rglob(".env.example"):
    text = env.read_text(encoding="utf-8", errors="ignore")
    for bad in ("npg_cpeaL38QnrCF", "neondb_owner", "WHATSAPP_ACCESS_TOKEN=sk-", "TELEGRAM_BOT_TOKEN=123"):
        if bad in text:
            raise SystemExit(f"FAIL concrete secret marker in {env}")

render = (ROOT / "render.yaml").read_text(encoding="utf-8")
assert "healthCheckPath: /api/v1/health" in render
assert "healthCheckPath: /" in render
assert "BACKEND_CORS_ORIGINS" in render

status_files = list(ROOT.glob("PART*_STATUS.md"))
for n in (27, 28, 29, 30, 31, 32, 33, 34, 35, 36):
    if not any(p.name.startswith(f"PART{n}_") for p in status_files):
        raise SystemExit(f"FAIL recent status file missing for Part {n}")

print("PART 1-35 offline production-readiness audit: PASS")
print("Part 36 audit artifacts: PASS")
print("Live DB/E2E, backup-restore, external webhooks, and Render deployment require an authorized environment and are NOT executed by this script.")
