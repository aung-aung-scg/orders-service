import { readFile } from 'node:fs/promises'
import { createDb } from '../src/lib/db.js'
import { PartnerDataError, partnerOrdersSchema } from '../src/partner/client.js'

async function reconcile() {
  let input: unknown
  try {
    input = JSON.parse(await readFile(new URL('../fixtures/partner-orders.json', import.meta.url), 'utf8'))
  } catch {
    throw new PartnerDataError('Could not read the partner orders fixture as JSON')
  }
  const parsed = partnerOrdersSchema.safeParse(input)
  if (!parsed.success) throw new PartnerDataError('Invalid partner orders fixture', parsed.error.issues)

  const db = createDb()
  try {
    const local = await db.order.findMany({ select: { id: true, status: true }, orderBy: { id: 'asc' } })
    const localById = new Map(local.map(order => [order.id, order.status]))
    const partnerById = new Map(parsed.data.map(order => [order.id, order.status]))
    const mismatches = []

    for (const { id, status: partnerStatus } of parsed.data) {
      const localStatus = localById.get(id)
      if (!localStatus) {
        mismatches.push({ code: 'MISSING_LOCALLY', id, partnerStatus })
      } else if (localStatus !== partnerStatus) {
        mismatches.push({ code: 'STATUS_DIFFERS', id, localStatus, partnerStatus })
      }
    }
    for (const { id, status: localStatus } of local) {
      if (!partnerById.has(id)) mismatches.push({ code: 'MISSING_AT_PARTNER', id, localStatus })
    }
    console.log(JSON.stringify(mismatches, null, 2))
  } finally {
    await db.$disconnect()
  }
}

try {
  await reconcile()
} catch (error) {
  console.error(JSON.stringify(error instanceof PartnerDataError
    ? { code: error.code, message: error.message, details: error.details }
    : { code: 'RECONCILIATION_FAILED', message: 'Could not compare local and partner orders' }))
  process.exitCode = 1
}
