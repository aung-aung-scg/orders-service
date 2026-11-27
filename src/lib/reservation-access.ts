import { createHmac, timingSafeEqual } from 'node:crypto'

export const reservationAccessSeconds = 86400
export const reservationCodePattern = /^[\w-]{22,80}$/

export function normalizeBookingPhone(value: string) {
  if (value.length > 40 || !/^\+?[\d().\s-]+$/.test(value.trim())) return null
  const digits = value.replace(/\D/g, '')
  return /^\d{7,15}$/.test(digits) ? digits : null
}

export function reservationAccess(secret: string | Buffer) {
  const sign = (value: string) => createHmac('sha256', secret).update('reservation-access:' + value).digest()
  return {
    issue(code: string, now = Date.now()) {
      const payload = code + '.' + (Math.floor(now / 1000) + reservationAccessSeconds)
      return payload + '.' + sign(payload).toString('base64url')
    },
    read(value: unknown) {
      if (typeof value !== 'string' || value.length > 150) return null
      const [code, expiry, signature, extra] = value.split('.')
      if (extra !== undefined || !reservationCodePattern.test(code) || !/^\d{10}$/.test(expiry ?? '') ||
          !/^[\w-]{43}$/.test(signature ?? '') || Number(expiry) <= Math.floor(Date.now() / 1000)) return null
      return timingSafeEqual(sign(code + '.' + expiry), Buffer.from(signature, 'base64url')) ? code : null
    },
  }
}
