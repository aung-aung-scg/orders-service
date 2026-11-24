import 'dotenv/config'
import { z } from 'zod'

export function readEnv() {
  return z.object({
    WEBHOOK_SECRET: z.string().min(1),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  }).parse(process.env)
}
