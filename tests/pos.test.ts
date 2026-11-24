import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeEach, expect, test } from 'vitest'
import { buildApp } from '../src/app.js'
import { createDb } from '../src/lib/db.js'

const db = createDb()
const kitchenHeaders = { 'x-kitchen-api-key': randomUUID() }
const app = buildApp({ db, kitchenApiKey: kitchenHeaders['x-kitchen-api-key'] })
let tableId: string
let menuItemId: string
let url: string

beforeEach(async () => {
  const qrToken = randomBytes(24).toString('base64url')
  const table = await db.diningTable.create({ data: { qrToken, number: -randomBytes(4).readUInt32BE() % 2147483647 } })
  tableId = table.id
  url = '/t/' + qrToken
  const menu = await db.menuItem.create({ data: { name: 'Test ' + randomUUID(), priceMinor: 1250 } })
  menuItemId = menu.id
})

afterEach(async () => {
  await db.$transaction([
    db.idempotencyRecord.deleteMany({ where: { key: { startsWith: `pos:${tableId}:` } } }),
    db.tableOrderItem.deleteMany({ where: { order: { tableId } } }),
    db.tableOrder.deleteMany({ where: { tableId } }),
    db.diningTable.deleteMany({ where: { id: tableId } }),
    db.menuItem.deleteMany({ where: { id: menuItemId } }),
  ])
})

afterAll(async () => {
  const closing = app.close()
  app.server.closeAllConnections()
  await closing
  await db.$disconnect()
})

function add(quantity = 2) {
  return app.inject({
    method: 'POST', url: url + '/order/items',
    payload: { totalMinor: 1, items: [{ menuItemId, quantity, unitPriceMinor: 1 }] },
  })
}

test('computes totals and retains snapshot after menu price changes', async () => {
  const created = await add()
  expect(created.statusCode).toBe(200)
  expect(created.json()).toMatchObject({ totalMinor: 2500, items: [{ unitPriceMinor: 1250 }] })
  await db.menuItem.update({ where: { id: menuItemId }, data: { priceMinor: 3000, name: 'New name' } })
  const item = created.json().items[0]
  const patch = (quantity: number) => app.inject({
    method: 'PATCH', url: url + '/order/items/' + item.id, payload: { quantity },
  })
  expect((await patch(3)).json()).toMatchObject({
    totalMinor: 3750, items: [{ nameSnapshot: item.nameSnapshot, unitPriceMinor: 1250 }],
  })
  expect((await patch(0)).json()).toMatchObject({ totalMinor: 0, items: [] })
})

test('concurrent first adds use one open order', async () => {
  const responses = await Promise.all([add(), add()])
  expect(responses.map(response => response.statusCode)).toEqual([200, 200])
  expect(responses[0].json().id).toBe(responses[1].json().id)
  expect(await db.tableOrder.count({ where: { tableId, status: 'OPEN' } })).toBe(1)
  expect((await app.inject(url)).json().order).toMatchObject({ totalMinor: 5000 })
})

test('unknown and inactive QR tokens return 404', async () => {
  expect((await app.inject('/t/' + randomUUID())).statusCode).toBe(404)
  await db.diningTable.update({ where: { id: tableId }, data: { active: false } })
  expect((await app.inject(url)).statusCode).toBe(404)
  expect((await add()).statusCode).toBe(404)
})

function submit(key = randomUUID()) {
  return app.inject({ method: 'POST', url: url + '/order/submit', headers: { 'idempotency-key': key } })
}

test('concurrent submits with the same key return one ticket', async () => {
  await add()
  const key = randomUUID()
  const [first, second] = await Promise.all([submit(key), submit(key)])
  expect(first.statusCode).toBe(201)
  expect(second.statusCode).toBe(201)
  expect(second.json()).toEqual(first.json())
  expect(await db.tableOrder.count({ where: { tableId, status: 'SUBMITTED' } })).toBe(1)
})

