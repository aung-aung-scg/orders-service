import { z } from 'zod'

const identifier = z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/)
export const productBody = z.strictObject({
  name: z.string().trim().min(1).max(200),
  stock: z.number().int().min(0).max(2147483647),
})

export const orderBody = z.strictObject({
  id: identifier.optional(),
  items: z.array(z.strictObject({
    productId: identifier,
    quantity: z.number().int().min(1).max(2147483647),
  })).min(1).max(100),
})
export type OrderInput = z.infer<typeof orderBody>
export const idempotencyKey = z.string().trim().min(1).max(200)

export const paymentEvent = z.object({
  eventId: identifier,
  type: z.string().min(1).max(200),
  orderId: identifier.optional(),
}).refine(event => event.type !== 'payment.succeeded' || event.orderId !== undefined, {
  path: ['orderId'],
  message: 'orderId is required for payment.succeeded',
})
export type PaymentEvent = z.infer<typeof paymentEvent>
