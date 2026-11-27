import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { HttpError } from '../lib/errors.js'
import { registerOrders } from './orders.js'
import { registerProducts } from './products.js'

export function registerStockDemo(app: FastifyInstance, db: PrismaClient, key?: string) {
  app.addHook('onRequest', async request => {
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.ip)) {
      throw new HttpError(404, 'NOT_FOUND', 'Route not found')
    }
    const header = request.headers['x-kitchen-api-key']
    if (key && typeof header === 'string') {
      const provided = Buffer.from(header)
      const expected = Buffer.from(key)
      if (provided.length === expected.length && timingSafeEqual(provided, expected)) return
    }
    throw new HttpError(401, 'UNAUTHORIZED', 'A valid local demo API key is required')
  })
  registerProducts(app, db)
  registerOrders(app, db)
}
