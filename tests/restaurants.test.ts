import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { buildApp } from '../src/app.js'
import { createDb } from '../src/lib/db.js'
import { hashStaffPassword } from '../src/lib/staff-password.js'
import { reservationAccess } from '../src/lib/reservation-access.js'
import { readBookingConfig, shiftDay } from '../src/lib/booking.js'

const db = createDb()
const key = randomUUID()
const app = buildApp({ db, kitchenApiKey: key })
const run = randomUUID().slice(0, 12)
const restaurantIds: string[] = []
const aHeaders = headers('a-' + run)
const bHeaders = headers('b-' + run)
let a: Awaited<ReturnType<typeof fixture>>
let b: Awaited<ReturnType<typeof fixture>>

function headers(id: string) {
  return { 'x-kitchen-api-key': key, 'x-restaurant-id': id }
}

async function fixture(side: 'a' | 'b') {
  const id = side + '-' + run
  const restaurant = await db.restaurant.create({ data: { id, slug: id, name: 'Restaurant ' + side } })
  restaurantIds.push(id)
  const table = await db.diningTable.create({ data: { restaurantId: id, number: 42, qrToken: randomUUID() } })
  const menu = await db.menuItem.create({ data: { restaurantId: id, name: 'Menu ' + side, priceMinor: 100 } })
  const session = await db.diningSession.create({ data: {
    restaurantId: id, tableId: table.id, startedBy: 'staff', joinCode: randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase(),
    accessToken: randomUUID().replaceAll('-', ''),
  } })
  const ticket = await db.tableOrder.create({ data: {
    restaurantId: id, tableId: table.id, sessionId: session.id, status: 'SUBMITTED', submittedAt: new Date(),
  } })
  const { instant, localParts } = readBookingConfig(restaurant)
  const day = shiftDay(localParts(Date.now()).day, 3)
  const reservation = await db.reservation.create({ data: {
    restaurantId: id, tableId: table.id, partySize: 2, startsAt: new Date(instant(day, 600)!),
    endsAt: new Date(instant(day, 690)!), guestName: 'Guest ' + side, phone: '0800000000', code: randomUUID(),
  } })
  const password = randomUUID()
  const staff = await db.staffUser.create({ data: {
    restaurantId: id, username: 'kitchen', role: 'KITCHEN', passwordHash: await hashStaffPassword(password),
  } })
  return { restaurant, table, menu, session, ticket, reservation, day, staff, password }
}

beforeAll(async () => {
  a = await fixture('a')
  b = await fixture('b')
})

afterAll(async () => {
  try {
    await app.close()
    const where = { restaurantId: { in: restaurantIds } }
    await db.$transaction([
      db.idempotencyRecord.deleteMany({ where: { OR: restaurantIds.map(id => ({
        key: { startsWith: 'restaurant-booking:[' + JSON.stringify(id) + ',' },
      })) } }),
      db.reservation.deleteMany({ where }),
      db.tableOrder.deleteMany({ where }),
      db.diningSession.deleteMany({ where }),
      db.diningTable.deleteMany({ where }),
      db.menuItem.deleteMany({ where }),
      db.staffUser.deleteMany({ where }),
      db.restaurant.deleteMany({ where: { id: { in: restaurantIds } } }),
    ])
  } finally {
    await db.$disconnect()
  }
})

test('staff lists and mutations are isolated across restaurant families', async () => {
  expect((await app.inject({ url: '/staff/menu', headers: { 'x-kitchen-api-key': key } })).statusCode).toBe(400)
  expect((await app.inject({ url: '/staff/menu', headers: headers('unknown') })).statusCode).toBe(404)
  for (const [url, own, other] of [
    ['/staff/menu', a.menu.id, b.menu.id],
    ['/tables', a.table.id, b.table.id],
    ['/staff/table-sessions', a.table.id, b.table.id],
    ['/kitchen/orders', a.ticket.id, b.ticket.id],
    ['/staff/reservations?date=' + a.day, a.reservation.id, b.reservation.id],
  ]) {
    const response = await app.inject({ url, headers: aHeaders })
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain(own)
    expect(response.body).not.toContain(other)
  }
  for (const request of [
    { method: 'PATCH', url: '/staff/menu/' + b.menu.id, payload: { name: 'Changed' } },
    { method: 'DELETE', url: '/staff/menu/' + b.menu.id + '/image' },
    { method: 'GET', url: '/tables/' + b.table.id + '/qr' },
    { method: 'GET', url: '/staff/table-sessions/' + b.table.id + '/orders' },
    { method: 'POST', url: '/staff/table-sessions/' + b.table.id + '/reset',
      payload: { expectedSessionId: b.session.id, actor: { id: a.staff.id, role: 'KITCHEN' } } },
    { method: 'PATCH', url: '/kitchen/orders/' + b.ticket.id + '/status', payload: { status: 'PREPARING' } },
    { method: 'PATCH', url: '/staff/reservations/' + b.reservation.id + '/status', payload: { status: 'SEATED' } },
  ] as const) {
    const response = await app.inject({ ...request, headers: aHeaders })
    expect(response.statusCode, request.url).toBe(404)
  }
  expect(a.table.number).toBe(b.table.number)
  expect(a.staff.username).toBe(b.staff.username)
  const payload = { username: a.staff.username, password: a.password }
  const loginA = await app.inject({ method: 'POST', url: '/auth/verify', headers: aHeaders, payload })
  expect(loginA.json()).toMatchObject({ id: a.staff.id, restaurantId: a.restaurant.id })
  expect((await app.inject({ method: 'POST', url: '/auth/verify', headers: bHeaders, payload })).statusCode).toBe(401)
})

