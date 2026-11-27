import { randomUUID } from 'node:crypto'
import multipart from '@fastify/multipart'
import type { FastifyInstance } from 'fastify'
import sharp from 'sharp'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { HttpError } from '../lib/errors.js'
import { menuImageFilename, menuImageMaxBytes, type ImageStorage } from '../lib/image-storage.js'

function supported(data: Buffer) {
  return data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ||
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP')
}

export function registerPublicMenuImages(app: FastifyInstance, storage: ImageStorage) {
  app.get<{ Params: { file: string } }>('/menu-images/:file', async (request, reply) => {
    const { file } = request.params
    const stream = menuImageFilename.test(file) ? await storage.read(file) : null
    if (!stream) throw new HttpError(404, 'IMAGE_NOT_FOUND', 'Menu image not found')
    return reply.type('image/webp')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(stream)
  })
}

export async function registerStaffMenuImages(app: FastifyInstance, db: PrismaClient, storage: ImageStorage) {
  await app.register(multipart, {
    limits: { fileSize: menuImageMaxBytes + 1, files: 1, fields: 1 },
  })

  async function replace(id: string, imageKey: string | null) {
    const previous = await db.menuItem.findUnique({ where: { id } })
    if (!previous) throw new HttpError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found')
    const [item] = await db.menuItem.updateManyAndReturn({
      where: { id, imageKey: previous.imageKey },
      data: { imageKey },
    })
    if (!item) throw new HttpError(409, 'IMAGE_CONFLICT', 'The image changed. Try again.')
    return { item, previousKey: previous.imageKey }
  }

  app.post<{ Params: { id: string } }>('/staff/menu/:id/image', async request => {
    let bytes: Buffer | undefined
    for await (const part of request.parts()) {
      if (part.type !== 'file') throw new HttpError(400, 'INVALID_IMAGE_FORM', 'Send exactly one image file')
      bytes = await part.toBuffer()
    }
    if (!bytes) throw new HttpError(400, 'IMAGE_REQUIRED', 'Choose one image file')
    if (bytes.length > menuImageMaxBytes) throw new HttpError(413, 'IMAGE_TOO_LARGE', 'Image must be 2 MB or smaller')
    if (!supported(bytes)) throw new HttpError(415, 'INVALID_IMAGE', 'Choose a JPEG, PNG, or WebP image')

    let image: Buffer
    try {
      image = await sharp(bytes, { limitInputPixels: 40_000_000 })
        .rotate().resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 }).toBuffer()
    } catch {
      throw new HttpError(415, 'INVALID_IMAGE', 'The image could not be decoded')
    }

    const key = randomUUID() + '.webp'
    await storage.save(key, image)
    const { item, previousKey } = await replace(request.params.id, key).catch(async error => {
      await storage.delete(key).catch(err => request.log.error({ err }, 'Could not clean up menu image'))
      throw error
    })
    if (previousKey) await storage.delete(previousKey).catch(err => request.log.error({ err }, 'Could not remove previous menu image'))
    return item
  })

  app.delete<{ Params: { id: string } }>('/staff/menu/:id/image', async request => {
    const { item, previousKey } = await replace(request.params.id, null)
    if (previousKey) await storage.delete(previousKey).catch(err => request.log.error({ err }, 'Could not remove menu image'))
    return item
  })
}
