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
let sessionId: string
let guestHeaders: Record<string, string>

function reset(expectedSessionId: string | null, role = 'KITCHEN', overrideReason?: string) {
  return app.inject({
    method: 'POST', url: `/staff/table-sessions/${tableId}/reset`, headers: kitchenHeaders,
    payload: { expectedSessionId, actor: { id: 'qa-staff', role }, overrideReason },
  })
}

function join(code: string) {
  return app.inject({ method: 'POST', url: url + '/join', payload: { code } })
}

function sessionHeaders(session: { sessionId: string; accessToken: string }) {
  return { 'x-dining-session': session.accessToken, 'x-dining-session-id': session.sessionId }
}

function getCart(headers = guestHeaders) {
  return app.inject({ url, headers })
}

beforeEach(async () => {
  const qrToken = randomBytes(24).toString('base64url')
  const table = await db.diningTable.create({ data: { qrToken, number: -randomBytes(4).readUInt32BE() % 2147483647 } })
  tableId = table.id
  url = '/t/' + qrToken
  const seating = await reset(null)
  expect(seating.statusCode).toBe(200)
  const joined = await join(seating.json().joinCode)
  expect(joined.statusCode).toBe(200)
  sessionId = joined.json().sessionId
  guestHeaders = sessionHeaders(joined.json())
  const menu = await db.menuItem.create({ data: { name: 'Test ' + randomUUID(), priceMinor: 1250 } })
  menuItemId = menu.id
})

