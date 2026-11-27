import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { afterAll, expect, test } from 'vitest'
import { buildApp } from '../src/app.js'
import { createDb } from '../src/lib/db.js'

const db = createDb()
const headers = { 'x-kitchen-api-key': randomUUID() }
const app = buildApp({ db, kitchenApiKey: headers['x-kitchen-api-key'] })

afterAll(async () => {
  await app.close()
  await db.$disconnect()
})

test('staff can create, edit and hide a menu item without altering order snapshots', async () => {
  const table = await db.diningTable.create({ data: {
    number: randomInt(1_000_000_000, 2_000_000_000), qrToken: randomBytes(24).toString('base64url'),
  } })
  const name = 'Menu test ' + randomUUID()
  const guest = '/t/' + table.qrToken
  try {
    const session = await app.inject({
      method: 'POST', url: `/staff/table-sessions/${table.id}/reset`, headers,
      payload: { expectedSessionId: null, actor: { id: 'qa-staff', role: 'KITCHEN' } },
    })
    expect(session.statusCode).toBe(200)
    const joined = await app.inject({ method: 'POST', url: guest + '/join', payload: { code: session.json().joinCode } })
    expect(joined.statusCode).toBe(200)
    const { sessionId, accessToken } = joined.json()
    const guestHeaders = { 'x-dining-session': accessToken, 'x-dining-session-id': sessionId }
    const created = await app.inject({ method: 'POST', url: '/staff/menu', headers, payload: { name, priceMinor: 12050 } })
    expect(created.statusCode).toBe(201)
    const item = created.json()
    expect(item).toMatchObject({ name, priceMinor: 12050, available: true })
    const staff = await app.inject({ url: '/staff/menu', headers })
    expect(staff.json()).toContainEqual(item)
    const added = await app.inject({
      method: 'POST', url: guest + '/order/items', headers: guestHeaders, payload: { items: [{ menuItemId: item.id, quantity: 1 }] },
    })
    expect(added.statusCode).toBe(200)
    const patch = (payload: object) => app.inject({ method: 'PATCH', url: '/staff/menu/' + item.id, headers, payload })
    const changed = await patch({ priceMinor: 1999 })
    expect(changed.statusCode).toBe(200)
    expect(changed.json().priceMinor).toBe(1999)
    const before = (await app.inject({ url: guest, headers: guestHeaders })).json()
    expect(before.menu).toContainEqual({ ...item, priceMinor: 1999 })
    expect(before.order.items[0]).toMatchObject({ unitPriceMinor: 12050, nameSnapshot: name })
    const hidden = await patch({ available: false })
    expect(hidden.statusCode).toBe(200)
    expect(hidden.json().available).toBe(false)
    expect((await app.inject({ url: guest, headers: guestHeaders })).json().menu).not.toContainEqual(expect.objectContaining({ id: item.id }))
  } finally {
    await db.$transaction([
      db.tableOrderItem.deleteMany({ where: { order: { tableId: table.id } } }),
      db.tableOrder.deleteMany({ where: { tableId: table.id } }),
      db.diningSession.deleteMany({ where: { tableId: table.id } }),
      db.diningTable.delete({ where: { id: table.id } }),
      db.menuItem.deleteMany({ where: { name } }),
    ])
  }
})

test('staff menu rejects invalid writes and requires the API key on every endpoint', async () => {
  const itemUrl = '/staff/menu/' + randomUUID()
  expect((await app.inject('/staff/menu')).statusCode).toBe(401)
  expect((await app.inject({ method: 'POST', url: '/staff/menu', payload: { name: 'Item', priceMinor: 0 } })).statusCode).toBe(401)
  expect((await app.inject({ method: 'PATCH', url: itemUrl, payload: { available: false } })).statusCode).toBe(401)
  for (const payload of [{ name: '', priceMinor: 0 }, { name: 'a'.repeat(81), priceMinor: 0 },
    { name: 'Item', priceMinor: -1 }, { name: 'Item', priceMinor: 1.5 }, { name: 'Item', priceMinor: 0, available: 'false' }]) {
    expect((await app.inject({ method: 'POST', url: '/staff/menu', headers, payload })).statusCode).toBe(400)
  }
  expect((await app.inject({ method: 'PATCH', url: itemUrl, headers, payload: {} })).statusCode).toBe(400)
})
