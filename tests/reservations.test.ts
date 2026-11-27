import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeEach, expect, test, vi } from 'vitest'
import { buildApp } from '../src/app.js'
import { createDb } from '../src/lib/db.js'
import { minute, readBookingConfig, shiftDay } from '../src/lib/booking.js'
import { reservationAccess } from '../src/lib/reservation-access.js'

const db = createDb()
const config = readBookingConfig()
const key = randomUUID()
const app = buildApp({ db, kitchenApiKey: key })
const signer = reservationAccess(key)
const authorization = (code: string) => ({ 'x-reservation-access': signer.issue(code) })
const run = randomUUID()
let tableId: string
const date = shiftDay(config.localParts(Date.now()).day, 5)
const start = config.instant(date, config.open)!
const end = start + config.env.BOOKING_DURATION_MINUTES * minute

test('availability summary distinguishes closed, elapsed, and genuinely full slots', async () => {
  const currentDay = config.localParts(Date.now()).day
  const closing = config.instant(currentDay, config.close)!
  const last = (await availability(10, currentDay)).at(-1)!
  const summary = (day: string) => app.inject(`/availability?date=${day}&partySize=10&summary=1`)
  const clock = vi.spyOn(Date, 'now').mockReturnValue(closing)
  try {
    expect((await summary(currentDay)).json()).toMatchObject({ state: 'CLOSED' })
    clock.mockReturnValue(closing - 1)
    expect((await summary(currentDay)).json()).toMatchObject({ state: 'NO_REMAINING_SLOTS' })
    clock.mockReturnValue(Date.parse(last.startsAt) - config.env.BOOKING_MIN_LEAD_MINUTES * minute)
    const candidates = await db.diningTable.findMany({ where: { active: true, capacity: { gte: 10 } } })
    await db.reservation.createMany({
      data: candidates.map(table => record(table.id, Date.parse(last.startsAt), Date.parse(last.endsAt))),
    })
    expect((await summary(currentDay)).json()).toMatchObject({ state: 'FULLY_BOOKED' })
    expect((await summary(shiftDay(currentDay, 1))).json()).toMatchObject({ state: 'AVAILABLE' })
  } finally {
    clock.mockRestore()
  }
})

beforeEach(async () => {
  const table = await db.diningTable.create({ data: {
    restaurantId: 'default', number: randomInt(1_000_000_000, 2_000_000_000), qrToken: randomBytes(24).toString('base64url'), capacity: 10,
  } })
  tableId = table.id
})
afterEach(async () => {
  await db.idempotencyRecord.deleteMany({ where: { key: { startsWith: `booking:${run}:` } } })
  await db.reservation.deleteMany({ where: { OR: [{ tableId }, { guestName: run }] } })
  await db.diningTable.delete({ where: { id: tableId } })
})

function create(startsAt = start, partySize = 10, key = randomUUID(), slug?: string) {
  return app.inject({
    method: 'POST', url: slug ? '/restaurants/' + slug + '/reservations' : '/reservations',
    headers: { 'idempotency-key': `${run}:${key}` },
    payload: { startsAt: new Date(startsAt).toISOString(), partySize, guestName: run, phone: '0800000000' },
  })
}

test('exactly one of 20 concurrent requests can book the last table', async () => {
  const otherTables = await db.diningTable.findMany({ where: { active: true, capacity: { gte: 10 }, id: { not: tableId } } })
  await db.reservation.createMany({ data: otherTables.map(table => record(table.id, start, end)) })
  const responses = await Promise.all(Array.from({ length: 20 }, () => create()))
  expect(responses.filter(response => response.statusCode === 201)).toHaveLength(1)
  expect(responses.filter(response => response.statusCode === 409 && response.json().code === 'SLOT_UNAVAILABLE')).toHaveLength(19)
})

test('the database rejects overlaps and permits adjacent bookings', async () => {
  await db.reservation.create({ data: record(tableId, start, end) })
  await expect(db.reservation.create({ data: record(tableId, start + minute, end + minute) })).rejects.toThrow()
  await expect(db.reservation.create({ data: record(tableId, end, end + minute) })).resolves.toBeDefined()
})

test('idempotent requests return the same booking and create one row', async () => {
  const idempotencyKey = randomUUID()
  const [first, second] = await Promise.all([create(start, 10, idempotencyKey), create(start, 10, idempotencyKey)])
  expect(first.statusCode).toBe(201)
  expect(second.statusCode).toBe(201)
  expect(first.json()).toMatchObject({ code: second.json().code, grant: second.json().grant })
  expect(await db.reservation.count({ where: { guestName: run } })).toBe(1)
  const { code, grant } = first.json()
  expect((await app.inject({ url: '/reservations/' + code, headers: { 'x-reservation-access': grant } })).json())
    .toMatchObject({ code, canCancel: true })
})

