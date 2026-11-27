import { z } from 'zod'
import { createDb } from '../src/lib/db.js'
import { hashStaffPassword } from '../src/lib/staff-password.js'

const env = z.object({
  STAFF_ADMIN_PASSWORD: z.string().min(1).max(1024),
  STAFF_KITCHEN_PASSWORD: z.string().min(1).max(1024),
}).parse(process.env)

const staff = [
  { username: 'admin', role: 'ADMIN', password: env.STAFF_ADMIN_PASSWORD },
  { username: 'kitchen', role: 'KITCHEN', password: env.STAFF_KITCHEN_PASSWORD },
] as const

const db = createDb()
try {
  const { id: restaurantId } = await db.restaurant.findUniqueOrThrow({ where: { slug: 'default' } })
  const users = await Promise.all(staff.map(async ({ username, role, password }) => ({
    username, role, passwordHash: await hashStaffPassword(password),
  })))
  await db.$transaction(users.map(({ username, role, passwordHash }) => db.staffUser.upsert({
    where: { restaurantId_username: { restaurantId, username } },
    create: { restaurantId, username, role, passwordHash },
    update: { role, passwordHash, credentialVersion: { increment: 1 } },
  })))
} finally {
  await db.$disconnect()
}
