import { randomUUID } from 'node:crypto'
import type { EventEmitter } from 'node:events'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js'
import { z } from 'zod'
import { lockTransaction } from '../lib/db.js'
import { HttpError } from '../lib/errors.js'
import { idempotencyKey } from '../schemas/index.js'
import { withIdempotency } from '../services/idempotency.js'

const tokenParams = z.object({ qrToken: z.string() })
const line = z.object({
  menuItemId: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(20),
  note: z.string().trim().max(500).optional(),
})
const addBody = z.object({ items: z.array(line).min(1).max(50) })
const patchBody = z.object({ quantity: z.number().int().min(0).max(20) })
const withItems = { items: { orderBy: { id: 'asc' } } } as const

async function findTable(db: Prisma.TransactionClient, qrToken: string) {
  const table = await db.diningTable.findUnique({ where: { qrToken, active: true } })
  if (!table) throw new HttpError(404, 'TABLE_NOT_FOUND', 'Table not found')
  return table
}

function openOrder(db: Prisma.TransactionClient, tableId: string) {
  return db.tableOrder.findFirst({ where: { tableId, status: 'OPEN' }, include: withItems })
}

async function updateTotal(tx: Prisma.TransactionClient, orderId: string) {
  const items = await tx.tableOrderItem.findMany({ where: { orderId } })
  const totalMinor = items.reduce((total, item) => total + item.quantity * item.unitPriceMinor, 0)
  if (totalMinor > 2147483647) throw new HttpError(409, 'TOTAL_LIMIT', 'Order total is too large')
  return tx.tableOrder.update({ where: { id: orderId }, data: { totalMinor }, include: withItems })
}

export function registerTableOrders(app: FastifyInstance, db: PrismaClient, kitchenEvents: EventEmitter) {
  const limits = new Map<string, { count: number; expires: number }>()
  const cleanup = setInterval(() => {
    const now = Date.now()
    for (const [token, limit] of limits) if (limit.expires <= now) limits.delete(token)
  }, 60000).unref()
  app.addHook('onClose', async () => clearInterval(cleanup))

  async function writeTable(request: FastifyRequest) {
    const { qrToken } = tokenParams.parse(request.params)
    const table = await findTable(db, qrToken)
    const now = Date.now()
    let limit = limits.get(qrToken)
    if (!limit || limit.expires <= now) {
      limit = { count: 0, expires: now + 60000 }
      limits.set(qrToken, limit)
    }
    if (++limit.count > 30) throw new HttpError(429, 'RATE_LIMIT', 'Too many requests for this table')
    return table
  }

  app.get('/t/:qrToken', async request => {
    const { qrToken } = tokenParams.parse(request.params)
    const table = await findTable(db, qrToken)
    const { orderId } = z.object({ orderId: z.string().uuid().optional() }).parse(request.query)
    const [menu, order, ticket] = await Promise.all([
      db.menuItem.findMany({ where: { available: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
      openOrder(db, table.id),
      orderId ? db.tableOrder.findUnique({
        where: { id: orderId, tableId: table.id, status: { not: 'OPEN' } },
        select: { id: true, status: true },
      }) : null,
    ])
    return { tableNumber: table.number, menu, order, ticket }
  })

  app.post('/t/:qrToken/order/items', async request => {
    const table = await writeTable(request)
    const { items } = addBody.parse(request.body)
    return db.$transaction(async tx => {
      await lockTransaction(tx, 'table-order', table.id)
      let order = await openOrder(tx, table.id)
      if (!order) {
        await tx.tableOrder.createMany({ data: { id: randomUUID(), tableId: table.id }, skipDuplicates: true })
        order = await openOrder(tx, table.id)
        if (!order) throw new HttpError(409, 'ORDER_CHANGED', 'The open order changed. Try again.')
      }
      if (order.items.length + items.length > 50) {
        throw new HttpError(409, 'LINE_LIMIT', 'An order can have at most 50 lines')
      }
      const menu = await tx.menuItem.findMany({
        where: { id: { in: items.map(item => item.menuItemId) }, available: true },
      })
      const byId = new Map(menu.map(item => [item.id, item]))
      const orderId = order.id
      await tx.tableOrderItem.createMany({ data: items.map(item => {
        const entry = byId.get(item.menuItemId)
        if (!entry) throw new HttpError(409, 'MENU_ITEM_UNAVAILABLE', 'A menu item is unavailable')
        return { ...item, orderId, nameSnapshot: entry.name, unitPriceMinor: entry.priceMinor }
      }) })
      return updateTotal(tx, order.id)
    })
  })

  app.patch('/t/:qrToken/order/items/:itemId', async request => {
    const table = await writeTable(request)
    const { itemId } = z.object({ itemId: z.string() }).parse(request.params)
    const { quantity } = patchBody.parse(request.body)
    return db.$transaction(async tx => {
      await lockTransaction(tx, 'table-order', table.id)
      const order = await openOrder(tx, table.id)
      if (!order || !order.items.some(item => item.id === itemId)) {
        throw new HttpError(404, 'ORDER_ITEM_NOT_FOUND', 'Open order item not found')
      }
      if (quantity === 0) await tx.tableOrderItem.delete({ where: { id: itemId } })
      else await tx.tableOrderItem.update({ where: { id: itemId }, data: { quantity } })
      return updateTotal(tx, order.id)
    })
  })

  app.post('/t/:qrToken/order/submit', async (request, reply) => {
    const key = idempotencyKey.parse(request.headers['idempotency-key'])
    const table = await writeTable(request)
    const result = await withIdempotency(db, { tableId: table.id }, `pos:${table.id}:${key}`, async tx => {
      await lockTransaction(tx, 'table-order', table.id)
      const order = await openOrder(tx, table.id)
      if (!order?.items.length) {
        return { responseStatus: 409, responseBody: { code: 'EMPTY_ORDER', message: 'Add an item before placing the order' } }
      }
      const ticket = await tx.tableOrder.update({
        where: { id: order.id },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
        select: { id: true, status: true },
      })
      return { responseStatus: 201, responseBody: ticket }
    })
    if (!result.replayed && result.responseStatus === 201) kitchenEvents.emit('change')
    return reply.code(result.responseStatus).send(result.responseBody)
  })
}
