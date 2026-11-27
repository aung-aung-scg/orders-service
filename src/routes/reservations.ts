import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js'
import { z } from 'zod'
import { dateInput, minute, readBookingConfig, shiftDay } from '../lib/booking.js'
import { HttpError } from '../lib/errors.js'
import { idempotencyKey } from '../schemas/index.js'
import { withIdempotency } from '../services/idempotency.js'
import { normalizeBookingPhone, reservationAccess, reservationAccessSeconds, reservationCodePattern } from '../lib/reservation-access.js'

const reservationFields = {
  code: true, partySize: true, startsAt: true, endsAt: true, status: true,
  guestName: true, phone: true, email: true, notes: true,
  table: { select: { number: true } },
} as const

const codeParams = z.object({ code: z.string().regex(reservationCodePattern) })
const phoneInput = z.string().trim().max(40).refine(value => normalizeBookingPhone(value) !== null)
const startsAtInput = z.iso.datetime({ offset: true }).transform(value => new Date(value).toISOString())
const activeStatuses = ['CONFIRMED', 'SEATED'] as const
const exclusionViolation = z.object({
  driverAdapterError: z.object({ cause: z.object({ originalCode: z.literal('23P01') }) }),
})

export function registerReservations(app: FastifyInstance, db: PrismaClient, proxyKey?: string) {
  const { env, open, close, instant, localParts } = readBookingConfig()
  const access = reservationAccess(proxyKey ?? randomBytes(32))
  const limits = new Map<string, { count: number; until: number }>()
  const cleanup = setInterval(() => {
    const now = Date.now()
    for (const [ip, limit] of limits) if (limit.until <= now) limits.delete(ip)
  }, 60_000).unref()
  app.addHook('onClose', async () => clearInterval(cleanup))

  function clientIp(request: FastifyRequest) {
    const forwarded = request.headers['x-booking-client-ip']
    const suppliedKey = request.headers['x-kitchen-api-key']
    let ip = request.ip
    if (proxyKey && typeof suppliedKey === 'string' && typeof forwarded === 'string' && isIP(forwarded)) {
      const expected = Buffer.from(proxyKey)
      const supplied = Buffer.from(suppliedKey)
      if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) ip = forwarded
    }
    return ip
  }

  function consume(key: string, max: number, window: number) {
    const now = Date.now()
    let limit = limits.get(key)
    if (!limit || limit.until <= now) {
      limit = { count: 0, until: now + window }
      limits.set(key, limit)
    }
    if (++limit.count > max) throw new HttpError(429, 'RATE_LIMIT', 'Too many booking requests')
  }

  async function rateLimit(request: FastifyRequest) {
    consume('general:' + clientIp(request), 120, 60_000)
  }

  function requireAccess(request: FastifyRequest, code: string) {
    if (access.read(request.headers['x-reservation-access']) !== code) {
      throw new HttpError(403, 'RESERVATION_ACCESS_REQUIRED', 'Verify your booking phone number to continue')
    }
  }

  const partySize = z.number().int().min(1).max(env.BOOKING_MAX_PARTY)
  const bookingBody = z.strictObject({
    startsAt: startsAtInput,
    partySize,
    guestName: z.string().trim().min(1).max(200),
    phone: phoneInput,
    email: z.email().max(254).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  const duration = env.BOOKING_DURATION_MINUTES * minute
  const cancellationCutoff = env.BOOKING_CANCEL_CUTOFF_MINUTES * minute
  const reschedulingCutoff = 30 * minute
  function withinHorizon(day: string, now: number) {
    return day <= shiftDay(localParts(now).day, env.BOOKING_MAX_DAYS_AHEAD)
  }

  function validateSlot(value: string, now: number) {
    const start = Date.parse(value)
    const { day, minuteOfDay } = localParts(start)
    const closing = instant(day, close)
    if (!withinHorizon(day, now) || start < now + env.BOOKING_MIN_LEAD_MINUTES * minute ||
        minuteOfDay < open || (minuteOfDay - open) % env.BOOKING_SLOT_MINUTES !== 0 ||
        start !== instant(day, minuteOfDay) || closing === null || start + duration > closing) {
      throw new HttpError(400, 'INVALID_SLOT', 'Choose a future slot within booking hours and the booking window')
    }
    return { startsAt: new Date(start), endsAt: new Date(start + duration) }
  }

  function candidateTables(tx: Prisma.TransactionClient, size: number) {
    return tx.diningTable.findMany({
      where: { active: true, capacity: { gte: size } },
      orderBy: [{ capacity: 'asc' }, { number: 'asc' }],
      select: { id: true },
    })
  }

  async function availability(date: string, size: number, excludedReservationId?: string) {
    const now = Date.now()
    const closing = instant(date, close)
    const slots = []
    for (let index = open; index < close; index += env.BOOKING_SLOT_MINUTES) {
      const start = instant(date, index)
      if (start !== null && closing !== null && start + duration <= closing) {
        slots.push({ startsAt: new Date(start), endsAt: new Date(start + duration), available: false })
      }
    }
    const eligible = withinHorizon(date, now)
      ? slots.filter(slot => slot.startsAt.getTime() >= now + env.BOOKING_MIN_LEAD_MINUTES * minute)
      : []
    if (eligible.length) {
      const tables = await db.diningTable.findMany({
        where: { active: true, capacity: { gte: size } },
        select: { reservations: {
          where: { id: excludedReservationId ? { not: excludedReservationId } : undefined,
            status: { in: [...activeStatuses] }, startsAt: { lt: slots.at(-1)!.endsAt }, endsAt: { gt: slots[0].startsAt } },
          select: { startsAt: true, endsAt: true },
        } },
      })
      for (const slot of eligible) {
        slot.available = tables.some(table => !table.reservations.some(booking => booking.startsAt < slot.endsAt && booking.endsAt > slot.startsAt))
      }
    }
    const state = eligible.some(slot => slot.available) ? 'AVAILABLE'
      : closing !== null && date === localParts(now).day && now >= closing ? 'CLOSED'
      : eligible.length ? 'FULLY_BOOKED' : 'NO_REMAINING_SLOTS'
    return { state, slots }
  }

  function guestDetails(reservation: { code: string; partySize: number; startsAt: Date; endsAt: Date; status: string; table: { number: number }; updatedAt: Date }) {
    const { updatedAt, ...details } = reservation
    const cancellationDeadline = new Date(details.startsAt.getTime() - cancellationCutoff)
    const reschedulingDeadline = new Date(details.startsAt.getTime() - reschedulingCutoff)
    const now = Date.now()
    return {
      ...details, revision: updatedAt, cancellationDeadline, reschedulingDeadline,
      canCancel: details.status === 'CONFIRMED' && cancellationDeadline.getTime() > now,
      canReschedule: details.status === 'CONFIRMED' && reschedulingDeadline.getTime() > now,
    }
  }
  const guestSelect = { code: true, partySize: true, startsAt: true, endsAt: true, status: true, updatedAt: true,
    table: { select: { number: true } } } as const

  app.addHook('onRequest', async (request, reply) => {
    // Reservation responses include private booking data or access grants.
    if (request.url.startsWith('/reservations')) reply.header('Cache-Control', 'no-store')
  })

  app.get('/availability', { preHandler: rateLimit }, async (request, reply) => {
    const { date, partySize: size, summary } = z.object({
      date: dateInput, partySize: z.string().regex(/^\d+$/).transform(Number).pipe(partySize),
      summary: z.literal('1').optional(),
    }).parse(request.query)
    const result = await availability(date, size)
    return reply.header('Cache-Control', 'no-store').send(summary ? result : result.slots)
  })

  app.post('/reservations', { preHandler: rateLimit }, async (request, reply) => {
    const key = idempotencyKey.parse(request.headers['idempotency-key'])
    const input = bookingBody.parse(request.body)
    const result = await withIdempotency(db, { reservation: input }, 'booking:' + key, async tx => {
      const { startsAt, endsAt } = validateSlot(input.startsAt, Date.now())
      const tables = await candidateTables(tx, input.partySize)
      for (const table of tables) {
        const id = randomUUID()
        const code = randomBytes(24).toString('base64url')
        await tx.$executeRaw`SAVEPOINT reservation_candidate`
        try {
          await tx.$executeRaw`
            INSERT INTO "Reservation"
              ("id","tableId","partySize","startsAt","endsAt","guestName","phone","email","notes","code","updatedAt")
            VALUES
              (${id},${table.id},${input.partySize},${startsAt},${endsAt},${input.guestName},${input.phone},
               ${input.email ?? null},${input.notes ?? null},${code},CURRENT_TIMESTAMP)
          `
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2010' && exclusionViolation.safeParse(error.meta).success)) throw error
          await tx.$executeRaw`ROLLBACK TO SAVEPOINT reservation_candidate`
          await tx.$executeRaw`RELEASE SAVEPOINT reservation_candidate`
          continue
        }
        await tx.$executeRaw`RELEASE SAVEPOINT reservation_candidate`
        const booking = await tx.reservation.findUniqueOrThrow({ where: { id }, select: reservationFields })
        return { responseStatus: 201, responseBody: { ...booking, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() } }
      }
      return { responseStatus: 409, responseBody: { code: 'SLOT_UNAVAILABLE', message: 'This slot is no longer available' } }
    })
    if (result.responseStatus === 201) {
      const { code } = codeParams.parse(result.responseBody)
      return reply.code(201).send({ ...result.responseBody as object, grant: access.issue(code, result.createdAt.getTime()),
        maxAge: Math.max(0, reservationAccessSeconds - Math.floor((Date.now() - result.createdAt.getTime()) / 1000)) })
    }
    return reply.code(result.responseStatus).send(result.responseBody)
  })

  app.get('/reservations/:code', { preHandler: rateLimit }, async (request, reply) => {
    const { code } = codeParams.parse(request.params)
    requireAccess(request, code)
    const reservation = await db.reservation.findUnique({ where: { code }, select: guestSelect })
    if (!reservation) throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found')
    return reply.send(guestDetails(reservation))
  })

  app.post('/reservations/:code/verify', { preHandler: rateLimit }, async (request, reply) => {
    consume('verify-ip:' + clientIp(request), 15, 900_000)
    const { code } = codeParams.parse(request.params)
    consume('verify-code:' + code, 10, 900_000)
    const { phone } = z.object({ phone: phoneInput }).parse(request.body)
    const reservation = await db.reservation.findUnique({ where: { code }, select: { phone: true } })
    if (!reservation || normalizeBookingPhone(reservation.phone) !== normalizeBookingPhone(phone)) {
      throw new HttpError(403, 'RESERVATION_ACCESS_REQUIRED', 'Could not verify the reservation with that phone number')
    }
    return reply.send({ grant: access.issue(code), maxAge: reservationAccessSeconds })
  })

  app.post('/reservations/lookup', { preHandler: rateLimit }, async (request, reply) => {
    consume('lookup:' + clientIp(request), 20, 60_000)
    const { phone, grants } = z.object({
      phone: phoneInput, grants: z.array(z.string().max(150)).max(64).default([]),
    }).parse(request.body)
    const codes = grants.flatMap(grant => access.read(grant) ?? [])
    if (!codes.length) return reply.send([])
    const rows = await db.reservation.findMany({
      where: { code: { in: codes }, startsAt: { gt: new Date() }, status: { in: [...activeStatuses] } },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      select: { ...guestSelect, phone: true },
    })
    const digits = normalizeBookingPhone(phone)
    return reply.send(rows.filter(row => normalizeBookingPhone(row.phone) === digits)
      .map(({ phone: _phone, ...details }) => guestDetails(details)))
  })

  function checkResizable(reservation: { status: string; startsAt: Date }, now: number) {
    if (reservation.status !== 'CONFIRMED' || reservation.startsAt.getTime() <= now + reschedulingCutoff) {
      throw new HttpError(409, 'CANNOT_RESCHEDULE', 'This reservation can no longer be rescheduled online')
    }
  }

  app.get('/reservations/:code/availability', { preHandler: rateLimit }, async request => {
    const { code } = codeParams.parse(request.params)
    requireAccess(request, code)
    const { date } = z.object({ date: dateInput }).parse(request.query)
    const booking = await db.reservation.findUnique({ where: { code } })
    if (!booking) throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found')
    checkResizable(booking, Date.now())
    const result = await availability(date, booking.partySize, booking.id)
    return result.slots.filter(slot => slot.available && slot.startsAt.getTime() !== booking.startsAt.getTime())
  })

  app.patch('/reservations/:code/reschedule', { preHandler: rateLimit }, async request => {
    const { code } = codeParams.parse(request.params)
    requireAccess(request, code)
    const input = z.strictObject({ startsAt: startsAtInput, revision: z.iso.datetime() }).parse(request.body)
    try {
      return await db.$transaction(async tx => {
        const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Reservation" WHERE "code" = ${code} FOR UPDATE`
        if (!locked) throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found')
        const booking = await tx.reservation.findUniqueOrThrow({ where: { id: locked.id } })
        const now = Date.now()
        checkResizable(booking, now)
        if (booking.updatedAt.toISOString() !== input.revision) {
          throw new HttpError(409, 'RESERVATION_CHANGED', 'The reservation changed. Review the latest details and try again.')
        }
        const { startsAt, endsAt } = validateSlot(input.startsAt, now)
        if (startsAt.getTime() === booking.startsAt.getTime()) {
          throw new HttpError(400, 'SAME_SLOT', 'Choose a different date or time')
        }
        for (const table of await candidateTables(tx, booking.partySize)) {
          await tx.$executeRaw`SAVEPOINT reschedule_candidate`
          try {
            checkResizable(booking, Date.now())
            await tx.$executeRaw`UPDATE "Reservation"
              SET "tableId" = ${table.id}, "startsAt" = ${startsAt}, "endsAt" = ${endsAt},
                  "updatedAt" = GREATEST(clock_timestamp() AT TIME ZONE 'UTC', "updatedAt" + interval '1 millisecond')
              WHERE "id" = ${booking.id}`
          } catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2010' && exclusionViolation.safeParse(error.meta).success)) throw error
            await tx.$executeRaw`ROLLBACK TO SAVEPOINT reschedule_candidate`
            await tx.$executeRaw`RELEASE SAVEPOINT reschedule_candidate`
            continue
          }
          checkResizable(booking, Date.now())
          await tx.$executeRaw`RELEASE SAVEPOINT reschedule_candidate`
          return guestDetails(await tx.reservation.findUniqueOrThrow({ where: { id: booking.id }, select: guestSelect }))
        }
        throw new HttpError(409, 'SLOT_UNAVAILABLE', 'That time is no longer available. Your reservation was not changed.')
      })
    } catch (error) {
      const concurrentUpdate = z.object({ driverAdapterError: z.object({
        cause: z.object({ originalCode: z.enum(['40P01', '40001']) }),
      }) })
      if (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' || concurrentUpdate.safeParse(error.meta).success)) {
        throw new HttpError(409, 'SLOT_UNAVAILABLE', 'That time is no longer available. Your reservation was not changed.')
      }
      throw error
    }
  })

  app.post('/reservations/:code/cancel', { preHandler: rateLimit }, async (request, reply) => {
    const { code } = codeParams.parse(request.params)
    requireAccess(request, code)
    const updated = await db.reservation.updateMany({
      where: { code, status: 'CONFIRMED', startsAt: { gt: new Date(Date.now() + cancellationCutoff) } },
      data: { status: 'CANCELLED' },
    })
    if (!updated.count) {
      if (!await db.reservation.findUnique({ where: { code }, select: { code: true } })) {
        throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found')
      }
      throw new HttpError(409, 'CANNOT_CANCEL', 'This reservation can no longer be cancelled online')
    }
    return reply.header('Cache-Control', 'no-store').send({ status: 'CANCELLED' })
  })
}
