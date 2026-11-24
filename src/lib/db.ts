import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '../../generated/prisma/client.js'

export async function lockTransaction(tx: Prisma.TransactionClient, namespace: string, key: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${namespace + ':' + key}, 0))`
}

export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is required')
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}
