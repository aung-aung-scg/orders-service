import { randomUUID } from 'node:crypto'
import { afterAll, expect, test } from 'vitest'
import { buildApp } from '../src/app.js'
import { createDb } from '../src/lib/db.js'

const db = createDb()
const app = buildApp({ db })
afterAll(async () => {
  await app.close()
  await db.$disconnect()
})

test('only ten of fifty parallel orders can buy the last ten units', async () => {
  const created = await app.inject({ method: 'POST', url: '/products', payload: { name: 'Concurrent product', stock: 10 } })
  expect(created.statusCode).toBe(201)
  const { id } = created.json()
  const responses = await Promise.all(Array.from({ length: 50 }, () => app.inject({
    method: 'POST',
    url: '/orders',
    headers: { 'idempotency-key': randomUUID() },
    payload: { items: [{ productId: id, quantity: 1 }] },
  })))

  expect(responses.filter(response => response.statusCode === 201)).toHaveLength(10)
  expect(responses.filter(response => response.statusCode === 409)).toHaveLength(40)
  expect(await db.product.findUniqueOrThrow({ where: { id } })).toMatchObject({ stock: 0, version: 10 })
  expect(await db.orderItem.count({ where: { productId: id } })).toBe(10)
})

test('an unavailable item rolls back a prior stock decrement', async () => {
  const prefix = randomUUID()
  const first = await db.product.create({ data: { id: prefix + '-a', name: 'Available', stock: 1 } })
  const last = await db.product.create({ data: { id: prefix + '-z', name: 'Unavailable', stock: 0 } })
  const response = await app.inject({
    method: 'POST',
    url: '/orders',
    headers: { 'idempotency-key': randomUUID() },
    payload: { items: [{ productId: first.id, quantity: 1 }, { productId: last.id, quantity: 1 }] },
  })
  expect(response.statusCode).toBe(409)
  expect(await db.product.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ stock: 1, version: 0 })
})
