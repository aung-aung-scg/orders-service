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

test('parallel retries replay one response and changed input is rejected', async () => {
  const product = await db.product.create({ data: { name: 'Replay product', stock: 2 } })
  const key = randomUUID()
  const submit = (quantity: number) => app.inject({
    method: 'POST',
    url: '/orders',
    headers: { 'idempotency-key': key },
    payload: { items: [{ productId: product.id, quantity }] },
  })

  const [first, duplicate] = await Promise.all([submit(1), submit(1)])
  expect(first.statusCode).toBe(201)
  expect(duplicate.statusCode).toBe(201)
  expect(duplicate.json()).toEqual(first.json())
  expect((await submit(2)).statusCode).toBe(422)
  expect(await db.order.count({ where: { idempotencyKey: key } })).toBe(1)
  expect(await db.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ stock: 1 })
})

test('an insufficient-stock response is replayed after stock changes', async () => {
  const product = await db.product.create({ data: { name: 'Out of stock', stock: 0 } })
  const key = randomUUID()
  const submit = () => app.inject({
    method: 'POST',
    url: '/orders',
    headers: { 'idempotency-key': key },
    payload: { items: [{ productId: product.id, quantity: 1 }] },
  })

  const first = await submit()
  expect(first.statusCode).toBe(409)
  await db.product.update({ where: { id: product.id }, data: { stock: 1 } })
  const retry = await submit()
  expect(retry.statusCode).toBe(409)
  expect(retry.json()).toEqual(first.json())
  expect(await db.order.count({ where: { idempotencyKey: key } })).toBe(0)
})
