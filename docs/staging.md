# Staging deployment

Use a Linux staging host with Docker, systemd, an HTTPS reverse proxy, and Node 22.12+ or 24. Run the commands below from a dedicated release checkout. Use a single Fastify instance for this release because SSE and rate limits are process-local. Keep the previous release checkout, built admin, backend image tag, and configuration until sign-off.

## Configuration

Provision these files outside Git at `/etc/orders-staging/`. Restrict access to the deployment account and service administrators. Use staging-only credentials. Use plain assignments with shell-safe values, such as secrets generated with `openssl rand -hex 32`. The backend file is read by both Docker and Bash.

| File | Required settings |
| --- | --- |
| `db.env` | `POSTGRES_USER=orders`, `POSTGRES_DB=orders`, strong `POSTGRES_PASSWORD` |
| `backend.env` | `DATABASE_URL=postgresql://orders:<url-encoded-password>@staging-db:5432/orders`, `WEBHOOK_SECRET`, `KITCHEN_API_KEY`, `PUBLIC_BASE_URL=https://<staging-host>`, `PORT=3000`, `NODE_ENV=production`, `STOCK_DEMO_ENABLED=false` |
| `admin.env` | `BACKEND_URL=http://127.0.0.1:3000`, matching `KITCHEN_API_KEY`, random `JWT_SECRET` of at least 32 characters, `NODE_ENV=production`, `STOCK_DEMO_ENABLED=false` |

If overriding booking defaults, set `BOOKING_TZ`, `BOOKING_MAX_DAYS_AHEAD`, and `BOOKING_MAX_PARTY` identically in both apps. The other `BOOKING_*` settings and `CART_INACTIVITY_MINUTES` belong in the backend. Never use the localhost `PUBLIC_BASE_URL` for printed QR codes. Do not put server credentials in `NEXT_PUBLIC_*` variables.

## Build and preflight

Choose an immutable release tag and run the backend suite on a **disposable database**, never the staging or production database. Confirm the candidate contains the reservation, cart-version, and dining-session migrations.

```bash
set -euo pipefail
umask 077
export CONFIG=/etc/orders-staging
export RELEASE=rc-1                       # use a unique release tag
export CHECKOUT="$PWD"
export ADMIN_NODE="$(command -v node)"
npm ci --include=dev
npx --no-install prisma generate
DATABASE_URL="$QA_DATABASE_URL" npx --no-install prisma migrate deploy
DATABASE_URL="$QA_DATABASE_URL" npm test
docker build -t "orders-service:$RELEASE" .
(
  cd admin
  npm ci --include=dev
  npm test
  npm run lint
  set -a
  . "$CONFIG/admin.env"
  set +a
  npm run build
)
```

Set `QA_DATABASE_URL` to a fresh, disposable PostgreSQL 16 database with permission to create `btree_gist` before running the preflight. Stop if any command fails. Keep secrets out of recorded shell output.

## Provision, back up, and migrate

This reference uses a single host. Run the provisioning commands once. For existing staging, reuse its database and verify mappings instead of creating a second instance. A deployment account must have the documented Docker and systemd permissions.

```bash
docker network create orders-staging
docker volume create orders-staging-db
docker run -d --name orders-staging-db --restart unless-stopped \
  --network orders-staging --network-alias staging-db \
  --env-file "$CONFIG/db.env" -p 127.0.0.1:5433:5432 \
  -v orders-staging-db:/var/lib/postgresql/data postgres:16
docker exec orders-staging-db pg_isready -U orders -d orders
```

Put the reverse proxy into maintenance mode and drain guest/staff writes before backing up or migrating an existing system. Stop both previous app services after draining. Store the backup outside the checkout, restrict access, and verify that a restore succeeds.

```bash
BACKUP_DIR="$HOME/orders-staging-backups"
mkdir -p -m 700 "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/orders-before-$RELEASE.dump"
docker exec orders-staging-db pg_dump -U orders -d orders -Fc > "$BACKUP"
test -s "$BACKUP"
docker exec orders-staging-db createdb -U orders orders_restore_check
docker exec -i orders-staging-db pg_restore -U orders --exit-on-error \
  --no-owner -d orders_restore_check < "$BACKUP"
docker exec orders-staging-db psql -X -v ON_ERROR_STOP=1 -U orders \
  -d orders_restore_check -c "SELECT current_database(), to_regclass('public._prisma_migrations');"
```

On a brand-new database, the migration table will not exist before the first deployment. On an existing database, confirm that it exists and compare ticket and reservation counts with the drained source. Retain the restore database through the rollback rehearsal. Use a unique restore-check database name on later rehearsals.

```bash
set -a
. "$CONFIG/backend.env"
set +a
BACKEND_DATABASE_URL="$DATABASE_URL"
export DATABASE_URL="$(node -e 'const u=new URL(process.env.DATABASE_URL); u.hostname="127.0.0.1"; u.port="5433"; process.stdout.write(u.href)')"
npx --no-install prisma migrate deploy
npx --no-install prisma migrate status
```

Allow for schema and table locks. The dining-session migration cancels pre-session open carts and preserves submitted tickets and existing reservations. Tell staff to start a new seating after cutover. Use `npm run db:seed:staff` only for first-time provisioning or intentional password rotation, with `STAFF_ADMIN_PASSWORD` and `STAFF_KITCHEN_PASSWORD` supplied by the operator. The seed updates existing passwords. Use `npm run db:seed` only for an intentionally seeded staging database.

