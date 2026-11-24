import { createHash } from 'node:crypto'
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js'
import { HttpError } from '../lib/errors.js'
import { lockTransaction } from '../lib/db.js'
import type { OrderInput } from '../schemas/index.js'
import { createOrder } from './orders.js'

export async function submitOrder(db: PrismaClient, input: OrderInput, key: string) {
  // Zod constructs objects in schema order, so JSON property order is immaterial.
  const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  return db.$transaction(async tx => {
    await lockTransaction(tx, 'idempotency', key)
    const existing = await tx.idempotencyRecord.findUnique({ where: { key } })
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new HttpError(422, 'IDEMPOTENCY_MISMATCH', 'This idempotency key was used with a different body')
      }
      return existing
    }

    let responseStatus = 201
    let responseBody: Prisma.InputJsonObject
    await tx.$executeRaw`SAVEPOINT order_attempt`
    try {
      const order = await createOrder(tx, input, key)
      responseBody = { ...order, createdAt: order.createdAt.toISOString() }
    } catch (error) {
      if (error instanceof HttpError && error.code === 'INSUFFICIENT_STOCK') {
        responseBody = {
          code: error.code,
          message: error.message,
          details: { productId: (error.details as { productId: string }).productId },
        }
      } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        responseBody = { code: 'CONFLICT', message: 'An order with this identifier already exists' }
      } else {
        throw error
      }
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT order_attempt`
      responseStatus = 409
    }
    await tx.$executeRaw`RELEASE SAVEPOINT order_attempt`
    return tx.idempotencyRecord.create({ data: { key, requestHash, responseStatus, responseBody } })
  }, { isolationLevel: 'ReadCommitted', maxWait: 15000, timeout: 15000 })
}