test('rejects past, off-grid, closed, distant, and oversized bookings', async () => {
  const invalid = [
    [config.instant(shiftDay(date, -6), config.open)!, 10],
    [start + minute, 10],
    [config.instant(date, config.close)!, 10],
    [config.instant(shiftDay(date, config.env.BOOKING_MAX_DAYS_AHEAD), config.open)!, 10],
    [start, config.env.BOOKING_MAX_PARTY + 1],
  ]
  for (const [timestamp, party] of invalid) expect((await create(timestamp, party)).statusCode).toBe(400)
})

test('cancelling releases the slot and respects the cutoff', async () => {
  const otherTables = await db.diningTable.findMany({ where: { active: true, capacity: { gte: 10 }, id: { not: tableId } } })
  await db.reservation.createMany({ data: otherTables.map(table => record(table.id, start, end)) })
  const result = await create()
  expect(result.statusCode).toBe(201)
  const cancel = (code: string) => app.inject({ method: 'POST', url: `/reservations/${code}/cancel`, headers: authorization(code) })
  expect((await availability(10))[0].available).toBe(false)
  expect((await cancel(result.json().code)).statusCode).toBe(200)
  expect((await availability(10))[0].available).toBe(true)
  const late = await db.reservation.create({ data: record(tableId, Date.now(), Date.now() + minute) })
  expect((await cancel(late.code)).statusCode).toBe(409)
})

test('cancellation eligibility and mutation agree before, exactly at, and after the deadline', async () => {
  const deadline = start - config.env.BOOKING_CANCEL_CUTOFF_MINUTES * minute
  for (const offset of [-1, 0, 1]) {
    const booking = await db.reservation.create({ data: record(tableId, start, end) })
    const clock = vi.spyOn(Date, 'now').mockReturnValue(deadline + offset)
    try {
      const path = '/reservations/' + booking.code
      const info = await app.inject({ url: path, headers: authorization(booking.code) })
      expect(info.json()).toMatchObject({ canCancel: offset < 0, cancellationDeadline: new Date(deadline).toISOString() })
      const response = await app.inject({ method: 'POST', url: path + '/cancel', headers: authorization(booking.code) })
      expect(response.statusCode).toBe(offset < 0 ? 200 : 409)
    } finally {
      clock.mockRestore()
      await db.reservation.delete({ where: { id: booking.id } })
    }
  }
})

test('a staff seating and guest cancellation can only succeed once', async () => {
  const booking = await db.reservation.create({ data: record(tableId, start, end) })
  const results = await Promise.all([
    app.inject({ method: 'POST', url: '/reservations/' + booking.code + '/cancel', headers: authorization(booking.code) }),
    app.inject({ method: 'PATCH', url: `/staff/reservations/${booking.id}/status`,
      headers: { 'x-kitchen-api-key': key, 'x-restaurant-id': 'default' }, payload: { status: 'SEATED' } }),
  ])
  expect(results.map(result => result.statusCode).sort()).toEqual([200, 409])
  const details = await app.inject({ url: '/reservations/' + booking.code, headers: authorization(booking.code) })
  expect(details.json().canCancel).toBe(false)
})

test('lookup requires a matching phone and a separate valid grant for each reservation', async () => {
  const one = await db.reservation.create({ data: record(tableId, start, end) })
  const two = await db.reservation.create({ data: record(tableId, end, end + minute) })
  const lookup = (grants: string[], phone = one.phone) => app.inject({
    method: 'POST', url: '/reservations/lookup', payload: { phone, grants },
  })
  const verify = (code: string, phone: string) => app.inject({
    method: 'POST', url: `/reservations/${code}/verify`, payload: { phone },
  })
  expect((await lookup([])).json()).toEqual([])
  const wrong = await verify(one.code, '1234567890')
  expect(wrong.statusCode).toBe(403)
  expect((await verify(randomUUID(), one.phone)).json()).toEqual(wrong.json())
  const first = (await verify(one.code, '080-000-0000')).json()
  const second = (await verify(two.code, two.phone)).json()
  expect(first.maxAge).toBeGreaterThan(0)
  expect((await lookup([first.grant])).json().map((row: { code: string }) => row.code)).toEqual([one.code])
  const list = await lookup([first.grant, second.grant])
  expect(list.headers['cache-control']).toBe('no-store')
  expect(list.json().map((row: { code: string }) => row.code)).toEqual([one.code, two.code])
  expect(list.json()[0]).not.toHaveProperty('phone')
  expect((await lookup([first.grant, second.grant], '1234567890')).json()).toEqual([])
  expect((await lookup([signer.issue(one.code, Date.now() - 86401_000), second.grant + 'x'])).json()).toEqual([])
  for (const [method, suffix] of [['GET', ''], ['POST', '/cancel'], ['PATCH', '/reschedule']] as const) {
    const response = await app.inject({
      method, url: '/reservations/' + two.code + suffix, headers: { 'x-reservation-access': first.grant },
    })
    expect(response.statusCode).toBe(403)
  }
  expect((await app.inject({ method: 'POST', url: '/reservations/' + one.code + '/cancel' })).statusCode).toBe(403)
})

