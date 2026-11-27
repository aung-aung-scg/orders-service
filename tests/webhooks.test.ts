import { createHmac, randomUUID } from 'node:crypto'
import { afterAll, expect, test } from 'vitest'
import { buildApp } from '../src/app.js'
import { createDb } from '../src/lib/db.js'

const db = createDb()
const secret = 'integration-secret'
const demoKey = randomUUID()
const app = buildApp({ db, webhookSecret: secret, stockDemo: true, kitchenApiKey: demoKey })
afterAll(async () => {
  await app.close()
  await db.$disconnect()
})

function webhook(event: { eventId: string; type: string; orderId: string }, signingSecret = secret) {
  const payload = JSON.stringify(event, null, 2)
  return app.inject({
    method: 'POST',
    url: '/webhooks/payments',
    headers: {
      'content-type': 'application/json',
      'x-signature': createHmac('sha256', signingSecret).update(payload).digest('hex'),
    },
    payload,
  })
}

const makeEvent = () => ({ eventId: randomUUID(), type: 'payment.succeeded', orderId: randomUUID() })

test('a bad signature is rejected before storing the event', async () => {
  const event = makeEvent()
  expect((await webhook(event, 'wrong')).statusCode).toBe(401)
  expect(await db.webhookEvent.findUnique({ where: { eventId: event.eventId } })).toBeNull()
})

test('a duplicate event returns 200 without reprocessing', async () => {
  const event = makeEvent()
  await db.order.create({ data: { id: event.orderId } })
  expect((await webhook(event)).statusCode).toBe(200)
  expect(await db.order.findUniqueOrThrow({ where: { id: event.orderId } })).toMatchObject({ status: 'PAID' })
  const stored = await db.webhookEvent.findUniqueOrThrow({ where: { eventId: event.eventId } })
  expect(stored.processedAt).toBeInstanceOf(Date)

  const duplicateOrder = await db.order.create({ data: {} })
  expect((await webhook({ ...event, orderId: duplicateOrder.id })).statusCode).toBe(200)
  expect(await db.order.findUniqueOrThrow({ where: { id: duplicateOrder.id } })).toMatchObject({ status: 'PENDING' })
  expect(await db.webhookEvent.findUniqueOrThrow({ where: { eventId: event.eventId } })).toEqual(stored)
})

test('an early payment is stored and applied when the order is created', async () => {
  const event = makeEvent()
  expect((await webhook(event)).statusCode).toBe(200)
  expect(await db.webhookEvent.findUniqueOrThrow({ where: { eventId: event.eventId } })).toMatchObject({ processedAt: null })

  const product = await db.product.create({ data: { name: 'Prepaid product', stock: 1 } })
  const response = await app.inject({
    method: 'POST',
    url: '/orders',
    headers: { 'x-kitchen-api-key': demoKey, 'idempotency-key': randomUUID() },
    payload: { id: event.orderId, items: [{ productId: product.id, quantity: 1 }] },
  })
  expect(response.statusCode).toBe(201)
  expect(response.json()).toMatchObject({ id: event.orderId, status: 'PAID' })
  expect(await db.webhookEvent.findUniqueOrThrow({ where: { eventId: event.eventId } })).toMatchObject({ processedAt: expect.any(Date) })
})
