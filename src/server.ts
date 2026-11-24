import { buildApp } from './app.js'
import { readEnv } from './lib/env.js'

const { PORT } = readEnv()
const app = buildApp({ logger: true })
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().catch(error => {
      app.log.error(error)
      process.exitCode = 1
    })
  })
}

try {
  await app.listen({ host: '0.0.0.0', port: PORT })
} catch (error) {
  app.log.error(error)
  await app.close()
  process.exitCode = 1
}
