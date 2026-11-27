import { randomBytes } from 'node:crypto'
import type { EventEmitter } from 'node:events'
import type { FastifyInstance } from 'fastify'
import QRCode from 'qrcode'
import { z } from 'zod'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { HttpError } from '../lib/errors.js'
import { listDiningSessions, resetDiningSession, submittedOrderFields } from '../services/dining-sessions.js'

const tableBody = z.strictObject({ number: z.number().int().min(1).max(2147483647) })
const tableFields = { id: true, number: true, qrToken: true, active: true } as const

export function registerTables(app: FastifyInstance, db: PrismaClient, publicBaseUrl: string, kitchenEvents: EventEmitter) {
  app.get('/tables', request => db.diningTable.findMany({
    where: { restaurantId: request.restaurant.id }, orderBy: { number: 'asc' }, select: tableFields,
  }))

  app.get('/staff/table-sessions', async (request, reply) =>
    reply.header('Cache-Control', 'no-store').send(await listDiningSessions(db, request.restaurant.id)))

  app.get('/staff/table-sessions/:id/orders', async (request, reply) => {
    const { id } = z.object({ id: z.uuid() }).parse(request.params)
    const table = await db.diningTable.findUnique({
      where: { id, restaurantId: request.restaurant.id },
      select: {
        number: true,
        orders: {
          where: { restaurantId: request.restaurant.id, submittedAt: { not: null } },
          orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
          select: submittedOrderFields,
        },
      },
    })
    if (!table) throw new HttpError(404, 'TABLE_NOT_FOUND', 'Table not found')
    return reply.header('Cache-Control', 'no-store').send(table)
  })

  app.post('/staff/table-sessions/:id/reset', async (request, reply) => {
    const { id } = z.object({ id: z.uuid() }).parse(request.params)
    const input = z.strictObject({
      expectedSessionId: z.uuid().nullable(),
      actor: z.object({ id: z.string().min(1).max(200), role: z.enum(['ADMIN', 'KITCHEN']) }),
      overrideReason: z.string().trim().min(1).max(500).optional(),
    }).parse(request.body)
    const session = await resetDiningSession(db, request.restaurant.id, id, input)
    if (input.overrideReason) kitchenEvents.emit('change', request.restaurant.id)
    return reply.header('Cache-Control', 'no-store').send(session)
  })

  app.post('/tables', async (request, reply) => {
    const { number } = tableBody.parse(request.body)
    const table = await db.diningTable.create({
      data: { number, restaurantId: request.restaurant.id, qrToken: randomBytes(24).toString('base64url') },
      select: tableFields,
    })
    return reply.code(201).send(table)
  })

  app.get('/tables/:id/qr', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const table = await db.diningTable.findUnique({ where: { id, restaurantId: request.restaurant.id }, select: { qrToken: true } })
    if (!table) throw new HttpError(404, 'TABLE_NOT_FOUND', 'Table not found')
    const url = new URL('/t/' + table.qrToken, publicBaseUrl)
    const svg = await QRCode.toString(url.href, { type: 'svg' })
    return reply.type('image/svg+xml').send(svg)
  })
}