## Start and verify ingress

After migration, replace the stopped backend container and start the matching admin build. Omit the container removal command on a first deploy.

```bash
docker rm orders-staging-api
docker run -d --name orders-staging-api --restart unless-stopped \
  --network orders-staging -p 127.0.0.1:3000:3000 \
  --env-file "$CONFIG/backend.env" -e DATABASE_URL="$BACKEND_DATABASE_URL" \
  "orders-service:$RELEASE"
sudo systemd-run --unit=orders-staging-admin \
  --property="User=$(id -un)" --property="WorkingDirectory=$CHECKOUT/admin" \
  --property="EnvironmentFile=$CONFIG/admin.env" --property=Restart=on-failure \
  "$ADMIN_NODE" "$CHECKOUT/admin/node_modules/next/dist/bin/next" \
  start -H 127.0.0.1 -p 3001
docker port orders-staging-api 3000
docker port orders-staging-db 5432
curl -fsS http://127.0.0.1:3001/ >/dev/null
```

Expected Docker mappings are `127.0.0.1:3000` and `127.0.0.1:5433`. Expose HTTPS on the edge. Use a dedicated staging hostname. For Nginx, place these directives in its existing TLS server block.

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto https;
proxy_set_header X-Forwarded-For $remote_addr;
location / { proxy_pass http://127.0.0.1:3001; }
location = /kitchen/stream {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_read_timeout 75s;
}
```

Only if staging requires a payment callback, forward the exact `/webhooks/payments` route to Fastify and preserve the body and signature header. Never expose a general Fastify proxy. Suppress or redact request-target logging for `/booking/*` and `/t/*` at the edge and other logging layers. The URL may contain a private booking code. Then run `sudo nginx -t && sudo systemctl reload nginx`. Limit staging access to authorized testers and their guest devices until sign-off.

```bash
BASE=https://staging.example.com            # replace with the actual hostname
curl -fsS "$BASE/" >/dev/null              # 200
curl -fsS "$BASE/book" >/dev/null          # 200
curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/kitchen/stream" # 401
curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/menu"           # login redirect
for route in products orders; do
  curl -sS -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:3000/$route" # 404
done
```

From a different machine, verify TCP ports 3000, 3001, and 5433 on the staging host are unreachable. Check staff cookies are Secure and HTTP-only and that proxy forwarding uses the actual client address. Staff must confirm real-time updates and reconnect through the HTTPS edge.

## Rollback

1. Re-enable maintenance mode and drain writes. Stop the candidate with `sudo systemctl stop orders-staging-admin` and `docker stop orders-staging-api`. If writes already resumed, capture another dump and reconcile new orders and reservations before restoring. Prefer a forward fix when data was accepted after cutover.
2. Before writes resume, restore the pre-cutover snapshot into a **new** database. Preserve the candidate database for diagnosis.

```bash
docker exec orders-staging-db createdb -U orders orders_rollback
docker exec -i orders-staging-db pg_restore -U orders --exit-on-error \
  --no-owner -d orders_rollback < "$BACKUP"
docker exec orders-staging-db psql -X -v ON_ERROR_STOP=1 -U orders \
  -d orders_rollback -c 'SELECT migration_name FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 1;'
```

3. Compare the restored migration and key row counts with the pre-cutover record. Use the start commands above with the previous image tag, previous admin checkout, and previous environment. Set its database URL to the restored `orders_rollback` database, keeping the private DNS name. Verify the former workflow and only then reopen access. Do not run the candidate migration command during rollback.

## Manual UAT

- [ ] **Guest booking:** Book from a phone. Confirm the timezone, table assignment, calendar download, cancellation before cutoff, and clear unavailable states. Confirm a closed day, an open day with no eligible times, and a genuinely full time window display distinct messages.
- [ ] **QR ordering:** Check print preview for one card per page. Print and scan on both iOS and Android from guest Wi-Fi. The URL uses staging HTTPS. Join with two devices, share a cart, change it on one device, and verify stale checkout is rejected on the other. Retry a checkout and confirm only one ticket.
- [ ] **Kitchen:** Have KITCHEN staff sign in, then move a ticket from New to Served. Interrupt SSE through the staging proxy, place a ticket while disconnected, and verify polling, one ticket, resumed live updates, and guest status. Record any sustained failures separately from a disconnect log.
- [ ] **Menu:** ADMIN can add, edit, and hide an item. KITCHEN cannot access menu management. Verify guest visibility and THB amounts, and that an existing cart line keeps its price snapshot.
- [ ] **Table turnover:** Normal reset is blocked with active tickets. An ADMIN override records a reason and marks prior tickets as previous seating. Confirm those tickets remain, the old code and tab cannot reach the new cart, and the new seating starts empty. Verify the configured inactivity cutoff with a disposable cart.

## Suggested commits

Stage shared-file hunks with their dependent changes. If a split breaks the build or tests, combine the adjacent groups.

1. `feat: add guest reservations and staff booking management` including the reservation migration and tests.
2. `feat: add staff menu management and satang validation` including menu API and snapshot tests.
3. `fix: isolate dining sessions and make checkout retry-safe` including both POS migrations, staff controls, and concurrency tests.
4. `fix: harden staging ingress and kitchen stream recovery` including demo gating, request logging, booking availability messaging, and staging documentation.
