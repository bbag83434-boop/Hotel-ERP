# PART 25 — Telegram Notification Center

Implemented on top of Part 24 FIXED.

- Telegram Bot API integration (server-side token)
- Notification persistence/history
- Pending/Sent/Failed status
- Retry failed notifications
- Idempotency key support
- Admin notification workspace
- Test/send endpoint
- Company and outlet scope checks
- Audit logging
- Scheduled report delivery can use the same notification service in follow-up integrations
- WhatsApp is not used by this Part
- No fake business data or fake delivery confirmation

Configuration:
TELEGRAM_BOT_TOKEN
TELEGRAM_DEFAULT_CHAT_ID (optional default destination)
TELEGRAM_TIMEOUT_SECONDS
