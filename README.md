# Orders service

A Fastify API for inventory, orders, and signed payment events, backed by PostgreSQL 16 and Prisma 7.

## Run locally

Use Node 22.12+ (22.x) or Node 24+ for local development, along with npm and Docker Compose. The API image runs on Node 20, where npm reports engine warnings for transitive dependencies. Copy `.env.example` to `.env` and set a `WEBHOOK_SECRET` shared with the payment sender. The example database URL matches the Compose credentials and host port 5433.

```sh
npm ci
docker compose up -d --wait
npm run db:migrate
npm run build
npm test
npm run dev
```

The API listens on port 3000 by default. For a compiled start, run `node dist/src/server.js`. The database suites use the real PostgreSQL instance at `DATABASE_URL` and leave their uniquely identified sample records in the database. Use the local development database or a dedicated test database. If host port 5433 is occupied, set `POSTGRES_HOST_PORT` for Compose and use the same port in `DATABASE_URL`.

## Admin app

- The landing page links to guest reservations and staff sign-in. ADMIN staff manage dishes, prices, and availability at `/menu`.
- For the local stock-concurrency demo, set `STOCK_DEMO_ENABLED=true` in backend `.env` and `admin/.env.local`, and set the same `KITCHEN_API_KEY` in both apps. Use `/products` and `/orders` on the local admin. Fastify registers the demo endpoints only outside production, accepts only loopback requests, and requires `X-Kitchen-API-Key`. Keep the backend behind private ingress.

Start PostgreSQL and run `npm run dev` from the repository root using the setup above. In a second terminal, create `admin/.env.local` with `BACKEND_URL=http://localhost:3000`, then run:

```sh
cd admin
npm ci
npm run dev
```

