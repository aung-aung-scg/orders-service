import { randomUUID } from 'node:crypto'
import type { Prisma } from '../../generated/prisma/client.js'
import { lockTransaction } from '../lib/db.js'
import { HttpError } from '../lib/errors.js'
import type { OrderInput } from '../schemas/index.js'
import { applyPendingPayments } from './webhooks.js'

export async function createOrder(tx: Prisma.TransactionClient, input: OrderInput, key: string) {
  const id = input.id ?? randomUUID()
  await lockTransaction(tx, 'payment-order', id)
  const quantities = new Map<string, number>()
  for (const { productId, quantity } of input.items) {
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity)
  }

  for (const productId of [...quantities.keys()].sort()) {
    const quantity = quantities.get(productId)!
    const result = quantity <= 2147483647 && await tx.product.updateMany({
      where: { id: productId, stock: { gte: quantity } },
      data: { stock: { decrement: quantity }, version: { increment: 1 } },
    })
    if (!result || result.count !== 1) {
      throw new HttpError(409, 'INSUFFICIENT_STOCK', 'Insufficient stock for product', { productId })
    }
  }

  const order = await tx.order.create({
    data: { id, idempotencyKey: key, items: { create: input.items } },
    include: { items: true },
  })
  if (await applyPendingPayments(tx, id)) order.status = 'PAID'
  return order
}