afterEach(async () => {
  await db.$transaction([
    db.idempotencyRecord.deleteMany({ where: { key: { startsWith: `pos:${tableId}:` } } }),
    db.tableOrderItem.deleteMany({ where: { order: { tableId } } }),
    db.tableOrder.deleteMany({ where: { tableId } }),
    db.diningSession.deleteMany({ where: { tableId } }),
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

function add(quantity = 2, headers = guestHeaders) {
  return app.inject({
    method: 'POST', url: url + '/order/items', headers,
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
    method: 'PATCH', url: url + '/order/items/' + item.id, headers: guestHeaders, payload: { quantity },
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
  expect((await getCart()).json().order).toMatchObject({ totalMinor: 5000 })
})

test('unknown and inactive QR tokens return 404', async () => {
  expect((await app.inject('/t/' + randomUUID())).statusCode).toBe(404)
  await db.diningTable.update({ where: { id: tableId }, data: { active: false } })
  expect((await app.inject(url)).statusCode).toBe(404)
  expect((await add()).statusCode).toBe(404)
})

async function submit(key = randomUUID(), checkout?: { cartId: string; version: number }) {
  if (!checkout) {
    const { order } = (await getCart()).json()
    checkout = { cartId: order.id, version: order.version }
  }
  return app.inject({ method: 'POST', url: url + '/order/submit', headers: { ...guestHeaders, 'idempotency-key': key }, payload: checkout })
}

test('concurrent submits with the same key return one ticket', async () => {
  const { id, version } = (await add()).json()
  const key = randomUUID()
  const checkout = { cartId: id, version }
  const [first, second] = await Promise.all([submit(key, checkout), submit(key, checkout)])
  expect(first.statusCode).toBe(201)
  expect(second.statusCode).toBe(201)
  expect(second.json()).toEqual(first.json())
  expect(await db.tableOrder.count({ where: { tableId, status: 'SUBMITTED' } })).toBe(1)
})

test('submitting an empty order returns a conflict', async () => {
  const empty = await db.tableOrder.create({ data: { tableId, sessionId } })
  const response = await submit(randomUUID(), { cartId: empty.id, version: empty.version })
  expect(response.statusCode).toBe(409)
  expect(response.json()).toMatchObject({ code: 'EMPTY_ORDER' })
})

test('different keys cannot submit the same cart or a replacement cart', async () => {
  const { id, version } = (await add()).json()
  const checkout = { cartId: id, version }
  const results = await Promise.all([submit(randomUUID(), checkout), submit(randomUUID(), checkout)])
  expect(results.map(result => result.statusCode).sort()).toEqual([201, 409])
  const replacement = (await add()).json()
  expect((await submit(randomUUID(), checkout)).json().code).toBe('CART_CHANGED')
  expect((await db.tableOrder.findUniqueOrThrow({ where: { id: replacement.id } })).status).toBe('OPEN')
})

test('cart mutations invalidate checkout and replay keys cannot change payloads', async () => {
  const { id, version } = (await add()).json()
  const newer = (await add()).json()
  const key = randomUUID()
  expect((await submit(key, { cartId: id, version })).json().code).toBe('CART_CHANGED')
  expect((await submit(key, { cartId: id, version: newer.version })).statusCode).toBe(422)
  expect((await submit(randomUUID(), { cartId: id, version: newer.version })).statusCode).toBe(201)
})

test('diners share a seating cart and turnover rejects old codes and credentials', async () => {
  const current = await db.diningSession.findUniqueOrThrow({ where: { id: sessionId } })
  const second = sessionHeaders((await join(current.joinCode)).json())
  const [firstCart, secondCart] = await Promise.all([add(1), add(2, second)])
  expect(firstCart.json().id).toBe(secondCart.json().id)
  expect((await getCart(second)).json().order.totalMinor).toBe(3750)
  expect((await app.inject(url)).json()).toMatchObject({ sessionId: null, order: null, menu: [] })
  expect((await add(1, {})).statusCode).toBe(403)
  const rolled = await reset(sessionId)
  expect(rolled.statusCode).toBe(200)
  expect((await join(current.joinCode)).statusCode).toBe(403)
  expect((await getCart(second)).json()).toMatchObject({ sessionId: null, order: null })
  const next = sessionHeaders((await join(rolled.json().joinCode)).json())
  expect((await add(1, { ...next, 'x-dining-session-id': sessionId })).statusCode).toBe(403)
  expect((await getCart(next)).json().order).toBeNull()
  expect((await db.tableOrder.findUniqueOrThrow({ where: { id: firstCart.json().id } })).status).toBe('CANCELLED')
})

test('session history shares submitted snapshots, updates status, and excludes cancelled and open totals', async () => {
  const seating = await db.diningSession.findUniqueOrThrow({ where: { id: sessionId } })
  const secondDiner = sessionHeaders((await join(seating.joinCode)).json())
  const originalName = (await db.menuItem.findUniqueOrThrow({ where: { id: menuItemId } })).name
  const firstCart = await app.inject({
    method: 'POST', url: url + '/order/items', headers: guestHeaders,
    payload: { items: [{ menuItemId, quantity: 2, note: 'No onions' }] },
  })
  expect(firstCart.statusCode).toBe(200)
  const { id: first } = (await submit()).json()
  await db.menuItem.update({ where: { id: menuItemId }, data: { name: 'New menu name', priceMinor: 3400 } })
  expect((await add(1, secondDiner)).statusCode).toBe(200)
  const { id: second } = (await submit()).json()
  expect((await add(3)).statusCode).toBe(200)

  const shared = (await getCart()).json()
  expect(shared.submittedOrders).toHaveLength(2)
  expect((await getCart(secondDiner)).json().submittedOrders).toEqual(shared.submittedOrders)
  expect(shared.sessionTotalMinor).toBe(5900)
  expect(shared.submittedOrders.find((order: { id: string }) => order.id === first)).toMatchObject({
    status: 'SUBMITTED', submittedAt: expect.any(String), totalMinor: 2500,
    items: [{ nameSnapshot: originalName, unitPriceMinor: 1250, quantity: 2, note: 'No onions' }],
  })

  expect((await advance(first, 'PREPARING')).statusCode).toBe(200)
  expect((await advance(second, 'CANCELLED')).statusCode).toBe(200)
  const updated = (await getCart(secondDiner)).json()
  expect(updated.sessionTotalMinor).toBe(2500)
  expect(updated.submittedOrders).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: first, status: 'PREPARING' }),
    expect.objectContaining({ id: second, status: 'CANCELLED', totalMinor: 3400 }),
  ]))
  expect((await getCart({})).json()).toMatchObject({ submittedOrders: [], sessionTotalMinor: 0 })

  const other = await db.diningTable.create({ data: {
    number: -randomBytes(4).readUInt32BE() % 2147483647, qrToken: randomBytes(24).toString('base64url'),
  } })
  try {
    const response = await app.inject({ url: '/t/' + other.qrToken + '?orderId=' + first, headers: secondDiner })
    expect(response.json()).toMatchObject({ sessionId: null, submittedOrders: [], ticket: null })
  } finally {
    await db.diningTable.delete({ where: { id: other.id } })
  }

  const historyUrl = `/staff/table-sessions/${tableId}/orders`
  expect((await app.inject(historyUrl)).statusCode).toBe(401)
  expect((await app.inject({ url: historyUrl, headers: secondDiner })).statusCode).toBe(401)
  const turnover = await reset(sessionId, 'ADMIN', 'QA turnover')
  expect(turnover.statusCode).toBe(200)
  expect((await getCart(secondDiner)).json()).toMatchObject({ sessionEnded: true, submittedOrders: [], sessionTotalMinor: 0 })
  const next = sessionHeaders((await join(turnover.json().joinCode)).json())
  const newDiner = await app.inject({ url: url + '?orderId=' + first, headers: next })
  expect(newDiner.json()).toMatchObject({ sessionEnded: false, submittedOrders: [], sessionTotalMinor: 0, ticket: null })
  const staff = await app.inject({ url: historyUrl, headers: kitchenHeaders })
  expect(staff.statusCode).toBe(200)
  expect(staff.headers['cache-control']).toBe('no-store')
  expect(staff.json().orders).toEqual(updated.submittedOrders)
})

