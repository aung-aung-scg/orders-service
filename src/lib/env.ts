import 'dotenv/config'
import { z } from 'zod'

export function readEnv() {
  return z.object({
    WEBHOOK_SECRET: z.string().min(1),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  }).parse(process.env)
}

export function readPosEnv() {
  return z.object({
    KITCHEN_API_KEY: z.string().min(1).optional(),
    PUBLIC_BASE_URL: z.url({ protocol: /^https?$/ }).default('http://localhost:3001'),
  }).parse(process.env)
}
