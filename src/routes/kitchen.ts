import { timingSafeEqual } from 'node:crypto'
import type { EventEmitter } from 'node:events'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient, TableOrderStatus } from '../../generated/prisma/client.js'
import { z } from 'zod'
import { HttpError } from '../lib/errors.js'

const transitions: Record<TableOrderStatus, TableOrderStatus[]> = {
  OPEN: [],
  SUBMITTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED'],
  SERVED: [],
  CANCELLED: [],
}
const statusBody = z.object({ status: z.enum(['OPEN', 'SUBMITTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']) })

export async function activeTickets(db: PrismaClient) {
  const tickets = await db.tableOrder.findMany({
    where: { status: { in: ['SUBMITTED', 'PREPARING', 'READY'] } },
    orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true, status: true, submittedAt: true, totalMinor: true,
      table: { select: { number: true } },
      session: { select: { endedAt: true } },
      items: { orderBy: { id: 'asc' } },
    },
  })
  return tickets.map(({ session, ...ticket }) => ({ ...ticket, previousSeating: !session || session.endedAt !== null }))
}

export function registerKitchen(app: FastifyInstance, db: PrismaClient, key: string | undefined, events: EventEmitter) {
  const streams = new Set<() => void>()
  app.addHook('preClose', async () => {
    for (const close of streams) close()
  })
  app.addHook('onRequest', async request => {
    const value = request.headers['x-kitchen-api-key']
    if (key && typeof value === 'string') {
      const supplied = Buffer.from(value)
      const expected = Buffer.from(key)
      if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) return
    }
    throw new HttpError(401, 'UNAUTHORIZED', 'A valid kitchen API key is required')
  })

  app.get('/kitchen/orders', () => activeTickets(db))

  app.patch('/kitchen/orders/:id/status', async request => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const { status } = statusBody.parse(request.body)
    const order = await db.tableOrder.findUnique({ where: { id }, select: { status: true } })
    if (!order) throw new HttpError(404, 'TICKET_NOT_FOUND', 'Ticket not found')
    if (!transitions[order.status].includes(status)) {
      throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'The ticket cannot move to that status')
    }
    const result = await db.tableOrder.updateMany({ where: { id, status: order.status }, data: { status } })
    if (result.count !== 1) throw new HttpError(409, 'STATUS_CHANGED', 'The ticket status changed')
    events.emit('change')
    return { id, status }
  })

  app.get('/kitchen/stream', (request, reply) => {
    reply.hijack()
    const stream = reply.raw
    stream.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    })
    stream.flushHeaders()

    let pending = Promise.resolve()
    const send = (event: string) => {
      pending = pending.then(async () => {
        if (stream.destroyed || stream.writableEnded) return
        const tickets = await activeTickets(db)
        write(`event: ${event}\ndata: ${JSON.stringify(tickets)}\n\n`)
      }).catch(error => {
        request.log.error({ err: error }, 'Kitchen stream failed')
        close()
      })
    }
    const write = (chunk: string) => {
      if (!stream.destroyed && !stream.writableEnded && !stream.write(chunk)) close()
    }
    const changed = () => send('tickets')
    const heartbeat = setInterval(() => write(': heartbeat\n\n'), 15000).unref()
    const cleanup = () => {
      clearInterval(heartbeat)
      events.off('change', changed)
      streams.delete(close)
    }
    const close = () => {
      cleanup()
      stream.end()
    }
    stream.once('close', cleanup)
    streams.add(close)
    events.on('change', changed)
    send('snapshot')
  })
}
