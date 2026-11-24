import "server-only";
import { z } from "zod";

const product = z.object({
  id: z.string(),
  name: z.string(),
  stock: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});
const order = z.object({
  id: z.string(),
  status: z.enum(["PENDING", "PAID", "CANCELLED"]),
  createdAt: z.iso.datetime(),
  items: z.array(z.object({
    id: z.string(),
    productId: z.string(),
    quantity: z.number().int().positive(),
  })),
});
const errorResponse = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export class BackendError extends Error {
  constructor(public status: number, public code: string, public backendMessage: string, public details?: unknown) {
    super(`Backend returned HTTP ${status} (${code}): ${backendMessage}`);
  }
}

async function request<T>(path: string, schema: z.ZodType<T>, options: RequestInit): Promise<T> {
  const baseUrl = process.env.BACKEND_URL;
  if (!baseUrl) throw new Error("BACKEND_URL is required");

  let response: Response;
  try {
    response = await fetch(new URL(path, baseUrl), options);
  } catch (cause) {
    throw new Error(`Could not reach backend for ${path}`, { cause });
  }
  const data: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = errorResponse.safeParse(data);
    if (error.success) {
      const { code, message, details } = error.data;
      throw new BackendError(response.status, code, message, details);
    }
    throw new Error(`Backend returned HTTP ${response.status} for ${path} without a valid error body`);
  }

  const result = schema.safeParse(data);
  if (!result.success) throw new Error(`Invalid backend response for ${path}`, { cause: result.error });
  return result.data;
}

export const productsTag = "products";

export function getProducts() {
  return request("/products", z.array(product), { next: { revalidate: 30, tags: [productsTag] } });
}

export function getOrders() {
  return request("/orders", z.array(order), { cache: "no-store" });
}

export function createProduct(input: { name: string; stock: number }) {
  return request("/products", product, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function createOrder(input: { items: { productId: string; quantity: number }[] }, key: string) {
  return request("/orders", order, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(input),
  });
}