test('phone verification is rate-limited for a reservation', async () => {
  const booking = await db.reservation.create({ data: record(tableId, start, end) })
  const url = '/reservations/' + booking.code + '/verify'
  for (let attempt = 0; attempt < 10; attempt++) {
    expect((await app.inject({ method: 'POST', url, payload: { phone: '1234567890' }, remoteAddress: '192.0.2.50' })).statusCode).toBe(403)
  }
  expect((await app.inject({ method: 'POST', url, payload: { phone: booking.phone }, remoteAddress: '192.0.2.51' })).statusCode).toBe(429)
})

const nextDate = shiftDay(date, 1)
const target = config.instant(nextDate, config.open + config.env.BOOKING_SLOT_MINUTES)!

function move(booking: { code: string; updatedAt: Date }, startsAt = target) {
  return app.inject({
    method: 'PATCH', url: `/reservations/${booking.code}/reschedule`, headers: authorization(booking.code),
    payload: { startsAt: new Date(startsAt).toISOString(), revision: booking.updatedAt.toISOString() },
  })
}

test('rescheduling changes date and time once and releases the old slot', async () => {
  const booking = await db.reservation.create({ data: { ...record(tableId, start, end), partySize: 10 } })
  const overlapping = await app.inject({
    url: `/reservations/${booking.code}/availability?date=${date}`, headers: authorization(booking.code),
  })
  expect(overlapping.json()).toContainEqual(expect.objectContaining({
    startsAt: new Date(start + config.env.BOOKING_SLOT_MINUTES * minute).toISOString(),
  }))
  const results = await Promise.all([move(booking), move(booking)])
  expect(results.map(result => result.statusCode).sort()).toEqual([200, 409])
  const latest = await app.inject({ url: '/reservations/' + booking.code, headers: authorization(booking.code) })
  expect(latest.json()).toMatchObject({ code: booking.code, startsAt: new Date(target).toISOString(), partySize: 10 })
  expect(latest.json().revision).not.toBe(booking.updatedAt.toISOString())
  expect(await db.reservation.count({ where: { code: booking.code } })).toBe(1)
  expect((await availability(10))[0].available).toBe(true)
})

test('a full target leaves the original intact and the 30-minute cutoff is strict', async () => {
  const booking = await db.reservation.create({ data: { ...record(tableId, start, end), partySize: 10 } })
  const tables = await db.diningTable.findMany({ where: { active: true, capacity: { gte: 10 } } })
  await db.reservation.createMany({ data: tables.map(table => record(table.id, target, target + end - start)) })
  expect((await move(booking)).json().code).toBe('SLOT_UNAVAILABLE')
  expect(await db.reservation.findUniqueOrThrow({ where: { id: booking.id } }))
    .toMatchObject({ startsAt: booking.startsAt, endsAt: booking.endsAt, tableId: booking.tableId, updatedAt: booking.updatedAt })
  expect((await move(booking, target + minute)).statusCode).toBe(400)
  const clock = vi.spyOn(Date, 'now').mockReturnValue(start - 30 * minute)
  try {
    const result = await app.inject({ url: '/reservations/' + booking.code, headers: authorization(booking.code) })
    expect(result.json()).toMatchObject({ canReschedule: false, canCancel: false })
    expect((await move(booking, target + end - start)).json().code).toBe('CANNOT_RESCHEDULE')
    clock.mockReturnValue(start - 30 * minute - 1)
    expect((await move(booking, target + end - start)).statusCode).toBe(200)
  } finally {
    clock.mockRestore()
  }
})

test('concurrent moves for the last fitting table keep the losing reservation in place', async () => {
  const others = await db.diningTable.findMany({ where: { active: true, capacity: { gte: 10 }, id: { not: tableId } } })
  await db.reservation.createMany({ data: others.map(table => record(table.id, target, target + end - start)) })
  const first = await db.reservation.create({ data: { ...record(tableId, start, end), partySize: 10 } })
  const second = await db.reservation.create({ data: { ...record(tableId, end, end + minute), partySize: 10 } })
  const results = await Promise.all([move(first), move(second)])
  expect(results.map(result => result.statusCode).sort()).toEqual([200, 409])
  const loser = results[0].statusCode === 409 ? first : second
  const unchanged = await db.reservation.findUniqueOrThrow({ where: { id: loser.id } })
  expect(unchanged).toMatchObject({ restaurantId: 'default', tableId, startsAt: loser.startsAt, endsAt: loser.endsAt })
})

