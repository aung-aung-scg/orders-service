import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import 'dotenv/config'
import { Client } from 'pg'
import { expect, test } from 'vitest'

test('restaurant migration backfills existing rows without changing business data', async () => {
  const schema = 'tenant_migration_' + randomUUID().replaceAll('-', '')
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  const directory = 'prisma/migrations'
  const migration = '20261128000000_restaurants'
  const tables = ['DiningTable', 'DiningSession', 'Reservation', 'MenuItem', 'TableOrder', 'StaffUser', 'TableOrderItem']
  await client.connect()
  try {
    await client.query(`CREATE SCHEMA "${schema}"`)
    await client.query(`SET search_path TO "${schema}", public`)
    const migrations = (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isDirectory())
    for (const name of migrations.map(entry => entry.name).sort()) {
      if (name >= migration) break
      await client.query(await readFile(join(directory, name, 'migration.sql'), 'utf8'))
    }
    await client.query(`
      INSERT INTO "DiningTable" (id, number, "qrToken") VALUES ('table', 7, 'printed-qr');
      INSERT INTO "DiningSession" (id, "tableId", "joinCode", "accessToken", "startedBy")
        VALUES ('session', 'table', 'join-code', 'guest-token', 'staff');
      INSERT INTO "Reservation" (id, "tableId", "partySize", "startsAt", "endsAt", "guestName", phone, code, "updatedAt")
        VALUES ('booking', 'table', 2, now(), now() + interval '90 minutes', 'Guest', '0800000000', 'booking-code', now());
      INSERT INTO "MenuItem" (id, name, "priceMinor", "imageKey") VALUES ('item', 'Soup', 100, 'image.webp');
      INSERT INTO "TableOrder" (id, "tableId", "sessionId", status, version, "submittedAt", "updatedAt")
        VALUES ('ticket', 'table', 'session', 'SUBMITTED', 4, now(), now());
      INSERT INTO "TableOrderItem" (id, "orderId", "menuItemId", "nameSnapshot", "unitPriceMinor", quantity)
        VALUES ('line', 'ticket', 'item', 'Original soup', 80, 2);
      INSERT INTO "StaffUser" (id, username, "passwordHash", role) VALUES ('staff', 'kitchen', 'test-hash', 'KITCHEN');
    `)
    async function record(table: string) {
      return (await client.query(`SELECT to_jsonb(row) AS data FROM "${table}" row`)).rows[0].data
    }
    const before = []
    for (const table of tables) before.push(await record(table))
    await client.query(await readFile(join(directory, migration, 'migration.sql'), 'utf8'))
    expect((await client.query('SELECT id, slug, name FROM "Restaurant"')).rows).toEqual([
      { id: 'default', slug: 'default', name: 'Restaurant' },
    ])
    for (const [index, table] of tables.entries()) {
      const added = table === 'TableOrderItem' ? {} : { restaurantId: 'default' }
      expect(await record(table)).toEqual({ ...before[index], ...added, ...(table === 'StaffUser' ? { mustChangePassword: false } : {}) })
    }
    await expect(client.query(`INSERT INTO "StaffUser" (id, username, "passwordHash", role)
      VALUES ('invalid', 'invalid', 'test-hash', 'ADMIN')`)).rejects.toMatchObject({ code: '23514' })
    await expect(client.query(`INSERT INTO "StaffUser" (id, username, "passwordHash", role, "restaurantId")
      VALUES ('invalid', 'invalid', 'test-hash', 'SUPER_ADMIN', 'default')`)).rejects.toMatchObject({ code: '23514' })
    await expect(client.query(`INSERT INTO "StaffUser" (id, username, "passwordHash", role)
      VALUES ('platform', 'platform-admin', 'test-hash', 'SUPER_ADMIN')`)).resolves.toMatchObject({ rowCount: 1 })
  } finally {
    await client.query('ROLLBACK')
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await client.end()
  }
})
