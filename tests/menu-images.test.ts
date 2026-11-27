import { randomUUID } from 'node:crypto'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { buildApp } from '../src/app.js'
import { createDb } from '../src/lib/db.js'
import { localImageStorage, menuImageMaxBytes } from '../src/lib/image-storage.js'

const db = createDb()
const staff = { 'x-kitchen-api-key': randomUUID() }
let directory: string
let app: ReturnType<typeof buildApp>
let id: string

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'menu-images-'))
  app = buildApp({ db, kitchenApiKey: staff['x-kitchen-api-key'], imageStorage: localImageStorage(directory) })
  id = (await db.menuItem.create({ data: { name: 'Image test ' + randomUUID(), priceMinor: 100 } })).id
})

afterAll(async () => {
  try {
    if (id) await db.menuItem.delete({ where: { id } })
  } finally {
    await app?.close()
    await db.$disconnect()
    if (directory) await rm(directory, { recursive: true, force: true })
  }
})

function upload(bytes: Buffer, headers: Record<string, string> = staff) {
  const boundary = randomUUID()
  return app.inject({
    method: 'POST', url: '/staff/menu/' + id + '/image',
    headers: { ...headers, 'content-type': 'multipart/form-data; boundary=' + boundary },
    payload: Buffer.concat([
      Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="image"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n'),
      bytes,
      Buffer.from('\r\n--' + boundary + '--\r\n'),
    ]),
  })
}

test('normalizes JPEG, PNG and WebP, replaces files and removes images idempotently', async () => {
  let oldKey: string | undefined
  for (const format of ['jpeg', 'png', 'webp'] as const) {
    let input = sharp({ create: { width: 1000, height: 500, channels: 3, background: 'orange' } }).toFormat(format)
    if (format === 'jpeg') {
      input = input.withMetadata({ orientation: 6 }).withExifMerge({
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '13/1 45/1 0/1' },
      })
    }
    const bytes = await input.toBuffer()
    if (format === 'jpeg') {
      const original = await sharp(bytes).metadata()
      expect(original.exif).toBeDefined()
      expect(original.orientation).toBe(6)
    }
    const saved = await upload(bytes)
    expect(saved.statusCode, saved.body).toBe(200)
    const key = saved.json().imageKey
    expect(await readdir(directory)).toEqual([key])
    if (oldKey) expect((await app.inject('/menu-images/' + oldKey)).statusCode).toBe(404)
    const served = await app.inject('/menu-images/' + key)
    expect(served.statusCode).toBe(200)
    expect(served.headers).toMatchObject({
      'content-type': 'image/webp',
      'x-content-type-options': 'nosniff',
      'cache-control': 'public, max-age=31536000, immutable',
    })
    const result = await sharp(served.rawPayload).metadata()
    expect(result.format).toBe('webp')
    expect([result.width, result.height]).toEqual(format === 'jpeg' ? [400, 800] : [800, 400])
    expect(result.exif).toBeUndefined()
    oldKey = key
  }

  const table = await db.diningTable.create({ data: {
    number: 1_000_000 + Math.floor(Math.random() * 1_000_000_000), qrToken: randomUUID(),
  } })
  try {
    const session = await app.inject({
      method: 'POST', url: '/staff/table-sessions/' + table.id + '/reset', headers: staff,
      payload: { expectedSessionId: null, actor: { id: 'qa-staff', role: 'KITCHEN' } },
    })
    expect(session.statusCode).toBe(200)
    const url = '/t/' + table.qrToken
    const joined = await app.inject({ method: 'POST', url: url + '/join', payload: { code: session.json().joinCode } })
    expect(joined.statusCode).toBe(200)
    const { sessionId, accessToken } = joined.json()
    const guest = await app.inject({ url, headers: { 'x-dining-session': accessToken, 'x-dining-session-id': sessionId } })
    expect(guest.json().menu).toContainEqual(expect.objectContaining({ id, imageKey: oldKey }))
    const menu = await app.inject({ url: '/staff/menu', headers: staff })
    expect(menu.json()).toContainEqual(expect.objectContaining({ id, imageKey: oldKey }))
  } finally {
    await db.diningSession.deleteMany({ where: { tableId: table.id } })
    await db.diningTable.delete({ where: { id: table.id } })
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const deleted = await app.inject({ method: 'DELETE', url: '/staff/menu/' + id + '/image', headers: staff })
    expect(deleted.statusCode).toBe(200)
    expect(deleted.json().imageKey).toBeNull()
    expect(await readdir(directory)).toEqual([])
  }
})

test('rejects disguised files, oversize uploads, missing keys and traversal paths', async () => {
  for (const text of ['plain text', '<svg xmlns="http://www.w3.org/2000/svg"/>']) {
    expect((await upload(Buffer.from(text))).statusCode).toBe(415)
  }
  expect((await upload(Buffer.alloc(menuImageMaxBytes + 1))).statusCode).toBe(413)
  expect((await upload(Buffer.from('text'), {})).statusCode).toBe(401)
  expect((await app.inject({ method: 'DELETE', url: '/staff/menu/' + id + '/image' })).statusCode).toBe(401)
  for (const file of ['..%2f.env', '%2e%2e%5c.env', 'unknown.webp']) {
    expect([400, 404]).toContain((await app.inject('/menu-images/' + file)).statusCode)
  }
})
