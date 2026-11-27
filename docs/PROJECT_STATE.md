# Project state — 2026-11-27

## 1. Stack and scripts

- Node 22.15.0, Fastify 5.12.8, Prisma 7.10.1 with PostgreSQL, Next.js 16.4.6 App Router, Tailwind 4.3.5, shadcn 4.23.0, Vitest 4.1.12 from the root.
- Local development ports: backend 3000, admin 3001, PostgreSQL host 5433.
- Backend npm scripts: `dev`, `build`, `test`, `reconcile`, `db:migrate`, `db:seed`, `db:seed:staff`.
- Admin npm scripts: `dev`, `build`, `start`, `lint`, `test`.

## 2. Git state

- Branch: `feature/online-booking`. Unmerged into this HEAD: `feature/table_UI`, `origin/feature/table_UI`. Base branch: `master`.
- Log has six commits: `76ec1eb UI with Tailwind and shadcn (#1)`, `003eca5 feat: JWT auth with roles`, `4599248 admin UI`, `0b43999 Next.js Admin`, `a5879cd feat: orders-service with idempotency, webhooks, reconciliation`, `466093c scaffold orders-service`.
- Short status before this document, grouped by path prefix. Directory entries represent untracked trees.
- M root: `.env.example`, `README.md`, `docker-compose.yml`, `admin/package.json`, `prisma/schema.prisma`, `scripts/seed-pos.ts`, `src/app.ts`.
- M `admin/src/app/`: `kitchen/board.tsx`, `layout.tsx`, `login/actions.ts`, `login/page.tsx`, `orders/page.tsx`, `page.tsx`, `pos-actions.ts`, `products/page.tsx`, `t/[token]/cart-controls.tsx`, `t/[token]/page.tsx`.
- M `admin/src/`: `lib/api.ts`, `lib/pos-api.ts`, `lib/pos-schema.ts`, `proxy.ts`.
- M `src/routes/`: `kitchen.ts`, `table-orders.ts`, `tables.ts`.
- M `tests/`: `idempotency.test.ts`, `orders.concurrency.test.ts`, `orders.list.test.ts`, `pos.test.ts`, `webhooks.test.ts`.
- ?? `admin/src/app/`: `book/`, `booking-actions.ts`, `booking/`, `menu/`, `my-reservations/`, `order-history.tsx`, `reservations/`, `table-sessions/`.
- ?? `admin/src/lib/`: `booking-api.ts`, `booking-display.ts`, `menu-api.ts`, `menu-price.ts`.
- ?? `admin/tests/landing.test.tsx`, `docs/staging.md`, and the three `20261126` migration directories listed below.
- ?? `src/`: `lib/booking.ts`, `lib/reservation-access.ts`, `routes/reservations.ts`, `routes/staff-menu.ts`, `routes/staff-reservations.ts`, `routes/stock-demo.ts`, `services/dining-sessions.ts`.
- ?? `tests/`: `menu-price.test.ts`, `reservations.test.ts`, `staff-menu.test.ts`, `stock-demo.test.ts`.

## 3. Folder map

- `src/`: Fastify bootstrap. `src/routes/`: HTTP handlers.
- `src/services/`: business logic. `src/schemas/`: validation. `src/lib/`: shared helpers. `src/partner/`: external order client.
- `admin/`: Next.js app and tooling. `admin/src/app/`: routes, actions, and UI. `admin/src/lib/`: auth, API clients, and schemas.
- `prisma/`: data models and SQL migrations. `scripts/`: seed and reconciliation entry points.
- `tests/`, `admin/tests/`: Vitest suites. `fixtures/`: sample partner orders. `docs/`: staging and project notes.
- `generated/`: generated Prisma Client. `dist/`: compiled backend. `node_modules/`: installed dependencies.

## 4. Prisma

