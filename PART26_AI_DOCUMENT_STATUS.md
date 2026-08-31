# PART 26 — AI Invoice / Document Processing

Implemented on Part 25 cumulative base.

## Scope
- Supplier invoice PDF/JPG/PNG/TXT upload with magic-byte validation and 10 MB limit.
- SHA-256 duplicate detection per company.
- Secure server-side storage under `uploads/ai-documents`.
- Text extraction: PDF via optional `pypdf`; images via optional Pillow + Tesseract OCR; TXT directly.
- Deterministic fallback extraction for invoice number/date/GST/total.
- Optional AI extraction through the existing Part 23 provider abstraction.
- Strict JSON extraction prompt; unknown fields remain null rather than invented.
- Review-required state when text/OCR or AI extraction is unavailable/invalid.
- Document history endpoint.
- Company and outlet scope checks.
- Audit-compatible architecture; no automatic bill posting.
- Frontend AI Invoice Processing workspace with upload, result and history.

## Safety boundary
This Part does not create or approve supplier bills automatically. Extracted values are review data only and must continue through the existing procurement/billing workflow.

## Verification
- Python `compileall` passed.
- AST validation passed for new Python modules.
- Full Next.js build not run because `frontend/node_modules` is not included in the source archive.
- Real OCR/AI provider delivery requires the corresponding runtime packages/API credentials.
