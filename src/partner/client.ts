import { setTimeout as delay } from 'node:timers/promises'
import { z } from 'zod'

export const partnerOrdersSchema = z.array(z.object({
  id: z.string().min(1),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED']),
})).refine(orders => new Set(orders.map(order => order.id)).size === orders.length, {
  message: 'Partner order IDs must be unique',
})
export type PartnerOrder = z.infer<typeof partnerOrdersSchema>[number]

export class PartnerDataError extends Error {
  readonly code = 'PARTNER_BAD_DATA'
  constructor(message: string, public details?: unknown) {
    super(message)
    this.name = 'PartnerDataError'
  }
}

export class PartnerRequestError extends Error {
  constructor(
    public code: 'PARTNER_HTTP_ERROR' | 'PARTNER_TIMEOUT' | 'PARTNER_NETWORK_ERROR',
    message: string,
    public retryable: boolean,
    public details?: { status: number },
  ) {
    super(message)
    this.name = 'PartnerRequestError'
  }
}

type PartnerOptions = {
  timeoutMs?: number
  maxAttempts?: number
  baseDelayMs?: number
}

export class PartnerClient {
  private readonly url: URL
  private readonly timeoutMs: number
  private readonly maxAttempts: number
  private readonly baseDelayMs: number

  constructor(baseUrl: string, { timeoutMs = 2000, maxAttempts = 3, baseDelayMs = 100 }: PartnerOptions = {}) {
    z.number().int().min(1).max(10).parse(maxAttempts)
    z.number().int().min(1).max(60000).parse(timeoutMs)
    z.number().int().min(0).max(60000).parse(baseDelayMs)
    this.url = new URL('orders', baseUrl.endsWith('/') ? baseUrl : baseUrl + '/')
    this.timeoutMs = timeoutMs
    this.maxAttempts = maxAttempts
    this.baseDelayMs = baseDelayMs
  }

  async listOrders(): Promise<PartnerOrder[]> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.fetchOrders()
      } catch (error) {
        if (!(error instanceof PartnerRequestError) || !error.retryable || attempt >= this.maxAttempts) throw error
        const cap = Math.min(5000, this.baseDelayMs * 2 ** (attempt - 1))
        await delay(Math.floor(Math.random() * (cap + 1)))
      }
    }
  }

  private async fetchOrders() {
    const signal = AbortSignal.timeout(this.timeoutMs)
    try {
      const response = await fetch(this.url, { signal, headers: { accept: 'application/json' } })
      if (!response.ok) {
        void response.body?.cancel().catch(() => {})
        throw new PartnerRequestError('PARTNER_HTTP_ERROR', 'Partner returned an HTTP error',
          response.status >= 500, { status: response.status })
      }

      const raw: unknown = await response.json()
      const parsed = partnerOrdersSchema.safeParse(raw)
      if (!parsed.success) throw new PartnerDataError('Partner orders failed schema validation', parsed.error.issues)
      return parsed.data
    } catch (error) {
      if (error instanceof PartnerRequestError || error instanceof PartnerDataError) throw error
      if (signal.aborted) throw new PartnerRequestError('PARTNER_TIMEOUT', 'Partner request timed out', true)
      if (error instanceof SyntaxError) throw new PartnerDataError('Partner returned invalid JSON')
      throw new PartnerRequestError('PARTNER_NETWORK_ERROR', 'Partner request failed', true)
    }
  }
}