test('22:00 Bangkok is stored as 15:00 UTC when the restaurant closes later', async () => {
  const restaurant = await db.restaurant.create({ data: { slug: 'late-' + randomUUID().slice(0, 12), name: 'Late', closeTime: '23:59' } })
  try {
    await db.diningTable.create({ data: { restaurantId: restaurant.id, number: 1, qrToken: randomUUID(), capacity: 10 } })
    const start = Date.parse(date + 'T22:00:00+07:00')
    const response = await create(start, 10, randomUUID(), restaurant.slug)
    expect(response.statusCode).toBe(201)
    expect(response.json().startsAt).toBe(date + 'T15:00:00.000Z')
    const stored = await db.reservation.findUniqueOrThrow({ where: { code: response.json().code } })
    expect(config.localParts(stored.startsAt.getTime()).day).toBe(date)
    const listed = await app.inject({ url: `/staff/reservations?date=${date}`, headers: { 'x-kitchen-api-key': key, 'x-restaurant-id': restaurant.id } })
    expect(listed.json()).toContainEqual(expect.objectContaining({ id: stored.id, startsAt: date + 'T15:00:00.000Z' }))
  } finally {
    await db.reservation.deleteMany({ where: { restaurantId: restaurant.id } })
    await db.diningTable.deleteMany({ where: { restaurantId: restaurant.id } })
    await db.idempotencyRecord.deleteMany({ where: { key: { startsWith: 'restaurant-booking:[' + JSON.stringify(restaurant.id) + ',' } } })
    await db.restaurant.delete({ where: { id: restaurant.id } })
  }
})

test('staff listing is protected and stale or illegal transitions return 409', async () => {
  const booking = await db.reservation.create({ data: record(tableId, start, end) })
  const headers = { 'x-kitchen-api-key': key, 'x-restaurant-id': 'default' }
  const list = '/staff/reservations?date=' + date
  const url = `/staff/reservations/${booking.id}/status`
  const setStatus = (status: string) => app.inject({ method: 'PATCH', url, headers, payload: { status } })
  expect((await app.inject(list)).statusCode).toBe(401)
  expect((await app.inject({ method: 'PATCH', url, payload: { status: 'SEATED' } })).statusCode).toBe(401)
  const response = await app.inject({ url: list, headers })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toContainEqual(expect.objectContaining({ id: booking.id, table: { number: expect.any(Number) } }))
  expect((await setStatus('COMPLETED')).statusCode).toBe(409)
  const results = await Promise.all([setStatus('SEATED'), setStatus('SEATED')])
  expect(results.map(result => result.statusCode).sort()).toEqual([200, 409])
  expect((await setStatus('CANCELLED')).statusCode).toBe(409)
  expect((await setStatus('COMPLETED')).statusCode).toBe(200)
})
afterAll(async () => {
  await app.close()
  await db.$disconnect()
})

function record(id: string, startsAt: number, endsAt: number) {
  return { restaurantId: 'default', tableId: id, startsAt: new Date(startsAt), endsAt: new Date(endsAt), guestName: run, partySize: 6, phone: '0800000000', code: randomUUID() }
}

async function availability(size: number, day = date) {
  const response = await app.inject(`/availability?date=${day}&partySize=${size}`)
  expect(response.statusCode).toBe(200)
  return response.json<{ startsAt: string; endsAt: string; available: boolean }[]>()
}

test('availability accounts for overlapping bookings and party size', async () => {
  const tables = await db.diningTable.findMany({ where: { active: true, capacity: { gte: 6 } } })
  const small = await db.diningTable.create({ data: {
    restaurantId: 'default', number: randomInt(1_000_000_000, 2_000_000_000), qrToken: randomBytes(24).toString('base64url'), capacity: 2,
  } })
  try {
    await db.reservation.createMany({ data: tables.map(table => record(table.id, start, end)) })
    expect((await availability(6))[0].available).toBe(false)
    expect((await availability(2))[0].available).toBe(true)
    expect((await availability(6)).find(slot => Date.parse(slot.startsAt) === end)?.available).toBe(true)
    expect((await availability(2, shiftDay(date, -6))).every(slot => !slot.available)).toBe(true)
  } finally {
    await db.diningTable.delete({ where: { id: small.id } })
  }
})
