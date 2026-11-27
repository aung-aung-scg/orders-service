import type { FastifyInstance } from 'fastify'
import type { PrismaClient, ReservationStatus } from '../../generated/prisma/client.js'
import { z } from 'zod'
import { dateInput, readBookingConfig, shiftDay } from '../lib/booking.js'
import { HttpError } from '../lib/errors.js'

const changes: Record<ReservationStatus, readonly ReservationStatus[]> = {
  CONFIRMED: ['SEATED', 'NO_SHOW', 'CANCELLED'],
  SEATED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
}
const statusBody = z.strictObject({
  status: z.enum(['CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
})

export function registerStaffReservations(app: FastifyInstance, db: PrismaClient) {
  const { instant, localParts } = readBookingConfig()
  app.get('/staff/reservations', async (request, reply) => {
    const { date } = z.object({ date: dateInput }).parse(request.query)
    const next = shiftDay(date, 1)
    const start = instant(date, 0) ?? Date.parse(shiftDay(date, -1) + 'T00:00:00Z')
    const end = instant(next, 0) ?? Date.parse(shiftDay(next, 1) + 'T00:00:00Z')
    const reservations = await db.reservation.findMany({
      where: { startsAt: { gte: new Date(start), lt: new Date(end) } },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true, partySize: true, startsAt: true, endsAt: true, status: true,
        guestName: true, phone: true, email: true, notes: true,
        table: { select: { number: true } },
      },
    })
    return reply.header('Cache-Control', 'no-store').send(
      reservations.filter(reservation => localParts(reservation.startsAt.getTime()).day === date),
    )
  })

  app.patch('/staff/reservations/:id/status', async request => {
    const { id } = z.object({ id: z.uuid() }).parse(request.params)
    const { status } = statusBody.parse(request.body)
    const current = await db.reservation.findUnique({ where: { id }, select: { status: true } })
    if (!current) throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found')
    if (!changes[current.status].includes(status)) {
      throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'The reservation cannot move to that status')
    }
    const updated = await db.reservation.updateMany({ where: { id, status: current.status }, data: { status } })
    if (!updated.count) throw new HttpError(409, 'STATUS_CHANGED', 'The reservation status changed')
    return { id, status }
  })
}
