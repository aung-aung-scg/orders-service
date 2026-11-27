import { z } from 'zod'
import type { PrismaClient, Restaurant } from '../../generated/prisma/client.js'
import { defaultRestaurantId } from './restaurant.js'

const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
const positive = z.coerce.number().int().positive()
export const dateInput = z.iso.date()
export const minute = 60_000

function bookingDefaults() {
  return z.object({
    BOOKING_TZ: z.string().default('Asia/Bangkok'),
    BOOKING_OPEN: time.default('10:00'),
    BOOKING_CLOSE: time.default('22:00'),
    BOOKING_SLOT_MINUTES: positive.max(1440).default(30),
    BOOKING_DURATION_MINUTES: positive.max(1440).default(90),
    BOOKING_MAX_DAYS_AHEAD: positive.max(365).default(30),
    BOOKING_MIN_LEAD_MINUTES: z.coerce.number().int().nonnegative().default(60),
    BOOKING_CANCEL_CUTOFF_MINUTES: z.coerce.number().int().nonnegative().default(120),
    BOOKING_MAX_PARTY: positive.max(2147483647).default(10),
  }).parse(process.env)
}

export function readBookingConfig(restaurant?: Restaurant) {
  const env = restaurant ? {
    BOOKING_TZ: restaurant.timezone,
    BOOKING_OPEN: restaurant.openTime,
    BOOKING_CLOSE: restaurant.closeTime,
    BOOKING_SLOT_MINUTES: restaurant.slotMinutes,
    BOOKING_DURATION_MINUTES: restaurant.durationMinutes,
    BOOKING_MAX_DAYS_AHEAD: restaurant.maxDaysAhead,
    BOOKING_MIN_LEAD_MINUTES: restaurant.minLeadMinutes,
    BOOKING_CANCEL_CUTOFF_MINUTES: restaurant.cancelCutoffMinutes,
    BOOKING_MAX_PARTY: restaurant.maxParty,
  } : bookingDefaults()
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.BOOKING_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
  const open = minutes(env.BOOKING_OPEN)
  const close = minutes(env.BOOKING_CLOSE)
  if (open >= close) throw new Error('BOOKING_CLOSE must be later than BOOKING_OPEN')

  function localParts(timestamp: number) {
    const parts = Object.fromEntries(format.formatToParts(timestamp).map(part => [part.type, part.value]))
    return { day: `${parts.year}-${parts.month}-${parts.day}`, minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute) }
  }

  function instant(day: string, minuteOfDay: number) {
    const target = Date.parse(day + 'T00:00:00Z') + minuteOfDay * minute
    let guess = target
    for (let attempt = 0; attempt < 4; attempt++) {
      const local = localParts(guess)
      const difference = target - (Date.parse(local.day + 'T00:00:00Z') + local.minuteOfDay * minute)
      if (!difference) return guess
      guess += difference
    }
    return null
  }

  return { env, open, close, instant, localParts }
}

export async function seedDefaultRestaurant(db: PrismaClient) {
  const { env } = readBookingConfig()
  const settings = {
    timezone: env.BOOKING_TZ, openTime: env.BOOKING_OPEN, closeTime: env.BOOKING_CLOSE,
    slotMinutes: env.BOOKING_SLOT_MINUTES, durationMinutes: env.BOOKING_DURATION_MINUTES,
    maxDaysAhead: env.BOOKING_MAX_DAYS_AHEAD, minLeadMinutes: env.BOOKING_MIN_LEAD_MINUTES,
    cancelCutoffMinutes: env.BOOKING_CANCEL_CUTOFF_MINUTES, maxParty: env.BOOKING_MAX_PARTY,
  }
  return db.restaurant.upsert({
    where: { slug: 'default' }, create: { id: defaultRestaurantId, slug: 'default', name: 'Restaurant', ...settings },
    update: settings,
  })
}

export function shiftDay(day: string, days: number) {
  return new Date(Date.parse(day + 'T00:00:00Z') + days * 1440 * minute).toISOString().slice(0, 10)
}
