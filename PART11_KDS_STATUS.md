# Part 11 — Kitchen Display System (KDS)

Added a live KDS workspace using the existing RestaurantOrder and OrderItem tables.

- KDS queue endpoint scoped by company/outlet
- Order status transitions: OPEN -> SENT_TO_KITCHEN -> IN_PREPARATION -> READY -> SERVED
- Cancellation from active kitchen states
- Item status synchronization with order KDS state
- AuditLog for KDS status changes
- Mobile/desktop KDS workspace
- 15-second polling refresh
- No new database tables or fake data
- Existing Orders/POS and stock deduction workflow preserved
