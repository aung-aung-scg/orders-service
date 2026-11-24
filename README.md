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
- Print codes from admin `/tables`. A guest scans a QR code to open `/t/{qrToken}`, shares the table cart, and places an order. Staff use `/kitchen` to move tickets through Preparing, Ready, and Served. The customer page checks status every five seconds.
- Fastify customer API: `GET /t/:qrToken`, `POST /t/:qrToken/order/items`, `PATCH /t/:qrToken/order/items/:itemId`, and `POST /t/:qrToken/order/submit` with an `Idempotency-Key`.
- Protected Fastify API: `GET /kitchen/orders`, `PATCH /kitchen/orders/:id/status`, `GET /kitchen/stream`, `GET /tables`, `POST /tables`, and `GET /tables/:id/qr`.
- Set the same `KITCHEN_API_KEY` in backend `.env` and `admin/.env.local`. Next.js sends it as `X-Kitchen-API-Key` on the server. Keep `BACKEND_URL` in `admin/.env.local`. Set backend `PUBLIC_BASE_URL` to the admin origin reachable by guest phones. It defaults to `http://localhost:3001`.
- QR URLs use random tokens. The server stores prices in integer satang, snapshots item names and prices, and computes totals in the cart transaction. A partial unique index limits each table to one open cart. Reusing a submit key replays the ticket response.
- SSE sends an active-ticket snapshot first and updates after commits. The kitchen board uses a server-side SSE proxy and polls every five seconds when disconnected.
- The 30-writes-per-minute limit per table and SSE event bus are per process. Multiple instances need a shared limiter and Redis pub/sub or PostgreSQL `LISTEN/NOTIFY`. The flow has no payment handling.

## Staff auth

- Set `STAFF_ADMIN_PASSWORD` and `STAFF_KITCHEN_PASSWORD` in the backend `.env`, apply migrations, and run `npm run db:seed:staff` to create or update the `admin` and `kitchen` users.
- Set the same `KITCHEN_API_KEY` in both apps and a random `JWT_SECRET` of at least 32 characters in `admin/.env.local`. Next.js verifies credentials through Fastify and sets an eight-hour HTTP-only session cookie. Use HTTPS in production.
- ADMIN can use all staff pages. KITCHEN can use the kitchen board and its live feed. Guest table QR pages are public.
- The login limit is five failed attempts per username and IP in 15 minutes, in memory per instance. Configure the ingress to overwrite `X-Forwarded-For` with the client IP. Sessions have no refresh tokens or early server-side revocation. Rotating the single signing secret invalidates all sessions.

## API

| Request | Input and result |
| --- | --- |
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

Apply the migration using the local setup above, then build and run the API image on the Compose network. The example assumes the default Compose project name, `orders-service`.

```sh
docker build -t orders-service .
docker run --rm --network orders-service_default -p 3000:3000 --env-file .env \
  -e DATABASE_URL=postgresql://orders:orders@db:5432/orders orders-service
```

For other deployments, set `DATABASE_URL` to the PostgreSQL address reachable from the container and apply committed migrations with `npx prisma migrate deploy` from the workspace before starting the API.

## Design decisions

- Orders aggregate repeated product IDs and acquire row locks in sorted product ID order. Each stock decrement is a conditional update with an affected-row check. Stock, versions, order items, and order status commit together.
- A transaction-scoped PostgreSQL advisory lock serializes use of each idempotency key. The SHA-256 hash covers the validated JSON body, preserving item array order. Successful responses and business conflicts are replayed with their original status and body. A savepoint rolls back inventory and order changes before storing a conflict response.
- Payment signatures cover the raw HTTP body. A unique event ID makes repeated delivery safe. A second transaction-scoped lock serializes order creation and successful payment handling for the same order ID. An early event stays pending until creation marks it processed and sets the order to `PAID` in the same transaction. Payment success changes `PENDING` orders and preserves terminal statuses.
- Each outbound attempt has a timeout covering the headers and body. Network failures, timeouts, and 5xx responses use bounded exponential backoff with jitter. Invalid JSON, schema violations, and 4xx responses fail immediately.
