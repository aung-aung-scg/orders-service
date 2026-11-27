import { randomUUID } from 'node:crypto'
import type { EventEmitter } from 'node:events'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js'
import { z } from 'zod'
import { HttpError } from '../lib/errors.js'
import { restaurantUnavailable } from '../lib/restaurant.js'
import { idempotencyKey } from '../schemas/index.js'
import { withIdempotency } from '../services/idempotency.js'
import { activeSession, lockTable, submittedOrderFields } from '../services/dining-sessions.js'

const tokenParams = z.object({ qrToken: z.string() })
const line = z.object({
  menuItemId: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(20),
  note: z.string().trim().max(500).optional(),
})
const addBody = z.object({ items: z.array(line).min(1).max(50) })
const patchBody = z.object({ quantity: z.number().int().min(0).max(20) })
const checkoutBody = z.strictObject({ cartId: z.uuid(), version: z.number().int().min(0).max(2147483647) })
const withItems = { items: { orderBy: { id: 'asc' } } } as const

async function findTable(db: Prisma.TransactionClient, qrToken: string) {
  const table = await db.diningTable.findUnique({
    where: { qrToken, active: true },
    include: { restaurant: { select: { name: true, active: true } } },
  })
  if (!table) throw new HttpError(404, 'TABLE_NOT_FOUND', 'Table not found')
  if (!table.restaurant.active) throw restaurantUnavailable()
  return table
}

async function updateTotal(tx: Prisma.TransactionClient, orderId: string) {
  const items = await tx.tableOrderItem.findMany({ where: { orderId } })
  const totalMinor = items.reduce((total, item) => total + item.quantity * item.unitPriceMinor, 0)
  if (totalMinor > 2147483647) throw new HttpError(409, 'TOTAL_LIMIT', 'Order total is too large')
  return tx.tableOrder.update({ where: { id: orderId }, data: { totalMinor, version: { increment: 1 } }, include: withItems })
}

