# PART 30 — WhatsApp Business Integration

Implemented on the cumulative Part 1–29 codebase. Existing Telegram and ERP functionality is preserved.

## Implemented
- Production-oriented Meta WhatsApp Cloud API integration; no unofficial WhatsApp automation.
- Server-side access token and app secret configuration; secrets are never exposed to frontend.
- HTTPS webhook verification endpoint using Meta `hub.verify_token` challenge.
- HMAC `X-Hub-Signature-256` validation for inbound webhook POST requests.
- Persistent WhatsApp user → ERP user mapping with optional outlet assignment.
- Head Office-only link/unlink management.
- Strict company and outlet authorization for linked users.
- Duplicate inbound message protection using the Meta message ID.
- Inbound message audit/log table.
- Background outbound reply delivery so webhook processing is not blocked by the provider API.
- Controlled commands: `/stock`, `/lowstock`, `/purchase`, `/help`.
- Read-only ERP query boundary; WhatsApp cannot approve purchases, mutate stock, create POs, or bypass RBAC.
- Frontend WhatsApp Business Integration workspace with API/webhook/signature/link status.
- Alembic migration `005_whatsapp_business_integration.py`.

## Configuration
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_WEBHOOK_PUBLIC_URL`
- `WHATSAPP_GRAPH_API_VERSION`
- `WHATSAPP_TIMEOUT_SECONDS`

## Production setup boundary
Meta Business Manager / WhatsApp Business Account / phone-number registration and provider-side webhook subscription require the company's own Meta credentials and cannot be completed inside the source ZIP without those credentials.

## Verification
- Python compile check passed.
- Migration syntax/import check passed.
- Frontend TypeScript source updated using the existing design system.
- Full production frontend build requires installed dependencies and configured environment/database.

## Next Part
PART 31 — End-to-End Testing.
