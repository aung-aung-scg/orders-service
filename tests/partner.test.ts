import { createServer, type RequestListener } from 'node:http'
import { once } from 'node:events'
import { afterEach, expect, test } from 'vitest'
import { PartnerClient, PartnerDataError } from '../src/partner/client.js'

let server: ReturnType<typeof createServer> | undefined
afterEach(async () => {
  if (server?.listening) {
    const active = server
    await new Promise<void>((resolve, reject) => {
      active.close(error => error ? reject(error) : resolve())
      active.closeAllConnections()
    })
  }
  server = undefined
})

async function serve(handler: RequestListener, timeoutMs = 2000) {
  server = createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected a TCP address')
  return new PartnerClient('http://127.0.0.1:' + address.port, { baseDelayMs: 1, timeoutMs })
}

test('retries 5xx and returns validated orders', async () => {
  let calls = 0
  const orders = [{ id: 'partner-1', status: 'PAID' }]
  const client = await serve((_request, response) => {
    if (++calls < 3) response.writeHead(503).end()
    else response.writeHead(200).end(JSON.stringify(orders))
  })

  expect(await client.listOrders()).toEqual(orders)
  expect(calls).toBe(3)
})

test('fails fast on invalid partner schema', async () => {
  let calls = 0
  const client = await serve((_request, response) => {
    calls++
    response.writeHead(200).end(JSON.stringify([{ id: 'partner-1', status: 'UNKNOWN' }]))
  })

  await expect(client.listOrders()).rejects.toBeInstanceOf(PartnerDataError)
  expect(calls).toBe(1)
})

test('times out when a response body stalls', async () => {
  const client = await serve((_request, response) => {
    response.writeHead(200)
    response.write('[')
  }, 100)

  await expect(client.listOrders()).rejects.toMatchObject({ code: 'PARTNER_TIMEOUT' })
})
