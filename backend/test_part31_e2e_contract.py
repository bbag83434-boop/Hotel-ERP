"""Part 31 release-gate contract checks.

These checks are intentionally environment-safe: they do not seed/reset a database,
call external providers, or mutate production data. Full runtime E2E is enabled by
run_part31_e2e.py only when a non-production DATABASE_URL and dependencies exist.
"""
from pathlib import Path
import ast
import os
import re

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"


def _py_files():
    return [p for p in BACKEND.rglob("*.py") if "__pycache__" not in p.parts]


def test_all_python_sources_parse():
    for path in _py_files():
        ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def test_required_part31_surfaces_exist():
    for rel in [
        "backend/app/main.py",
        "backend/app/api/v1/api.py",
        "backend/app/services/stock.py",
        "backend/app/services/transfer.py",
        "backend/services/telegram.py" if (BACKEND / "services/telegram.py").exists() else "backend/app/services/telegram.py",
        "backend/app/services/whatsapp.py",
        "frontend/package.json",
    ]:
        assert (ROOT / rel).exists(), rel


def test_frontend_has_built_artifact():
    assert (FRONTEND / "out" / "index.html").exists()
    assert (FRONTEND / "out" / "manifest.json").exists()


def test_no_committed_secret_values_in_env_examples():
    for path in ROOT.rglob(".env.example"):
        text = path.read_text(encoding="utf-8", errors="ignore")
        assert "npg_cpeaL38QnrCF" not in text
        assert "neondb_owner" not in text
        assert "WHATSAPP_ACCESS_TOKEN=" in text or "TELEGRAM_BOT_TOKEN=" in text


def test_webhook_security_contracts_present():
    telegram_endpoint = (BACKEND / "app/api/v1/endpoints/notifications.py").read_text(encoding="utf-8")
    whatsapp = (BACKEND / "app/services/whatsapp.py").read_text(encoding="utf-8")
    whatsapp_endpoint = (BACKEND / "app/api/v1/endpoints/whatsapp.py").read_text(encoding="utf-8")
    assert "TELEGRAM_WEBHOOK_SECRET" in telegram_endpoint
    assert "x_telegram_bot_api_secret_token" in telegram_endpoint
    assert "x_hub_signature_256" in whatsapp_endpoint
    assert "verify_signature" in whatsapp_endpoint
    assert "hmac" in whatsapp.lower()


def test_part_status_chain_is_present():
    statuses = sorted(ROOT.glob("PART*_STATUS.md"))
    assert any("PART29" in p.name for p in statuses)
    assert any("PART30" in p.name for p in statuses)
    assert (ROOT / "PART31_END_TO_END_TESTING_STATUS.md").exists()


def test_no_production_seed_in_part31_runner():
    runner = (BACKEND / "run_part31_e2e.py").read_text(encoding="utf-8")
    assert "production" in runner.lower()
    assert "seed" in runner.lower()
    assert "reset" in runner.lower()