Open [the admin app](http://localhost:3001). For a production build, run `npm run build` in `admin` and serve it with `npm start -- -p 3001`.

The layout and list pages are Server Components. They render the lists and read data through a server-only backend client, which keeps `BACKEND_URL` on the server. The forms are Client Components so `useActionState` can show pending, success, and validation feedback. Server Actions validate submissions and call the backend. The order form submits one line item and generates a fresh idempotency key on the server for each submission.

Both pages share the `GET /products` Data Cache entry, tagged `products` with a 30-second revalidation interval. Successful product creation and order placement expire the tag immediately so inventory changes appear on the next render. `GET /orders` is fetched on every server render, and writes bypass the cache.

## POS table ordering

- Run `npx prisma migrate deploy` and `npm run db:seed` after the local database setup. The seed creates five tables and ten menu items.
- Print permanent QR codes from admin `/tables`. Staff start or reset a seating at `/table-sessions` and give the current join code to diners. Diners join through the same printed QR and share one cart. Only an admin can override active kitchen tickets, and a reason and staff ID are saved. Previous seating tickets stay visible in the kitchen until handled.
- Fastify customer API: `POST /t/:qrToken/join` with `{ code }` issues the session ID and access token. Send `X-Dining-Session` for cart reads and `X-Dining-Session-Id` as well for writes. Add or patch items with the existing order-item routes. Checkout at `POST /t/:qrToken/order/submit` requires `{ cartId, version }` and `Idempotency-Key`. An unchanged retry replays the receipt, while a stale checkout returns `CART_CHANGED` and requires a new confirmation.
- Protected Fastify API: `GET /kitchen/orders`, `PATCH /kitchen/orders/:id/status`, `GET /kitchen/stream`, `GET /tables`, `POST /tables`, `GET /tables/:id/qr`, `GET /staff/table-sessions`, and `POST /staff/table-sessions/:id/reset`. The private Next.js server validates staff roles and supplies the authenticated actor to reset.
- Set the same `KITCHEN_API_KEY` in backend `.env` and `admin/.env.local`. Next.js sends it as `X-Kitchen-API-Key` on the server. Keep `BACKEND_URL` in `admin/.env.local`. Set backend `PUBLIC_BASE_URL` to the admin origin reachable by guest phones. It defaults to `http://localhost:3001`.
- The server stores prices in integer satang and snapshots item names and prices. A partial unique index limits each table to one open cart and one active seating. Open carts close on the next cart access after `CART_INACTIVITY_MINUTES` (default 120). The upgrade closes pre-session open carts and preserves submitted tickets. Start a seating before guests resume ordering.
- **My Orders** shows submitted tickets for the active seating and refreshes their status about every five seconds. Its total excludes cancelled tickets and the open cart. After turnover, staff can still view submitted orders from the table’s **Order history** link.
- SSE sends an active-ticket snapshot first and updates after commits. The kitchen board uses a server-side SSE proxy and polls every five seconds when disconnected.
- Join attempts and authenticated cart writes each have a separate 30-per-minute budget. The limits and SSE event bus are per process. Multiple instances need a shared limiter and Redis pub/sub or PostgreSQL `LISTEN/NOTIFY`. The flow has no payment handling.

## Staff auth

- Set `STAFF_ADMIN_PASSWORD` and `STAFF_KITCHEN_PASSWORD` in the backend `.env`, apply migrations, and run `npm run db:seed:staff` to create or update the `admin` and `kitchen` users.
- Set the same `KITCHEN_API_KEY` in both apps and a random `JWT_SECRET` of at least 32 characters in `admin/.env.local`. Next.js verifies credentials through Fastify and sets an eight-hour HTTP-only session cookie. Use HTTPS in production.
- ADMIN can use all staff pages. KITCHEN can use the kitchen board, its live feed, and reservations. Guest table QR pages are public.
- The login limit is five failed attempts per username and IP in 15 minutes, in memory per instance. Configure the ingress to overwrite `X-Forwarded-For` with the client IP. Sessions have no refresh tokens or early server-side revocation. Rotating the single signing secret invalidates all sessions.

## Online booking

- Guests use `/book` to pick a date, party size, and time. Save the private `/booking/[code]` link to manage the reservation or download a calendar event. The API returns `canCancel` and `cancellationDeadline`. Self-service cancellation is available before that deadline for confirmed bookings. ADMIN and KITCHEN manage bookings at `/reservations`.
- **My Reservations** uses the booking phone number to filter reservations already authorized in the browser. Access is stored per booking for 24 hours, with HTTPS-only cookies in production. On another device, open the saved private link and verify the original phone number. Guests who lose both access and the link should contact the restaurant. Confirmed reservations can move to an available table slot until 30 minutes before their original start. A failed move keeps the original reservation and the cancellation policy still applies.
- Public API: `GET /availability?date=YYYY-MM-DD&partySize=N`, `POST /reservations` with `Idempotency-Key`, `GET /reservations/:code`, and `POST /reservations/:code/cancel`. Staff API: `GET /staff/reservations?date=...` and `PATCH /staff/reservations/:id/status` with `X-Kitchen-API-Key`.
- Set `BOOKING_TZ` (Asia/Bangkok), `BOOKING_OPEN` (10:00), `BOOKING_CLOSE` (22:00), `BOOKING_SLOT_MINUTES` (30), `BOOKING_DURATION_MINUTES` (90), `BOOKING_MAX_DAYS_AHEAD` (30), `BOOKING_MIN_LEAD_MINUTES` (60), `BOOKING_CANCEL_CUTOFF_MINUTES` (120), and `BOOKING_MAX_PARTY` (10) in the backend environment to override defaults. Mirror timezone, max days, and max party in `admin/.env.local` when changing them.
- Availability is computed live. The API tries the smallest suitable tables first and stores timestamps in UTC. A PostgreSQL exclusion constraint prevents overlapping confirmed or seated bookings, and idempotent creation replays the original result. Apply the migration with a database role that can enable `btree_gist`. Re-run `npm run db:seed` to apply sample capacities.
- Single restaurant with no deposits, payments, or email/SMS confirmations. Public booking requests have an in-memory per-IP limit. Configure the ingress to overwrite `X-Forwarded-For` with the client IP.

## API

| Request | Input and result |
| --- | --- |
| `GET /staff/menu`, `POST /staff/menu`, `PATCH /staff/menu/:id` | Staff API protected by `X-Kitchen-API-Key`. Writable fields are `name`, integer `priceMinor` in satang, and boolean `available`. The Next.js menu page and write actions require ADMIN. |
| `POST /products` | Send `{"name":"Widget","stock":10}`. Returns the created product with HTTP 201. |
| `GET /products` | Returns the product list with HTTP 200. |
| `GET /orders` | Returns orders newest first, with their status and items, with HTTP 200. |
| `POST /orders` | Send an `Idempotency-Key` header and `{"items":[{"productId":"<product-id>","quantity":1}]}`. Returns the order with HTTP 201. Supply an optional top-level `id` when the payment sender already knows the order reference. Stock conflicts return 409 and key reuse with different input returns 422. |
| `POST /webhooks/payments` | Send JSON such as `{"eventId":"evt-1","type":"payment.succeeded","orderId":"demo-order"}` and set `X-Signature` to the hex HMAC-SHA256 of the exact request bytes using `WEBHOOK_SECRET`. Accepted events, including duplicates, return 200. A bad signature returns 401. |

Errors have a string `code`, a string `message`, and optional `details`. Request validation failures return 400.

## Reconciliation

Run `npm run reconcile` to print a JSON array of mismatches between PostgreSQL orders and `fixtures/partner-orders.json`. An empty array means both lists agree. The command reports differences without writing to either system. The fixture is a mock, so its records illustrate the following resolution rules for a verified partner feed.

| Mismatch | Authority and rationale |
| --- | --- |
| Missing locally | The partner is authoritative about its payment record. Investigate the missing order and recover it through the order workflow so inventory and order items are accounted for. |
| Missing at partner | The local service is authoritative about order existence and stock reservations. Keep the local order and investigate partner ingestion or whether the order has reached the payment workflow. |
| Status differs | A verified partner `PAID` status is authoritative for settlement of a local `PENDING` order. Local `PAID` and `CANCELLED` are preserved pending manual review because changing a terminal status can require refund, fulfillment, or inventory action. For other differences, keep the local lifecycle status and investigate. |

The outbound `PartnerClient` accepts a base URL such as `PARTNER_BASE_URL` and calls `GET /orders`. It validates the list with the same Zod schema used for the fixture.

## Docker

For staging, follow the [deployment runbook](docs/staging.md) for private ingress, migrations, backups, rollback, and UAT.

Apply the migration using the local setup above, then build and run the API image on the Compose network. The example assumes the default Compose project name, `orders-service`.

```sh
docker build -t orders-service .
docker run --rm --name orders-api --network orders-service_default --env-file .env \
  -e DATABASE_URL=postgresql://orders:orders@db:5432/orders orders-service
```

For other deployments, set `DATABASE_URL` to the PostgreSQL address reachable from the container and apply committed migrations with `npx prisma migrate deploy` from the workspace before starting the API.

- Keep Fastify and PostgreSQL on private networks. The public edge should expose Next.js only, plus the exact signed payment webhook route if required. Overwrite incoming forwarding headers and use matching server-side API keys. Set `PUBLIC_BASE_URL` to the HTTPS address reachable from guest phones.
- Before migrating, rehearse against a restored backup, drain guest writes, and coordinate restarting both apps. The seating migration closes legacy open carts and preserves submitted tickets and reservations. Allow for table locks while constraints are installed.
- If cutover fails before writes resume, restore the verified pre-cutover backup and matching app versions together. After writes resume, preserve the new transactions and prefer a forward fix. Reconcile newer orders and reservations before any backup restore. Reopen seating and smoke-test checkout and kitchen delivery before admitting guests.

## Design decisions

- Orders aggregate repeated product IDs and acquire row locks in sorted product ID order. Each stock decrement is a conditional update with an affected-row check. Stock, versions, order items, and order status commit together.
- A transaction-scoped PostgreSQL advisory lock serializes use of each idempotency key. The SHA-256 hash covers the validated JSON body, preserving item array order. Successful responses and business conflicts are replayed with their original status and body. A savepoint rolls back inventory and order changes before storing a conflict response.
- Payment signatures cover the raw HTTP body. A unique event ID makes repeated delivery safe. A second transaction-scoped lock serializes order creation and successful payment handling for the same order ID. An early event stays pending until creation marks it processed and sets the order to `PAID` in the same transaction. Payment success changes `PENDING` orders and preserves terminal statuses.
- Each outbound attempt has a timeout covering the headers and body. Network failures, timeouts, and 5xx responses use bounded exponential backoff with jitter. Invalid JSON, schema violations, and 4xx responses fail immediately.