export function registerTableOrders(app: FastifyInstance, db: PrismaClient, kitchenEvents: EventEmitter) {
  const expiryMinutes = z.coerce.number().int().min(1).max(10080).default(120).parse(process.env.CART_INACTIVITY_MINUTES)
  async function openOrder(tx: Prisma.TransactionClient, restaurantId: string, sessionId: string) {
    await tx.tableOrder.updateMany({
      where: { restaurantId, sessionId, status: 'OPEN', updatedAt: { lte: new Date(Date.now() - expiryMinutes * 60000) } },
      data: { status: 'CANCELLED' },
    })
    return tx.tableOrder.findFirst({ where: { restaurantId, sessionId, status: 'OPEN' }, include: withItems })
  }

  async function sessionFor(request: FastifyRequest, { id: tableId, restaurantId }: { id: string; restaurantId: string }) {
    const token = request.headers['x-dining-session']
    if (typeof token !== 'string' || !/^[\w-]{32}$/.test(token)) return null
    return db.diningSession.findUnique({ where: { restaurantId, tableId, accessToken: token } })
  }

  async function writeSession(request: FastifyRequest, table: { id: string; restaurantId: string }) {
    const session = await sessionFor(request, table)
    if (!session || session.id !== request.headers['x-dining-session-id']) {
      throw new HttpError(403, 'JOIN_REQUIRED', 'Join the current dining session before ordering')
    }
    takeWriteSlot('order:' + session.restaurantId + ':' + session.id)
    return session
  }

  async function assertActive(tx: Prisma.TransactionClient, restaurantId: string, tableId: string, sessionId: string) {
    if ((await activeSession(tx, restaurantId, tableId))?.id !== sessionId) {
      throw new HttpError(409, 'SESSION_ENDED', 'This seating ended. Ask staff for the current join code.')
    }
  }
  const limits = new Map<string, { count: number; expires: number }>()
  const cleanup = setInterval(() => {
    const now = Date.now()
    for (const [token, limit] of limits) if (limit.expires <= now) limits.delete(token)
  }, 60000).unref()
  app.addHook('onClose', async () => clearInterval(cleanup))

  function takeWriteSlot(key: string) {
    const now = Date.now()
    let limit = limits.get(key)
    if (!limit || limit.expires <= now) {
      limit = { count: 0, expires: now + 60000 }
      limits.set(key, limit)
    }
    if (++limit.count > 30) throw new HttpError(429, 'RATE_LIMIT', 'Too many requests for this table')
  }

  function requestTable(request: FastifyRequest) {
    return findTable(db, tokenParams.parse(request.params).qrToken)
  }

  app.post('/t/:qrToken/join', async (request, reply) => {
    const table = await requestTable(request)
    takeWriteSlot('join:' + table.restaurantId + ':' + table.id)
    const { code } = z.object({ code: z.string().trim().toUpperCase().regex(/^[0-9A-F]{10}$/) }).parse(request.body)
    const session = await activeSession(db, table.restaurantId, table.id)
    if (!session || session.joinCode !== code) throw new HttpError(403, 'INVALID_JOIN_CODE', 'Ask staff for the current join code')
    return reply.header('Cache-Control', 'no-store').send({ sessionId: session.id, accessToken: session.accessToken })
  })

  app.get('/t/:qrToken', async (request, reply) => {
    const { qrToken } = tokenParams.parse(request.params)
    const table = await findTable(db, qrToken)
    const { orderId } = z.object({ orderId: z.string().uuid().optional() }).parse(request.query)
    const session = await sessionFor(request, table)
    reply.header('Cache-Control', 'no-store')
    const withoutSession = {
      tableNumber: table.number, restaurantName: table.restaurant.name, sessionId: null, menu: [], order: null, ticket: null,
      submittedOrders: [], sessionTotalMinor: 0, sessionEnded: Boolean(session?.endedAt),
    }
    if (!session || session.endedAt) return withoutSession
    return db.$transaction(async tx => {
      await lockTable(tx, table.id)
      if ((await activeSession(tx, table.restaurantId, table.id))?.id !== session.id) {
        return { ...withoutSession, sessionEnded: true }
      }
      const [menu, order, submittedOrders] = await Promise.all([
        tx.menuItem.findMany({ where: { restaurantId: table.restaurantId, available: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
        openOrder(tx, table.restaurantId, session.id),
        tx.tableOrder.findMany({
          where: { restaurantId: table.restaurantId, sessionId: session.id, submittedAt: { not: null } },
          orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }], select: submittedOrderFields,
        }),
      ])
      const selected = submittedOrders.find(submitted => submitted.id === orderId)
      const ticket = selected ? { id: selected.id, status: selected.status } : null
      const sessionTotalMinor = submittedOrders.reduce((sum, submitted) =>
        submitted.status === 'CANCELLED' ? sum : sum + submitted.totalMinor, 0)
      return { ...withoutSession, sessionId: session.id, menu, order, ticket, submittedOrders, sessionTotalMinor, sessionEnded: false }
    })
  })

  app.post('/t/:qrToken/order/items', async request => {
    const table = await requestTable(request)
    const session = await writeSession(request, table)
    const { items } = addBody.parse(request.body)
    return db.$transaction(async tx => {
      await lockTable(tx, table.id)
      await assertActive(tx, table.restaurantId, table.id, session.id)
      let order = await openOrder(tx, table.restaurantId, session.id)
      if (!order) {
        await tx.tableOrder.createMany({
          data: { id: randomUUID(), restaurantId: table.restaurantId, tableId: table.id, sessionId: session.id },
          skipDuplicates: true,
        })
        order = await openOrder(tx, table.restaurantId, session.id)
        if (!order) throw new HttpError(409, 'ORDER_CHANGED', 'The open order changed. Try again.')
      }
      if (order.items.length + items.length > 50) {
        throw new HttpError(409, 'LINE_LIMIT', 'An order can have at most 50 lines')
      }
      const menu = await tx.menuItem.findMany({
        where: { restaurantId: table.restaurantId, id: { in: items.map(item => item.menuItemId) }, available: true },
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
    const table = await requestTable(request)
    const session = await writeSession(request, table)
    const { itemId } = z.object({ itemId: z.string() }).parse(request.params)
    const { quantity } = patchBody.parse(request.body)
    return db.$transaction(async tx => {
      await lockTable(tx, table.id)
      await assertActive(tx, table.restaurantId, table.id, session.id)
      const order = await openOrder(tx, table.restaurantId, session.id)
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
    const checkout = checkoutBody.parse(request.body)
    const table = await requestTable(request)
    const session = await writeSession(request, table)
    const result = await withIdempotency(db, checkout, `pos:${table.id}:${session.id}:${key}`, async tx => {
      await lockTable(tx, table.id)
      await assertActive(tx, table.restaurantId, table.id, session.id)
      const order = await openOrder(tx, table.restaurantId, session.id)
      if (order?.id !== checkout.cartId || order.version !== checkout.version) {
        return { responseStatus: 409, responseBody: { code: 'CART_CHANGED', message: 'Your cart changed. Review it and try again.' } }
      }
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
    if (!result.replayed && result.responseStatus === 201) kitchenEvents.emit('change', table.restaurantId)
    return reply.code(result.responseStatus).send(result.responseBody)
  })
}
