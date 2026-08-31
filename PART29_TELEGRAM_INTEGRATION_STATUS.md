# PART 29 — Telegram Integration

Implemented on the cumulative Part 1–28 codebase. Existing functionality was preserved and the previous Telegram Notification Center was extended into the Part 29 integration layer.

## Implemented
- Server-side Telegram Bot API integration; bot token remains backend-only.
- Non-blocking outbound notification queue using FastAPI background delivery.
- Retry is queued instead of blocking the API request.
- Notification history, status, attempts and audit trail preserved.
- Idempotency support preserved for queued notifications.
- Secure inbound Telegram webhook using `X-Telegram-Bot-Api-Secret-Token`.
- Persistent Telegram chat → ERP user mapping.
- Optional outlet assignment for each Telegram link; outlet Q&A is restricted to that assigned outlet.
- Head Office-only management of Telegram chat links.
- Webhook configure/remove endpoints with HTTPS enforcement and minimum secret length.
- Optional server-side chat allowlist.
- Telegram `/start`, `/help`, `/stock`, `/lowstock`, `/order`, `/pending`, `/tomorrow` commands.
- Natural-language inventory/purchase questions are routed to the existing deterministic Smart Requirement assistant; no new arithmetic or destructive AI action was introduced.
- Unlinked or unauthorized Telegram chats are ignored.
- Webhook replies are sent as background work so inbound requests return quickly.
- Frontend Telegram Integration workspace for status, webhook configuration, chat linking, notifications and retry history.
- Database migration `004_telegram_integration.py` for `telegram_user_links`.

## Security boundary
- Telegram cannot approve purchases, mutate stock, create POs, or bypass ERP RBAC.
- Chat access requires a persistent ERP user link.
- Outlet-specific questions require an outlet assignment on the link.
- Webhook requests without the configured secret are rejected.
- Existing ERP audit logging is retained for link/unlink, webhook configuration and notification operations.

## Configuration
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_DEFAULT_CHAT_ID` (optional)
- `TELEGRAM_TIMEOUT_SECONDS`
- `TELEGRAM_WEBHOOK_SECRET` (required for inbound webhook; minimum 16 characters)
- `TELEGRAM_WEBHOOK_PUBLIC_URL` (optional default public URL)
- `TELEGRAM_ALLOWED_CHAT_IDS` (optional comma-separated allowlist)

## Verification
- Python compile check passed after Part 29 changes.
- Alembic migration file syntax checked.
- Frontend source updated using the existing design system.
- Full production frontend build requires installed frontend dependencies and configured environment/database.

## Next Part
PART 30 — WhatsApp Business Integration.
