import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { z } from 'zod'
import { HttpError } from '../lib/errors.js'
import { validRestaurantSlug } from '../lib/restaurant.js'
import { hashStaffPassword, verifyStaffPassword } from '../lib/staff-password.js'

const name = z.string().trim().min(1).max(120)
const timezone = z.string().max(80).refine(value => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}, 'Use a valid timezone')
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
const settings = z.strictObject({
  timezone,
  openTime: clock,
  closeTime: clock,
  slotMinutes: z.number().int().min(1).max(1440),
  durationMinutes: z.number().int().min(1).max(1440),
  maxDaysAhead: z.number().int().min(1).max(365),
  minLeadMinutes: z.number().int().min(0).max(2147483647),
  cancelCutoffMinutes: z.number().int().min(0).max(2147483647),
  maxParty: z.number().int().min(1).max(2147483647),
})
const createBody = z.strictObject({
  name, slug: z.string().refine(validRestaurantSlug, 'Invalid or reserved restaurant slug'),
  timezone: timezone.default('Asia/Bangkok'),
})
const patchBody = z.strictObject({ name, active: z.boolean(), settings: settings.partial() }).partial()
const idParams = z.object({ id: z.string().min(1).max(200) })
const usernameInput = z.string().trim().toLowerCase().min(1).max(100)
const loginBody = z.strictObject({ username: usernameInput, password: z.string().min(1).max(1024) })
const invalidCredentials = () => new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid username or password')
const denied = () => new HttpError(403, 'PLATFORM_FORBIDDEN', 'Platform access required')
const missingRestaurant = () => new HttpError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found')

async function temporaryCredentials(username: string) {
  const password = randomBytes(12).toString('base64url')
  return { username, password, passwordHash: await hashStaffPassword(password) }
}

export function registerPlatform(app: FastifyInstance, db: PrismaClient, key: string | undefined, revokeStreams: (id: string) => void) {
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    const supplied = request.headers['x-platform-api-key']
    if (!key || typeof supplied !== 'string') throw new HttpError(401, 'UNAUTHORIZED', 'Platform API key required')
    const actual = Buffer.from(supplied)
    const expected = Buffer.from(key)
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Platform API key required')
    }
  })

  async function actor(request: FastifyRequest) {
    const id = request.headers['x-platform-actor-id']
    const version = request.headers['x-platform-actor-version']
    if (typeof id !== 'string' || typeof version !== 'string' || !/^\d{1,10}$/.test(version) || Number(version) > 2147483647) {
      throw denied()
    }
    const staff = await db.staffUser.findUnique({
      where: { id, restaurantId: null, role: 'SUPER_ADMIN', credentialVersion: Number(version) },
      select: { id: true },
    })
    if (!staff) throw denied()
    return staff.id
  }

  app.post('/platform/auth/verify', async request => {
    const input = loginBody.safeParse(request.body)
    if (!input.success) throw invalidCredentials()
    const { username, password } = input.data
    const staff = await db.staffUser.findFirst({
      where: { username, restaurantId: null, role: 'SUPER_ADMIN' },
      select: { id: true, username: true, role: true, passwordHash: true, credentialVersion: true },
    })
    const matches = await verifyStaffPassword(password, staff?.passwordHash)
    if (!staff || !matches) throw invalidCredentials()
    return { id: staff.id, username: staff.username, role: staff.role, credentialVersion: staff.credentialVersion }
  })

  app.get('/platform/restaurants', async request => {
    await actor(request)
    return db.restaurant.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] })
  })

  app.post('/platform/restaurants', async (request, reply) => {
    const actorId = await actor(request)
    const data = createBody.parse(request.body)
    const passwords = await Promise.all([
      temporaryCredentials('admin'), temporaryCredentials('kitchen'),
    ])
    const restaurant = await db.$transaction(async tx => {
      const created = await tx.restaurant.create({ data })
      await tx.staffUser.createMany({ data: passwords.map(({ username, passwordHash }) => ({
        restaurantId: created.id, username, passwordHash, role: username === 'admin' ? 'ADMIN' : 'KITCHEN',
        mustChangePassword: true,
      })) })
      await tx.platformAudit.create({ data: { restaurantId: created.id, actor: actorId, action: 'CREATE' } })
      return created
    })
    return reply.code(201).send({
      restaurant, credentials: passwords.map(({ username, password }) => ({ username, password })),
    })
  })

  app.patch('/platform/restaurants/:id', async request => {
    const actorId = await actor(request)
    const { id } = idParams.parse(request.params)
    const { name, active, settings } = patchBody.parse(request.body)
    const { restaurant, suspended } = await db.$transaction(async tx => {
      const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Restaurant" WHERE id = ${id} FOR UPDATE`
      if (!locked) throw missingRestaurant()
      const current = await tx.restaurant.findUniqueOrThrow({ where: { id } })
      if ((settings?.openTime ?? current.openTime) >= (settings?.closeTime ?? current.closeTime)) {
        throw new HttpError(400, 'INVALID_BOOKING_HOURS', 'Closing time must be later than opening time')
      }
      const restaurant = await tx.restaurant.update({ where: { id }, data: { ...settings, name, active } })
      if (active !== undefined && current.active !== active) {
        await tx.platformAudit.create({ data: {
          restaurantId: id, actor: actorId, action: active ? 'REACTIVATE' : 'SUSPEND',
        } })
      }
      return { restaurant, suspended: current.active && !restaurant.active }
    })
    if (suspended) revokeStreams(id)
    return restaurant
  })

  app.post('/platform/restaurants/:id/reset-password', async request => {
    const actorId = await actor(request)
    const { id } = idParams.parse(request.params)
    const { username } = z.strictObject({ username: usernameInput }).parse(request.body)
    const { password, passwordHash } = await temporaryCredentials(username)
    await db.$transaction(async tx => {
      const updated = await tx.staffUser.updateMany({
        where: { restaurantId: id, username, role: { in: ['ADMIN', 'KITCHEN'] } },
        data: { passwordHash, mustChangePassword: true, credentialVersion: { increment: 1 } },
      })
      if (!updated.count) throw new HttpError(404, 'STAFF_NOT_FOUND', 'Staff user not found')
      await tx.platformAudit.create({ data: { restaurantId: id, actor: actorId, action: 'RESET_PASSWORD' } })
    })
    revokeStreams(id)
    return { username, password }
  })
}
