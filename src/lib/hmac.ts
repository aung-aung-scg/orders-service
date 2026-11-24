import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifySignature(body: Buffer, signature: unknown, secret: string) {
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) return false
  const expected = createHmac('sha256', secret).update(body).digest()
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'))
}