test('submitting an empty order returns a conflict', async () => {
  const response = await submit()
  expect(response.statusCode).toBe(409)
  expect(response.json()).toMatchObject({ code: 'EMPTY_ORDER' })
})

const statuses = ['OPEN', 'SUBMITTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'] as const
const legal = new Set(['SUBMITTED:PREPARING', 'PREPARING:READY', 'READY:SERVED', 'SUBMITTED:CANCELLED', 'PREPARING:CANCELLED'])

function advance(id: string, status: string, headers: Record<string, string> = kitchenHeaders) {
  return app.inject({ method: 'PATCH', url: `/kitchen/orders/${id}/status`, headers, payload: { status } })
}

test('enforces every kitchen status transition', async () => {
  const { id } = (await add()).json()
  for (const from of statuses) {
    for (const to of statuses) {
      await db.tableOrder.update({ where: { id }, data: { status: from } })
      const response = await advance(id, to)
      expect(response.statusCode, `${from} → ${to}`).toBe(legal.has(`${from}:${to}`) ? 200 : 409)
    }
  }
})

test('only one of two kitchen clicks can advance a ticket', async () => {
  await add()
  const { id } = (await submit()).json()
  const results = await Promise.all([advance(id, 'PREPARING'), advance(id, 'PREPARING')])
  expect(results.map(result => result.statusCode).sort()).toEqual([200, 409])
  const tickets = await app.inject({ url: '/kitchen/orders', headers: kitchenHeaders })
  expect(tickets.json().find((ticket: { id: string }) => ticket.id === id)).toMatchObject({
    status: 'PREPARING', table: { number: expect.any(Number) }, items: [{ menuItemId }],
  })
})

test('kitchen endpoints require an API key', async () => {
  expect((await app.inject('/kitchen/orders')).statusCode).toBe(401)
  expect((await app.inject('/kitchen/stream')).statusCode).toBe(401)
  expect((await advance(randomUUID(), 'READY', { 'x-kitchen-api-key': '' })).statusCode).toBe(401)
})

test('tables endpoints create unique tokenized tables and return an SVG', async () => {
  const number = 100000 + randomBytes(2).readUInt16BE()
  let createdId: string | undefined
  try {
    expect((await app.inject('/tables')).statusCode).toBe(401)
    const created = await app.inject({ method: 'POST', url: '/tables', headers: kitchenHeaders, payload: { number } })
    expect(created.statusCode).toBe(201)
    const { id, qrToken } = created.json()
    createdId = id
    expect(Buffer.from(qrToken, 'base64url').length).toBeGreaterThanOrEqual(16)
    const list = await app.inject({ url: '/tables', headers: kitchenHeaders })
    expect(list.json()).toContainEqual(created.json())
    const qr = await app.inject({ url: `/tables/${id}/qr`, headers: kitchenHeaders })
    expect(qr.statusCode).toBe(200)
    expect(qr.headers['content-type']).toContain('image/svg+xml')
    expect(qr.body).toContain('<svg')
  } finally {
    if (createdId) await db.diningTable.delete({ where: { id: createdId } })
  }
})

test('kitchen stream sends a snapshot followed by submitted tickets', async () => {
  await add()
  const address = await app.listen({ host: '127.0.0.1', port: 0 })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(address + '/kitchen/stream', { headers: kitchenHeaders, signal: controller.signal })
    expect(response.status).toBe(200)
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ''
    async function nextEvent() {
      while (!buffer.includes('\n\n')) {
        const chunk = await reader.read()
        if (chunk.done) throw new Error('Stream closed before the next event')
        buffer += chunk.value
      }
      const end = buffer.indexOf('\n\n')
      const event = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      return event
    }
    expect(await nextEvent()).toMatch(/^event: snapshot\ndata: \[/)
    const result = await submit()
    expect(result.statusCode).toBe(201)
    const event = await nextEvent()
    expect(event).toMatch(/^event: tickets\ndata: \[/)
    expect(event).toContain(result.json().id)
    await reader.cancel()
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
})
