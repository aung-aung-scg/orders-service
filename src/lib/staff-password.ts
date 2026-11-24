import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const keyLength = 64
const dummyHash = encode(randomBytes(24), randomBytes(keyLength))

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, (error, hash) => {
      if (error) reject(error)
      else resolve(hash)
    })
  })
}

function encode(salt: Buffer, hash: Buffer) {
  return salt.toString('hex') + ':' + hash.toString('hex')
}

export async function hashStaffPassword(password: string) {
  const salt = randomBytes(24)
  return encode(salt, await derive(password, salt))
}

export async function verifyStaffPassword(password: string, storedHash: string | undefined) {
  const knownHash = storedHash && /^[0-9a-f]{48}:[0-9a-f]{128}$/.test(storedHash)
  const [salt, hash] = (knownHash ? storedHash : dummyHash).split(':')
  const actual = await derive(password, Buffer.from(salt, 'hex'))
  const matches = timingSafeEqual(actual, Buffer.from(hash, 'hex'))
  return Boolean(knownHash && matches)
}
