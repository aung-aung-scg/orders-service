import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { z } from 'zod'
import { HttpError } from '../lib/errors.js'

const fields = {
  name: z.string().trim().min(1).max(80),
  priceMinor: z.number().int().min(0).max(2147483647),
  available: z.boolean(),
}
const createItem = z.strictObject({ ...fields, available: fields.available.default(true) })
const updateItem = z.strictObject(fields).partial().refine(
  value => Object.keys(value).length > 0, 'Supply at least one field',
)

export function registerStaffMenu(app: FastifyInstance, db: PrismaClient) {
  app.get('/staff/menu', () => db.menuItem.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] }))

  app.post('/staff/menu', async (request, reply) => {
    const data = createItem.parse(request.body)
    return reply.code(201).send(await db.menuItem.create({ data }))
  })

  app.patch('/staff/menu/:id', async request => {
    const { id } = z.object({ id: z.string().min(1).max(200) }).parse(request.params)
    const data = updateItem.parse(request.body)
    const [item] = await db.menuItem.updateManyAndReturn({ where: { id }, data })
    if (!item) throw new HttpError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found')
    return item
  })
}
