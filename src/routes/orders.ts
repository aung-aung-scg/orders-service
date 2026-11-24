import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { idempotencyKey, orderBody } from '../schemas/index.js'
import { submitOrder } from '../services/idempotency.js'

export function registerOrders(app: FastifyInstance, db: PrismaClient) {
  app.get('/orders', () => db.order.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      status: true,
      createdAt: true,
      items: {
        orderBy: { id: 'asc' },
        select: { id: true, productId: true, quantity: true },
      },
    },
  }))

  app.post('/orders', async (request, reply) => {
    const key = idempotencyKey.parse(request.headers['idempotency-key'])
    const input = orderBody.parse(request.body)
    const result = await submitOrder(db, input, key)
    return reply.code(result.responseStatus).send(result.responseBody)
  })
}