test('public slugs, booking grants and QR sessions resolve only their own restaurant', async () => {
  const prefix = '/restaurants/' + a.restaurant.slug
  const publicInfo = await app.inject(prefix)
  expect(publicInfo.json()).toMatchObject({ name: a.restaurant.name })
  for (const slug of ['platform', 'missing-' + run]) {
    expect((await app.inject('/restaurants/' + slug)).statusCode).toBe(404)
  }
  await db.restaurant.update({ where: { id: b.restaurant.id }, data: { active: false } })
  try {
    expect((await app.inject('/restaurants/' + b.restaurant.slug)).statusCode).toBe(404)
    expect((await app.inject('/t/' + b.table.qrToken)).statusCode).toBe(404)
  } finally {
    await db.restaurant.update({ where: { id: b.restaurant.id }, data: { active: true } })
  }
  const grant = reservationAccess(key).issue(b.reservation.code)
  expect((await app.inject({
    url: prefix + '/reservations/' + b.reservation.code, headers: { 'x-reservation-access': grant },
  })).statusCode).toBe(404)
  expect((await app.inject({
    method: 'POST', url: prefix + '/reservations/lookup', payload: { phone: b.reservation.phone, grants: [grant] },
  })).json()).toEqual([])
  const bookingKey = randomUUID()
  const payload = {
    guestName: 'Same request', phone: '0800000000', partySize: 2, startsAt: a.reservation.endsAt.toISOString(),
  }
  const booked = await Promise.all([a, b].map(tenant => app.inject({
    method: 'POST', url: '/restaurants/' + tenant.restaurant.slug + '/reservations',
    headers: { 'idempotency-key': bookingKey }, payload,
  })))
  expect(booked.map(response => response.statusCode)).toEqual([201, 201])
  expect(booked[0].json().code).not.toBe(booked[1].json().code)

  const url = '/t/' + a.table.qrToken
  expect((await app.inject({ method: 'POST', url: url + '/join', payload: { code: b.session.joinCode } })).statusCode).toBe(403)
  const foreign = { 'x-dining-session': b.session.accessToken, 'x-dining-session-id': b.session.id }
  expect((await app.inject({ url, headers: foreign })).json()).toMatchObject({ sessionId: null, menu: [] })
  const own = { 'x-dining-session': a.session.accessToken, 'x-dining-session-id': a.session.id }
  const customer = (await app.inject({ url, headers: own })).json()
  expect(customer.restaurantName).toBe(a.restaurant.name)
  expect(customer.menu.map((item: { id: string }) => item.id)).toEqual([a.menu.id])
  expect((await app.inject({
    method: 'POST', url: url + '/order/items', headers: own, payload: { items: [{ menuItemId: b.menu.id, quantity: 1 }] },
  })).statusCode).toBe(409)
})

test('kitchen SSE filters snapshots and emits updates only to the matching restaurant', async () => {
  const address = await app.listen({ port: 0, host: '127.0.0.1' })
  const abort = new AbortController()
  async function subscribe(headers: Record<string, string>) {
    const response = await fetch(address + '/kitchen/stream', { headers, signal: abort.signal })
    expect(response.ok).toBe(true)
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ''
    return async () => {
      while (!buffer.includes('\n\n')) {
        const chunk = await reader.read()
        if (chunk.done) throw new Error('Kitchen stream closed early')
        buffer += chunk.value
      }
      const end = buffer.indexOf('\n\n')
      const event = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      return JSON.parse(event.split('\ndata: ')[1])
    }
  }
  try {
    const [readA, readB] = await Promise.all([subscribe(aHeaders), subscribe(bHeaders)])
    expect(await readA()).toEqual([expect.objectContaining({ id: a.ticket.id, status: 'SUBMITTED' })])
    expect(await readB()).toEqual([expect.objectContaining({ id: b.ticket.id, status: 'SUBMITTED' })])
    for (const [ticket, headers, read] of [[a.ticket, aHeaders, readA], [b.ticket, bHeaders, readB]] as const) {
      expect((await app.inject({
        method: 'PATCH', url: '/kitchen/orders/' + ticket.id + '/status', headers, payload: { status: 'PREPARING' },
      })).statusCode).toBe(200)
      expect(await read()).toEqual([expect.objectContaining({ id: ticket.id, status: 'PREPARING' })])
    }
    await app.inject({ method: 'PATCH', url: '/kitchen/orders/' + a.ticket.id + '/status', headers: aHeaders, payload: { status: 'READY' } })
    expect(await readA()).toEqual([expect.objectContaining({ id: a.ticket.id, status: 'READY' })])
  } finally {
    abort.abort()
  }
})
