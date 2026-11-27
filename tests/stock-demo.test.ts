import { randomUUID } from 'node:crypto'
import { expect, test, vi } from 'vitest'
import { buildApp } from '../src/app.js'

test('the demo is opt-in, authenticated and loopback-only, and unavailable in production', async () => {
  const kitchenApiKey = randomUUID()
  const headers = { 'x-kitchen-api-key': kitchenApiKey }
  vi.stubEnv('STOCK_DEMO_ENABLED', 'false')
  const disabled = buildApp({ kitchenApiKey })
  const local = buildApp({ kitchenApiKey, stockDemo: true })
  vi.stubEnv('NODE_ENV', 'production')
  const production = buildApp({ kitchenApiKey, stockDemo: true })
  try {
    expect((await disabled.inject({ url: '/products', headers })).statusCode).toBe(404)
    expect((await production.inject({ url: '/orders', headers })).statusCode).toBe(404)
    expect((await local.inject('/products')).statusCode).toBe(401)
    expect((await local.inject({ url: '/orders', remoteAddress: '192.0.2.10', headers })).statusCode).toBe(404)
    expect((await local.inject({ url: '/products', headers })).statusCode).toBe(200)
  } finally {
    vi.unstubAllEnvs()
    await Promise.all([disabled.close(), local.close(), production.close()])
  }
})
