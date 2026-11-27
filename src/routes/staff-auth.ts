import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { HttpError } from '../lib/errors.js'
import { hashStaffPassword, verifyStaffPassword } from '../lib/staff-password.js'

const credentials = z.strictObject({
  username: z.string().trim().toLowerCase().min(1).max(100),
  password: z.string().min(1).max(1024),
})
const passwordChange = z.strictObject({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(10).max(1024),
})
const invalidSession = () => new HttpError(401, 'INVALID_SESSION', 'Sign in again')

function staffSession(request: FastifyRequest) {
  const id = request.headers['x-staff-id']
  const version = request.headers['x-staff-version']
  if (typeof id !== 'string' || typeof version !== 'string' || !/^\d{1,10}$/.test(version) || Number(version) > 2147483647) {
    throw invalidSession()
  }
  return { id, restaurantId: request.restaurant.id, credentialVersion: Number(version) }
}

export function registerStaffAuth(app: FastifyInstance, db: PrismaClient) {
  app.post('/auth/verify', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    const input = credentials.safeParse(request.body)
    if (!input.success) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid username or password')
    const { username, password } = input.data
    const staff = await db.staffUser.findUnique({
      where: { restaurantId_username: { restaurantId: request.restaurant.id, username } },
      select: { id: true, username: true, role: true, passwordHash: true, restaurantId: true, mustChangePassword: true, credentialVersion: true },
    })
    const matches = await verifyStaffPassword(password, staff?.passwordHash)
    if (!staff || !matches) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid username or password')
    const { id, role, restaurantId, mustChangePassword, credentialVersion } = staff
    return { id, username, role, restaurantId, mustChangePassword, credentialVersion }
  })

  app.get('/auth/session', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    const staff = await db.staffUser.findUnique({
      where: staffSession(request), select: { role: true, mustChangePassword: true },
    })
    if (!staff) throw invalidSession()
    return staff
  })

  app.post('/auth/change-password', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    const where = { ...staffSession(request), mustChangePassword: true }
    const { currentPassword, newPassword } = passwordChange.parse(request.body)
    const staff = await db.staffUser.findUnique({ where, select: { passwordHash: true } })
    if (!staff) throw invalidSession()
    if (!await verifyStaffPassword(currentPassword, staff.passwordHash)) {
      throw new HttpError(400, 'WRONG_PASSWORD', 'Current password is incorrect')
    }
    if (newPassword === currentPassword) {
      throw new HttpError(400, 'PASSWORD_UNCHANGED', 'Choose a different password')
    }
    const [updated] = await db.staffUser.updateManyAndReturn({
      where,
      data: { passwordHash: await hashStaffPassword(newPassword), mustChangePassword: false, credentialVersion: { increment: 1 } },
      select: { credentialVersion: true },
    })
    if (!updated) throw invalidSession()
    return updated
  })
}