- `Product`: name, stock, version. `Order`: status, unique optional idempotency key. `OrderItem`: order/product IDs, quantity.
- `IdempotencyRecord`: key primary key, request fingerprint and response. `WebhookEvent`: event ID primary key, type and processing timestamp.
- `DiningTable`: unique number and QR token, capacity. `DiningSession`: table ID, unique join code/access token, lifecycle timestamps. Partial unique index permits one active session per table.
- `Reservation`: table ID, guest details, party size, start/end, status, unique code. GiST exclusion prevents overlapping confirmed or seated bookings for the same table.
- `MenuItem`: name, minor-unit price, availability. `TableOrder`: table/session IDs, status, version, minor-unit total. Partial unique index permits one open cart per table. Open carts require a session ID.
- `TableOrderItem`: order/menu item IDs, name and unit-price snapshots, quantity, instructions. `StaffUser`: unique username, password hash, role.
- Migrations: `20261124000000_init`, `20261124010000_table_ordering`, `20261124020000_staff_auth`, `20261126000000_reservations`, `20261126010000_cart_version`, `20261126020000_dining_sessions`.

## 5. Backend endpoints

- Stock demo: GET/POST `/products`, GET/POST `/orders` require opt-in, loopback, and API key. Order POST uses idempotency. POST `/webhooks/payments` verifies HMAC signature. Reconciliation is a CLI using partner orders.
- Tables: GET/POST `/tables`, GET `/tables/:id/qr`, GET `/staff/table-sessions`, POST `/staff/table-sessions/:id/reset`, GET `/staff/table-sessions/:id/orders` require API key.
- Kitchen: GET `/kitchen/orders`, GET `/kitchen/stream` (SSE), PATCH `/kitchen/orders/:id/status` require API key.
- Reservations: GET `/availability`, POST `/reservations` (idempotent), POST `/reservations/lookup`, and POST `/reservations/:code/verify` are public and rate-limited. Lookup returns only authorized matches.
- Reservation grants protect GET `/reservations/:code`, GET `/reservations/:code/availability`, PATCH `/reservations/:code/reschedule`, and POST `/reservations/:code/cancel`.
- Staff reservations: GET `/staff/reservations`, PATCH `/staff/reservations/:id/status` require API key.
- Menu and login: GET/POST `/staff/menu`, PATCH `/staff/menu/:id`, POST `/auth/verify` require API key.
- QR ordering: GET `/t/:qrToken` is public and gates session data and order history on authorization. POST `/t/:qrToken/join` validates the rotating join code.
- Cart: POST `/t/:qrToken/order/items`, PATCH `/t/:qrToken/order/items/:itemId`, POST `/t/:qrToken/order/submit` require dining-session authorization. Checkout checks cart ID, version, and idempotency key.

## 6. Authorization

- Next.js enforces staff JWT roles. ADMIN also has menu, QR setup, and enabled stock demo access. KITCHEN has kitchen, reservations, table turnover, and staff session history access.
- HS256 JWT lasts eight hours in an HttpOnly, SameSite=Lax cookie, Secure in production. Logout deletes the cookie. Backend staff routes trust the server-side API key. Keep backend ingress private.
- Permanent table QR plus rotating join code grants a path-scoped HttpOnly dining-session cookie. Server checks the active seating. Reset invalidates old guest access.
- Reservation link plus matching phone can grant persistent, per-booking authorization. Phone lookup filters authorized bookings. HMAC grants last 24 hours and can coexist.
- In-memory limits: login five failures per username/IP per 15 minutes, joins and cart writes 30/minute per table or session, bookings 120/minute/IP, lookup 20/minute/IP, verification 15/IP and 10/code per 15 minutes. Kitchen SSE subscribers are process-local.

## 7. Admin pages and handlers

- Public: `/` landing, `/login` staff login, `/book` booking, `/my-reservations` phone lookup, `/t/[token]` join and session-gated menu/cart/My Orders.
- Guest grant: `/booking/[code]` details, `/booking/[code]/reschedule` date/time, `/booking/[code]/calendar` calendar download.
- Staff: `/kitchen` board, `/kitchen/orders` snapshot, `/kitchen/stream` SSE proxy, `/reservations` bookings, `/table-sessions` turnover, `/table-sessions/[id]/orders` history.
- ADMIN: `/menu` menu management, `/tables` QR cards, `/tables/[id]/qr` SVG, `/products` and `/orders` gated stock demo.