test('expiry closes abandoned carts without touching submitted tickets', async () => {
  await add()
  const ticket = (await submit()).json()
  const expired = (await add()).json()
  const old = new Date(Date.now() - 3 * 60 * 60 * 1000)
  await db.tableOrder.updateMany({ where: { tableId }, data: { updatedAt: old } })
  expect((await getCart()).json().order).toBeNull()
  expect((await db.tableOrder.findUniqueOrThrow({ where: { id: expired.id } })).status).toBe('CANCELLED')
  expect((await db.tableOrder.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe('SUBMITTED')
})

test('reset cannot race checkout past an active ticket', async () => {
  const { id, version } = (await add()).json()
  const key = randomUUID()
  const [checkout, turnover] = await Promise.all([submit(key, { cartId: id, version }), reset(sessionId)])
  expect([checkout.statusCode, turnover.statusCode].sort()).toEqual(
    checkout.statusCode === 201 ? [201, 409] : [200, 409],
  )
  if (turnover.statusCode === 200) {
    const current = sessionHeaders((await join(turnover.json().joinCode)).json())
    expect((await getCart(current)).json().order).toBeNull()
  } else {
    expect((await db.tableOrder.findUniqueOrThrow({ where: { id } })).status).toBe('SUBMITTED')
  }
})

test('only admin overrides are audited and prior successful checkout retries still replay', async () => {
  const { id, version } = (await add()).json()
  const key = randomUUID()
  const checkout = await submit(key, { cartId: id, version })
  expect(checkout.statusCode).toBe(201)
  expect((await reset(sessionId)).json().code).toBe('ACTIVE_TICKETS')
  expect((await reset(sessionId, 'KITCHEN', 'Tried override')).statusCode).toBe(403)
  const override = await reset(sessionId, 'ADMIN', 'Party moved to another table')
  expect(override.statusCode).toBe(200)
  expect(await db.diningSession.findUniqueOrThrow({ where: { id: override.json().id } })).toMatchObject({
    startedBy: 'qa-staff', overrideReason: 'Party moved to another table',
  })
  expect((await submit(key, { cartId: id, version })).json()).toEqual(checkout.json())
  expect((await db.tableOrder.findUniqueOrThrow({ where: { id } })).status).toBe('SUBMITTED')
  const tickets = await app.inject({ url: '/kitchen/orders', headers: kitchenHeaders })
  expect(tickets.json()).toContainEqual(expect.objectContaining({ id, previousSeating: true }))
})

test('only authorized staff can start sessions and concurrent resets cannot rotate twice', async () => {
  expect((await app.inject('/staff/table-sessions')).statusCode).toBe(401)
  expect((await app.inject({ method: 'POST', url: `/staff/table-sessions/${tableId}/reset`, payload: {} })).statusCode).toBe(401)
  const results = await Promise.all([reset(sessionId), reset(sessionId)])
  expect(results.map(result => result.statusCode).sort()).toEqual([200, 409])
  expect(await db.diningSession.count({ where: { tableId, endedAt: null } })).toBe(1)
})

test('failed joins and anonymous writes do not consume diners’ ordering quota', async () => {
  const current = await db.diningSession.findUniqueOrThrow({ where: { id: sessionId } })
  const invalid = current.joinCode === '0000000000' ? 'FFFFFFFFFF' : '0000000000'
  for (let index = 0; index < 31; index++) {
    expect((await join(invalid)).statusCode).toBe(index < 29 ? 403 : 429)
    expect((await add(1, {})).statusCode).toBe(403)
  }
  expect((await add(1)).statusCode).toBe(200)
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
    const { order } = (await getCart()).json()
    const key = randomUUID()
    const checkout = { cartId: order.id, version: order.version }
    const result = await submit(key, checkout)
    expect(result.statusCode).toBe(201)
    const event = await nextEvent()
    expect(event).toMatch(/^event: tickets\ndata: \[/)
    expect(event).toContain(result.json().id)
    expect((await submit(key, checkout)).json()).toEqual(result.json())
    const duplicate = await Promise.race([
      reader.read().then(() => true),
      new Promise<false>(resolve => setTimeout(() => resolve(false), 100)),
    ])
    expect(duplicate).toBe(false)
    await reader.cancel()
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
})
