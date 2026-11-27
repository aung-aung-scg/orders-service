import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { Writable } from 'node:stream'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { buildApp } from '../src/app.js'
import { createDb } from '../src/lib/db.js'
import { hashStaffPassword, verifyStaffPassword } from '../src/lib/staff-password.js'

const db = createDb()
const key = randomUUID()
const kitchenKey = randomUUID()
const slug = 'platform-test-' + randomUUID().slice(0, 10)
const superPassword = randomUUID()
const supervisor = { id: randomUUID(), username: slug, role: 'SUPER_ADMIN' as const }
const logs: string[] = []
const logStream = new Writable({ write(chunk, _encoding, done) { logs.push(chunk.toString()); done() } })
const app = buildApp({ db, kitchenApiKey: kitchenKey, platformApiKey: key, logger: true, logStream })
const base = '/platform/restaurants'
const platform = { 'x-platform-api-key': key, 'x-platform-actor-id': supervisor.id, 'x-platform-actor-version': '0' }
let restaurantId: string
let issued: { username: string; password: string }[]

beforeAll(async () => {
  await db.staffUser.create({ data: { ...supervisor, passwordHash: await hashStaffPassword(superPassword) } })
  const response = await app.inject({
    method: 'POST', url: base, headers: platform, payload: { slug, name: 'Platform test', timezone: 'Asia/Bangkok' },
  })
  expect(response.statusCode).toBe(201)
  expect(response.headers['cache-control']).toBe('no-store')
  const body = response.json()
  restaurantId = body.restaurant.id
  issued = body.credentials
})

afterAll(async () => {
  try {
    await app.close()
    await db.$transaction([
      db.platformAudit.deleteMany({ where: { actor: supervisor.id } }),
      db.diningTable.deleteMany({ where: { restaurant: { slug } } }),
      db.staffUser.deleteMany({ where: { OR: [{ id: supervisor.id }, { restaurant: { slug } }] } }),
      db.restaurant.deleteMany({ where: { slug } }),
    ])
  } finally {
    await db.$disconnect()
  }
})

function staffLogin(username: string, password: string) {
  return app.inject({
    method: 'POST', url: '/auth/verify', headers: { 'x-kitchen-api-key': kitchenKey, 'x-restaurant-id': restaurantId },
    payload: { username, password },
  })
}

function staffHeaders(id: string, credentialVersion: number) {
  return {
    'x-kitchen-api-key': kitchenKey, 'x-restaurant-id': restaurantId,
    'x-staff-id': id, 'x-staff-version': String(credentialVersion),
  }
}

test('platform endpoints enforce the distinct key and current SUPER_ADMIN role', async () => {
  const staff = await db.staffUser.findMany({ where: { restaurantId }, select: { id: true } })
  const requests = [
    { method: 'GET', url: base },
    { method: 'POST', url: base, payload: { name: 'Denied', slug } },
    { method: 'PATCH', url: base + '/' + restaurantId, payload: { active: false } },
    { method: 'POST', url: base + '/' + restaurantId + '/reset-password', payload: { username: 'admin' } },
  ] as const
  for (const request of requests) {
    expect((await app.inject(request)).statusCode).toBe(401)
    expect((await app.inject({ ...request, headers: { ...platform, 'x-platform-api-key': kitchenKey } })).statusCode).toBe(401)
    for (const { id } of staff) {
      expect((await app.inject({ ...request, headers: { ...platform, 'x-platform-actor-id': id } })).statusCode).toBe(403)
    }
    expect((await app.inject({ ...request, headers: { 'x-platform-api-key': key } })).statusCode).toBe(403)
    expect((await app.inject({ ...request, headers: { ...platform, 'x-platform-actor-version': '1' } })).statusCode).toBe(403)
  }
  const platformLogin = (username: string, password: string) => app.inject({
    method: 'POST', url: '/platform/auth/verify', headers: platform, payload: { username, password },
  })
  expect((await platformLogin(supervisor.username, superPassword)).json()).toMatchObject({ id: supervisor.id, role: 'SUPER_ADMIN' })
  for (const { username, password } of issued) {
    expect((await platformLogin(username, password)).statusCode).toBe(401)
  }
})

test('creation stores two hashed credentials, rejects bad slugs, and discloses passwords once', async () => {
  const staff = await db.staffUser.findMany({ where: { restaurantId }, orderBy: { username: 'asc' } })
  expect(staff.map(({ username, role, mustChangePassword }) => ({ username, role, mustChangePassword }))).toEqual([
    { username: 'admin', role: 'ADMIN', mustChangePassword: true },
    { username: 'kitchen', role: 'KITCHEN', mustChangePassword: true },
  ])
  expect(issued.length).toBe(2)
  const listed = await app.inject({ url: base, headers: platform })
  expect(listed.statusCode).toBe(200)
  expect(listed.json()).toContainEqual(expect.objectContaining({ id: restaurantId, slug }))
  const audit = await db.platformAudit.findMany({ where: { restaurantId } })
  expect(audit).toEqual([expect.objectContaining({ action: 'CREATE', actor: supervisor.id })])
  for (const { username, password } of issued) {
    expect(password.length).toBe(16)
    const stored = staff.find(user => user.username === username)!
    expect(stored.passwordHash === password).toBe(false)
    expect(await verifyStaffPassword(password, stored.passwordHash)).toBe(true)
    expect([listed.body, JSON.stringify(audit), logs.join('')].some(value => value.includes(password))).toBe(false)
  }
  for (const [candidate, status] of [[slug, 409], ['platform', 400], ['menu-images', 400], ['bad--slug', 400], ['A'.repeat(41), 400]] as const) {
    expect((await app.inject({
      method: 'POST', url: base, headers: platform, payload: { name: 'Invalid', slug: candidate },
    })).statusCode).toBe(status)
  }
})

