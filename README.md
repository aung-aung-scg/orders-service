# Orders service

A restaurant ordering backend with a staff admin. Guests scan a QR code at the table, order from their phone, and the ticket shows up on the kitchen screen. They can also book a table online.

I built it to practise the problems that are easy to get wrong in a system that handles money and stock: overselling, double submits, duplicate webhooks, double bookings, and clients that drop and reconnect.

Stack: Node 22, Fastify, TypeScript, PostgreSQL, Prisma, Next.js (App Router), Tailwind. Tested with Vitest against a real Postgres.


## The hard parts

| Problem | What I did | Where to look |
| --- | --- | --- |
| Two customers buy the last item | One conditional `UPDATE ... WHERE stock >= qty` with an affected-row check, inside a transaction. Test fires 50 parallel orders at stock 10: exactly 10 succeed. | `tests/orders.concurrency.test.ts` |
| Client retries a request | `Idempotency-Key` per request, hashed with the body. Same key and body replays the stored response. Same key, different body gets 422. | `tests/idempotency.test.ts` |
| Payment webhook arrives twice, or before the order exists | HMAC over the raw body, dedupe by event ID, early events are stored and applied when the order is created. | `tests/webhooks.test.ts` |
| Two people book the same table | A Postgres exclusion constraint, not check-then-insert. Test sends 20 parallel requests for the last table: one wins. | `tests/reservations.test.ts` |
| Kitchen screen loses wifi | SSE sends a snapshot first, then updates. The board falls back to polling every 5 seconds. | `src/routes/kitchen.ts` |
| Table QR code is a permanent printed sticker | The QR holds only a token. A rotating join code from staff grants a session cookie, and resetting the table invalidates old access. | `src/services/dining-sessions.ts` |

Money is stored as integer satang. Order lines snapshot the name and price, so menu changes never rewrite history.

## Run it

Needs Node 22+, Docker, and npm.

```sh
cp .env.example .env            # set WEBHOOK_SECRET, KITCHEN_API_KEY, staff passwords
docker compose up -d
npm ci
npx prisma migrate deploy
npm run db:seed && npm run db:seed:staff
npm run dev                     # API on :3000
```

In another terminal:

```sh
cd admin
cp .env.example .env.local      # BACKEND_URL, KITCHEN_API_KEY, JWT_SECRET
npm ci && npm run dev           # admin on :3001
```

Staff log in at `/login` as `admin` or `kitchen`. Run the tests with `npm test`.

To try the stock and idempotency demo, set `STOCK_DEMO_ENABLED=true` in both env files and open `/products` and `/orders`.

## Decisions and trade-offs

- The backend trusts a shared API key and must stay on a private network. Only the Next.js app is public.
- Staff sessions are 8-hour JWTs in HttpOnly cookies. They can't be revoked early. A refresh token or session table would fix that.
- Rate limits and the SSE event bus live in memory, so this runs as one instance. Scaling out needs Redis or Postgres `LISTEN/NOTIFY`.
- No payments, and no email or LINE confirmations.
- Menu images are stored on local disk. In containers that needs a mounted volume or S3.

## More

- [Full reference: endpoints, env vars, reconciliation rules](docs/reference.md)
- [Staging runbook](docs/staging.md)
