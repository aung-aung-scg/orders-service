import type { FastifyInstance } from 'fastify'
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js'
import { HttpError } from '../lib/errors.js'
import { verifySignature } from '../lib/hmac.js'
import { paymentEvent } from '../schemas/index.js'
import { receivePayment } from '../services/webhooks.js'

export function registerWebhooks(app: FastifyInstance, db: PrismaClient, secret: string) {
  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => done(null, body))
  app.post('/webhooks/payments', async (request, reply) => {
    if (!Buffer.isBuffer(request.body) || !verifySignature(request.body, request.headers['x-signature'], secret)) {
      throw new HttpError(401, 'INVALID_SIGNATURE', 'Invalid webhook signature')
    }

    let payload: unknown
    try {
      payload = JSON.parse(request.body.toString('utf8'))
    } catch {
      throw new HttpError(400, 'INVALID_JSON', 'Invalid JSON payload')
    }
    await receivePayment(db, paymentEvent.parse(payload), payload as Prisma.InputJsonObject)
    return reply.code(200).send({ received: true })
  })
}
