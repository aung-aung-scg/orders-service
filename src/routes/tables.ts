import { randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import QRCode from 'qrcode'
import { z } from 'zod'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { HttpError } from '../lib/errors.js'

const tableBody = z.strictObject({ number: z.number().int().min(1).max(2147483647) })

export function registerTables(app: FastifyInstance, db: PrismaClient, publicBaseUrl: string) {
  app.get('/tables', () => db.diningTable.findMany({ orderBy: { number: 'asc' } }))

  app.post('/tables', async (request, reply) => {
    const { number } = tableBody.parse(request.body)
    const table = await db.diningTable.create({
      data: { number, qrToken: randomBytes(24).toString('base64url') },
    })
    return reply.code(201).send(table)
  })

  app.get('/tables/:id/qr', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const table = await db.diningTable.findUnique({ where: { id }, select: { qrToken: true } })
    if (!table) throw new HttpError(404, 'TABLE_NOT_FOUND', 'Table not found')
    const url = new URL('/t/' + table.qrToken, publicBaseUrl)
    const svg = await QRCode.toString(url.href, { type: 'svg' })
    return reply.type('image/svg+xml').send(svg)
  })
}
