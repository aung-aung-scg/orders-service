import { createReadStream, type ReadStream } from 'node:fs'
import { mkdir, open, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Readable } from 'node:stream'

export const menuImageFilename = /^[a-f0-9-]{36}\.webp$/
export const menuImageMaxBytes = 2 * 1024 * 1024

export interface ImageStorage {
  save(key: string, image: Buffer): Promise<void>
  delete(key: string): Promise<void>
  read(key: string): Promise<Readable | null>
}

function missing(error: unknown) {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

export function localImageStorage(directory = process.env.UPLOAD_DIR ?? './uploads/menu'): ImageStorage {
  const root = resolve(directory)
  function pathFor(key: string) {
    if (!menuImageFilename.test(key)) throw new Error('Invalid menu image key')
    return join(root, key)
  }
  return {
    async save(key, image) {
      await mkdir(root, { recursive: true })
      await writeFile(pathFor(key), image, { flag: 'wx' })
    },
    async delete(key) {
      try {
        await unlink(pathFor(key))
      } catch (error) {
        if (!missing(error)) throw error
      }
    },
    async read(key): Promise<ReadStream | null> {
      try {
        return (await open(pathFor(key), 'r')).createReadStream()
      } catch (error) {
        if (missing(error)) return null
        throw error
      }
    },
  }
}
