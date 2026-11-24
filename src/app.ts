import Fastify from 'fastify'
import { ZodError } from 'zod'
import { Prisma } from '../generated/prisma/client.js'
import { createDb } from './lib/db.js'
import { HttpError } from './lib/errors.js'
import { registerOrders } from './routes/orders.js'
import { registerProducts } from './routes/products.js'
import { registerWebhooks } from './routes/webhooks.js'
import { readEnv } from './lib/env.js'

export function buildApp(options: { db?: ReturnType<typeof createDb>; logger?: boolean; webhookSecret?: string } = {}) {
  const secret = options.webhookSecret ?? readEnv().WEBHOOK_SECRET
  const db = options.db ?? createDb()
  const app = Fastify({ logger: options.logger ?? false })
  if (!options.db) app.addHook('onClose', () => db.$disconnect())

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ code: 'NOT_FOUND', message: 'Route not found' })
  })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.status).send({ code: error.code, message: error.message, details: error.details })
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({ code: 'VALIDATION_ERROR', message: 'Invalid request', details: error.issues })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return reply.code(409).send({ code: 'CONFLICT', message: 'A record with this identifier already exists' })
    }
    if (error && typeof error === 'object' && 'statusCode' in error &&
        typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({
        code: 'INVALID_REQUEST',
        message: error instanceof Error ? error.message : 'Invalid request',
      })
    }
    request.log.error({ err: error }, 'Request failed')
    return reply.code(500).send({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' })
  })

  registerProducts(app, db)
  registerOrders(app, db)
  app.register(async scope => registerWebhooks(scope, db, secret))
  return app
}
