# PART 2 — Orders Frontend

Implemented the Orders frontend on top of the existing project.

## Added
- Zomato / Swiggy / Manual order source selector
- New Order modal/workspace
- Live menu loading from `/orders/menu`
- Menu search
- Cart with quantity +/- and remove
- Customer name/phone
- External order ID validation for Zomato/Swiggy
- Guest count and notes
- Automatic subtotal + tax + total preview
- Order creation using existing `/orders` API
- Order number displayed after creation
- Order history search
- Source filtering
- Status filtering
- Real-time stats refresh
- Complete order action using configured outlet warehouse
- Safe blocking when no warehouse is configured
- Loading, error and success feedback
- Mobile-first responsive layout

## Existing code preserved
No existing backend order logic was removed. The existing Orders API is reused.

## Verification note
The repository does not include installed frontend dependencies. `npm ci` could not complete within the execution window, so a production Next.js build could not be completed in this environment. The ZIP contains source changes only; run `npm ci && npm run build` locally before deployment.