test('suspending blocks booking, QR pages and staff login until reactivation', async () => {
  const update = (payload: object) => app.inject({
    method: 'PATCH', url: base + '/' + restaurantId, headers: platform, payload,
  })
  const qrToken = randomUUID()
  await db.diningTable.create({ data: { number: 1, restaurantId, qrToken } })
  const admin = issued.find(user => user.username === 'admin')!
  expect((await update({ settings: { openTime: '23:00' } })).statusCode).toBe(400)
  expect((await update({ settings: { timeZone: 'Asia/Bangkok' } })).statusCode).toBe(400)
  expect((await update({ settings: { slotMinutes: 45 } })).json()).toMatchObject({ slotMinutes: 45 })
  expect((await update({ active: false })).json()).toMatchObject({ active: false })
  expect((await update({ active: false })).statusCode).toBe(200)
  expect((await app.inject('/restaurants/' + slug)).json()).toMatchObject({ code: 'RESTAURANT_UNAVAILABLE' })
  expect((await app.inject('/restaurants/' + slug + '/availability')).statusCode).toBe(404)
  expect((await app.inject({ method: 'POST', url: '/restaurants/' + slug + '/reservations' })).statusCode).toBe(404)
  expect((await app.inject('/t/' + qrToken)).json()).toMatchObject({ code: 'RESTAURANT_UNAVAILABLE' })
  expect((await staffLogin(admin.username, admin.password)).statusCode).toBe(404)
  expect((await app.inject('/restaurants')).json()).not.toContainEqual({ slug })
  expect((await update({ active: true })).json()).toMatchObject({ active: true })
  expect((await staffLogin(admin.username, admin.password)).statusCode).toBe(200)
  expect((await app.inject('/restaurants')).json()).toContainEqual({ slug })
  const audits = await db.platformAudit.findMany({ where: { restaurantId }, orderBy: { createdAt: 'asc' } })
  expect(audits.map(audit => audit.action)).toEqual(['CREATE', 'SUSPEND', 'REACTIVATE'])
})

test('reset and password change revoke earlier sessions and keep passwords out of logs and audit', async () => {
  const admin = issued.find(user => user.username === 'admin')!
  const old = (await staffLogin(admin.username, admin.password)).json()
  const session = (headers: Record<string, string>) => app.inject({ url: '/auth/session', headers })
  expect((await session(staffHeaders(old.id, old.credentialVersion))).json()).toMatchObject({ mustChangePassword: true })
  const reset = await app.inject({
    method: 'POST', url: base + '/' + restaurantId + '/reset-password', headers: platform, payload: { username: 'admin' },
  })
  expect(reset.statusCode).toBe(200)
  expect(reset.headers['cache-control']).toBe('no-store')
  const { password } = reset.json()
  expect(password.length).toBe(16)
  expect((await session(staffHeaders(old.id, old.credentialVersion))).statusCode).toBe(401)
  expect((await staffLogin('admin', admin.password)).statusCode).toBe(401)
  const temporary = (await staffLogin('admin', password)).json()
  expect(temporary.mustChangePassword).toBe(true)
  const headers = staffHeaders(temporary.id, temporary.credentialVersion)
  const change = (currentPassword: string, newPassword: string) => app.inject({
    method: 'POST', url: '/auth/change-password', headers, payload: { currentPassword, newPassword },
  })
  expect((await change(password, 'short')).statusCode).toBe(400)
  expect((await change(password, password)).statusCode).toBe(400)
  const replacement = randomUUID()
  expect((await change('wrong', replacement)).statusCode).toBe(400)
  const changed = await change(password, replacement)
  expect(changed.statusCode).toBe(200)
  expect((await session(headers)).statusCode).toBe(401)
  expect((await staffLogin('admin', password)).statusCode).toBe(401)
  expect((await staffLogin('admin', replacement)).json()).toMatchObject({
    mustChangePassword: false, credentialVersion: changed.json().credentialVersion,
  })
  const audit = await db.platformAudit.findMany({ where: { restaurantId, action: 'RESET_PASSWORD' } })
  expect(audit).toEqual([expect.objectContaining({ actor: supervisor.id, action: 'RESET_PASSWORD' })])
  const logAndAudit = logs.join('') + JSON.stringify(audit)
  expect([superPassword, password, replacement, ...issued.map(value => value.password)]
    .some(secret => logAndAudit.includes(secret))).toBe(false)
})
