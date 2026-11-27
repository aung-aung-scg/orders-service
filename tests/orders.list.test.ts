import { randomUUID } from 'node:crypto'
import { afterAll, expect, test } from 'vitest'
import { buildApp } from '../src/app.js'
import { createDb } from '../src/lib/db.js'

const db = createDb()
const demoKey = randomUUID()
const app = buildApp({ db, stockDemo: true, kitchenApiKey: demoKey })
afterAll(async () => {
  await app.close()
  await db.$disconnect()
})

test('lists orders with their status and items', async () => {
  const product = await db.product.create({ data: { name: 'Order list product', stock: 3 } })
  const created = await app.inject({
    method: 'POST',
    url: '/orders',
    headers: { 'x-kitchen-api-key': demoKey, 'idempotency-key': randomUUID() },
    payload: { items: [{ productId: product.id, quantity: 2 }] },
  })
  expect(created.statusCode).toBe(201)
  const { id, createdAt, items } = created.json()

  const response = await app.inject({ method: 'GET', url: '/orders', headers: { 'x-kitchen-api-key': demoKey } })
  expect(response.statusCode).toBe(200)
  expect(response.json().find((order: { id: string }) => order.id === id)).toEqual({
    id,
    status: 'PENDING',
    createdAt,
    items: [{ id: items[0].id, productId: product.id, quantity: 2 }],
  })
})
