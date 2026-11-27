import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { createDb } from '../src/lib/db.js'
import { hashStaffPassword } from '../src/lib/staff-password.js'

const password = z.string().min(10).max(1024).parse(process.env.SUPER_ADMIN_PASSWORD)
const passwordHash = await hashStaffPassword(password)
const db = createDb()
try {
  await db.$executeRaw`
    INSERT INTO "StaffUser" (id, username, "passwordHash", role)
      VALUES (${randomUUID()}, 'superadmin', ${passwordHash}, 'SUPER_ADMIN')
    ON CONFLICT (username) WHERE "restaurantId" IS NULL DO UPDATE
      SET "passwordHash" = EXCLUDED."passwordHash", "credentialVersion" = "StaffUser"."credentialVersion" + 1
  `
} finally {
  await db.$disconnect()
}
