import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { buildApp } from '../src/app.js'
import { createDb } from '../src/lib/db.js'
import { hashStaffPassword } from '../src/lib/staff-password.js'

const db = createDb()
const key = randomUUID()
const username = 'staff-test-' + randomUUID()
const password = randomUUID()
const app = buildApp({ db, kitchenApiKey: key })
let id: string

beforeAll(async () => {
  const staff = await db.staffUser.create({
    data: { username, role: 'KITCHEN', passwordHash: await hashStaffPassword(password) },
  })
  id = staff.id
})

afterAll(async () => {
  await app.close()
  try {
    if (id) await db.staffUser.delete({ where: { id } })
  } finally {
    await db.$disconnect()
  }
})

function verify(payload: { username: string; password: string }, authorized = true) {
  return app.inject({
    method: 'POST',
    url: '/auth/verify',
    headers: authorized ? { 'x-kitchen-api-key': key } : {},
    payload,
  })
}

test('returns staff identity for valid credentials', async () => {
  const response = await verify({ username, password })
  expect(response.statusCode).toBe(200)
  expect(response.json()).toEqual({ id, username, role: 'KITCHEN' })
})

test('returns an identical 401 for wrong passwords and unknown users', async () => {
  const wrong = await verify({ username, password: randomUUID() })
  const unknown = await verify({ username: randomUUID(), password })
  expect(wrong.statusCode).toBe(401)
  expect(unknown.statusCode).toBe(401)
  expect(unknown.json()).toEqual(wrong.json())
})

test('requires the kitchen API key to verify credentials', async () => {
  const response = await verify({ username, password }, false)
  expect(response.statusCode).toBe(401)
  expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' })
})
