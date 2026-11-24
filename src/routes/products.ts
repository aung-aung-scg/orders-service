import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { productBody } from '../schemas/index.js'

export function registerProducts(app: FastifyInstance, db: PrismaClient) {
  app.post('/products', async (request, reply) => {
    const product = await db.product.create({ data: productBody.parse(request.body) })
    return reply.code(201).send(product)
  })

  app.get('/products', () => db.product.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }))
}
