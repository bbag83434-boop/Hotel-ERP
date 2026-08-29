# PART 31 — End-to-End Testing

## Scope
Part 31 is the quality/release gate for the cumulative Part 1–30 system. It does not add business features.

## Added
- `backend/test_part31_e2e_contract.py` — environment-safe contract/static acceptance checks.
- `backend/test_part31_runtime.py` — explicit runtime E2E gate.
- `backend/run_part31_e2e.py` — guarded runtime test runner.
- This status document records the release-gate state.

## Acceptance coverage
The Part 31 gate covers the required full-stack acceptance dimensions:
- backend business logic exists and parses
- API surface exists
- frontend built artifact exists
- webhook security contracts are present
- outlet/security-sensitive integrations remain in the cumulative codebase
- no production secrets are committed in `.env.example`
- runtime E2E requires an explicitly approved non-production database
- production test execution is refused
- no seed/reset command is executed by the Part 31 runner

## Runtime test status
**BLOCKED in this packaging environment.**

The full existing pytest suite cannot be collected here because the runtime environment has no valid `DATABASE_URL` and the package environment is missing `bcrypt`. A runtime database and the declared Python dependencies are required for true API/database end-to-end execution.

This is intentionally not marked as a fake `COMPLETED` result. The source ZIP is prepared for the real test environment.

## Required command in a non-production test environment

```bash
cd backend
export ENVIRONMENT=testing
export DATABASE_URL='postgresql://<NON_PRODUCTION_DATABASE>'
export PART31_ALLOW_DB_TESTS=1
python run_part31_e2e.py
```

Do not point this runner at production. No automatic deployment, migration, seed, reset, push, or merge is performed by Part 31.

## Next Part
PART 32 — Security Hardening.
