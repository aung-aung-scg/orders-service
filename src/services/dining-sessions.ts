import { randomBytes } from 'node:crypto'
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js'
import { lockTransaction } from '../lib/db.js'
import { HttpError } from '../lib/errors.js'

const activeStatuses = ['SUBMITTED', 'PREPARING', 'READY'] as const

export const submittedOrderFields = {
  id: true, submittedAt: true, status: true, totalMinor: true,
  items: {
    orderBy: { id: 'asc' },
    select: { id: true, nameSnapshot: true, unitPriceMinor: true, quantity: true, note: true },
  },
} as const

export function activeSession(db: Prisma.TransactionClient, tableId: string) {
  return db.diningSession.findFirst({ where: { tableId, endedAt: null } })
}

export function lockTable(db: Prisma.TransactionClient, tableId: string) {
  return lockTransaction(db, 'table-order', tableId)
}

export async function listDiningSessions(db: PrismaClient) {
  const tables = await db.diningTable.findMany({
    where: { active: true },
    orderBy: { number: 'asc' },
    select: {
      id: true, number: true,
      sessions: { where: { endedAt: null }, select: { id: true, joinCode: true } },
      _count: { select: { orders: { where: { status: { in: [...activeStatuses] } } } } },
    },
  })
  return tables.map(({ id, number, sessions, _count }) => ({
    id, number, session: sessions[0] ?? null, activeTickets: _count.orders,
  }))
}

type ResetInput = {
  expectedSessionId: string | null
  actor: { id: string; role: 'ADMIN' | 'KITCHEN' }
  overrideReason?: string
}

export function resetDiningSession(db: PrismaClient, tableId: string, input: ResetInput) {
  return db.$transaction(async tx => {
    await lockTable(tx, tableId)
    const table = await tx.diningTable.findUnique({ where: { id: tableId, active: true }, select: { id: true } })
    if (!table) throw new HttpError(404, 'TABLE_NOT_FOUND', 'Table not found')
    const session = await activeSession(tx, tableId)
    if ((session?.id ?? null) !== input.expectedSessionId) {
      throw new HttpError(409, 'SESSION_CHANGED', 'This seating changed. Refresh before resetting the table.')
    }
    if (input.overrideReason && input.actor.role !== 'ADMIN') {
      throw new HttpError(403, 'OVERRIDE_FORBIDDEN', 'Only admins can override an active ticket')
    }
    const activeTickets = await tx.tableOrder.count({ where: { tableId, status: { in: [...activeStatuses] } } })
    if (activeTickets && !input.overrideReason) {
      throw new HttpError(409, 'ACTIVE_TICKETS', 'Finish the active kitchen tickets before resetting this table')
    }
    await tx.tableOrder.updateMany({ where: { tableId, status: 'OPEN' }, data: { status: 'CANCELLED' } })
    if (session) {
      await tx.diningSession.update({
        where: { id: session.id }, data: { endedAt: new Date(), endedBy: input.actor.id },
      })
    }
    return tx.diningSession.create({
      data: {
        tableId, startedBy: input.actor.id, overrideReason: input.overrideReason,
        joinCode: randomBytes(5).toString('hex').toUpperCase(),
        accessToken: randomBytes(24).toString('base64url'),
      },
      select: { id: true, joinCode: true },
    })
  })
}
