"""Runtime Part 31 acceptance tests.

Only runs with an explicitly approved non-production DB target. No seed/reset is
performed here. Tests are intentionally read-only at the API boundary.
"""
import os
import pytest

pytestmark = pytest.mark.skipif(
    os.environ.get("PART31_ALLOW_DB_TESTS") != "1" or not os.environ.get("DATABASE_URL"),
    reason="Runtime E2E requires an explicitly approved non-production DATABASE_URL",
)


def test_runtime_e2e_gate_is_explicit():
    assert os.environ.get("ENVIRONMENT", os.environ.get("NODE_ENV", "development")).lower() != "production"
    assert os.environ.get("DATABASE_URL")
