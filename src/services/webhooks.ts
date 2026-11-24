import type { Prisma, PrismaClient } from '../../generated/prisma/client.js'
import { lockTransaction } from '../lib/db.js'
import type { PaymentEvent } from '../schemas/index.js'

const succeeded = 'payment.succeeded'

export async function applyPendingPayments(tx: Prisma.TransactionClient, orderId: string) {
  const pending = await tx.webhookEvent.updateMany({
    where: { type: succeeded, processedAt: null, payload: { path: ['orderId'], equals: orderId } },
    data: { processedAt: new Date() },
  })
  if (pending.count === 0) return false

  await tx.order.updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status: 'PAID' } })
  return true
}

export async function receivePayment(db: PrismaClient, event: PaymentEvent, payload: Prisma.InputJsonObject) {
  await db.$transaction(async tx => {
    const isSuccess = event.type === succeeded
    if (isSuccess) await lockTransaction(tx, 'payment-order', event.orderId!)

    const inserted = await tx.webhookEvent.createMany({
      data: { eventId: event.eventId, type: event.type, payload, processedAt: isSuccess ? null : new Date() },
      skipDuplicates: true,
    })
    if (inserted.count === 0 || !isSuccess) return

    const orderId = event.orderId!
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } })
    if (order) await applyPendingPayments(tx, orderId)
  }, { isolationLevel: 'ReadCommitted', maxWait: 15000, timeout: 15000 })
}
