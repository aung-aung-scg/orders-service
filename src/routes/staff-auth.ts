import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { HttpError } from '../lib/errors.js'
import { verifyStaffPassword } from '../lib/staff-password.js'

const credentials = z.strictObject({
  username: z.string().trim().toLowerCase().min(1).max(100),
  password: z.string().min(1).max(1024),
})

export function registerStaffAuth(app: FastifyInstance, db: PrismaClient) {
  app.post('/auth/verify', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    const input = credentials.safeParse(request.body)
    if (!input.success) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid username or password')
    const { username, password } = input.data
    const staff = await db.staffUser.findUnique({
      where: { username },
      select: { id: true, username: true, role: true, passwordHash: true },
    })
    const matches = await verifyStaffPassword(password, staff?.passwordHash)
    if (!staff || !matches) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid username or password')
    return { id: staff.id, username: staff.username, role: staff.role }
  })
}