## 8. Implemented and verified

- Stock concurrency, idempotency, signed webhooks, partner client, JWT and staff login: automated coverage. Live partner reconciliation unverified.
- Menu CRUD, availability, and exact THB parsing: automated coverage. Staff menu page opened in browser. Mutation dialogs unverified in browser.
- QR join, shared/versioned checkout, kitchen status, reset and history: automated coverage. Browser exercised checkout and kitchen recovery after a missed ticket. Disposable load check used 48 cart writes, 12 checkout attempts, and three SSE clients.
- Booking, recovery, and rescheduling: automated coverage and desktop/390 px browser checks, including multiple grants and wrong-phone denial. Calendar handler exists.
- My Orders: automated coverage for isolation, snapshots, cancelled totals, and staff history. Browser verified two diners, multiple orders, automatic navigation, visible status updates, and narrow-screen layout.

## 9. Test counts

- Last known run: backend 61 passing tests in 11 files. Admin 6 passing tests in 2 files.
- Backend TypeScript check, admin lint, and admin production build passed. No tests rerun for this summary.

## 10. Open issues and verification gaps

- My Orders scroll moved from 559 to 535 during a live refresh. Scroll stability failed.
- Session-ended message and polling stop remain unverified in the browser. Staff history after reset passed API integration coverage. Staff browser journey remains unverified.
- Forced SSE disconnect logged a stream-pipe error. Recovery worked in the local check. Deployed proxy behavior remains unverified.
- Previous disposable database checks covered fresh migration, upgrade, and backup/restore. Staging ingress/TLS and operational rollback remain unverified.
- QR SVG and mobile layout checked. Physical scanning and print output unverified. Whole-browser restart and production HTTPS cookie behavior unverified.

## 11. Local leftovers and environment names

- QA backend/admin used ports 3042/3043 and a disposable `qa_*` database. Current listener/database inventory could not be verified with available access.
- `db:seed` seeds five tables and ten menu items. `db:seed:staff` seeds `admin` (ADMIN) and `kitchen` (KITCHEN).
- Backend `.env` core: `DATABASE_URL`, `WEBHOOK_SECRET`, `KITCHEN_API_KEY`, `PUBLIC_BASE_URL`. Runtime/optional: `NODE_ENV`, `PORT`, `PARTNER_BASE_URL`, `STOCK_DEMO_ENABLED`, `CART_INACTIVITY_MINUTES`. Staff seed: `STAFF_ADMIN_PASSWORD`, `STAFF_KITCHEN_PASSWORD`.
- Backend booking config: `BOOKING_TZ`, `BOOKING_OPEN`, `BOOKING_CLOSE`, `BOOKING_SLOT_MINUTES`, `BOOKING_DURATION_MINUTES`, `BOOKING_MAX_DAYS_AHEAD`, `BOOKING_MIN_LEAD_MINUTES`, `BOOKING_CANCEL_CUTOFF_MINUTES`, `BOOKING_MAX_PARTY`.
- Admin `.env.local` core: `BACKEND_URL`, `KITCHEN_API_KEY`, `JWT_SECRET`. Optional/shared: `BOOKING_TZ`, `BOOKING_MAX_DAYS_AHEAD`, `BOOKING_MAX_PARTY`, `STOCK_DEMO_ENABLED`, `NODE_ENV`.

## 12. Product decisions

- Shared cart per seating. Cart lines retain the price captured when added. Submitted order lines retain names and prices. Session totals exclude cancelled orders and unsubmitted items.
- Abandoned carts expire after two hours of inactivity by default. Submitted tickets persist. Active kitchen tickets block normal reset. Explicit ADMIN override is audited.
- Rescheduling requires more than 30 minutes before the original booking and sufficient capacity. Table reassignment is atomic. Existing cancellation policy remains, with a default 120-minute cutoff.
- Reservation grants last 24 hours. Staff sessions have no refresh or individual revocation. Rotating the signing secret invalidates existing staff sessions.
- Stock demo is local opt-in and disabled in production. My Orders refreshes active statuses every five seconds while visible.
