# PART 32 — Security Hardening

## Scope
Security hardening of the cumulative Part 1–31 application without changing business workflows.

## Implemented
- Security response headers (`nosniff`, frame denial, referrer policy, permissions policy, cross-origin policies).
- API request payload size guard (12 MB) to reduce oversized-request abuse.
- Process-local rate limiting for login, refresh, Telegram webhook and WhatsApp webhook POST endpoints.
- Production CORS fail-closed rule: wildcard origins are rejected when credentials are enabled.
- Explicit CORS methods/headers instead of `*`.
- Production JWT secret safety check; unsafe/missing production secrets stop startup.
- Development JWT secrets are generated at runtime instead of using committed static defaults.
- Malformed Bearer authorization headers now return an authentication error instead of risking an index/parsing exception.
- Existing outlet-scope, permission and webhook authentication logic preserved.

## Tests
- Python compileall: PASS
- Part 32 security tests: PASS (2/2)
- Part 31 contract tests: PASS (7/7)
- Combined selected tests: PASS (9/9)

## Limitations
- Distributed rate limiting is not claimed. Multiple production workers should also have an edge/proxy rate limit.
- Full live database/API E2E remains dependent on a configured non-production database as documented in Part 31.

## Security notes
- No secrets were added to the repository.
- No production deployment, database migration, seed/reset, push or merge was performed.

## Next Part
PART 33 — Performance / Mobile Optimization.
