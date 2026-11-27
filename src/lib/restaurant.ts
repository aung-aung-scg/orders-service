import type { FastifyRequest } from 'fastify'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { HttpError } from './errors.js'

export const defaultRestaurantId = 'default'
const reserved = new Set(['platform', 'api', 'login', 'book', 't', 'r', 'admin', 'menu-images'])

export function validRestaurantSlug(slug: string) {
  return slug.length >= 3 && slug.length <= 40 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !reserved.has(slug)
}

export function restaurantNotFound() {
  return new HttpError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found')
}

export function restaurantUnavailable() {
  return new HttpError(404, 'RESTAURANT_UNAVAILABLE', 'This restaurant is temporarily unavailable')
}

export async function restaurantBySlug(db: PrismaClient, slug: string) {
  if (!validRestaurantSlug(slug)) throw restaurantNotFound()
  const restaurant = await db.restaurant.findUnique({ where: { slug } })
  if (!restaurant) throw restaurantNotFound()
  if (!restaurant.active) throw restaurantUnavailable()
  return restaurant
}

declare module 'fastify' {
  interface FastifyRequest {
    restaurant: Awaited<ReturnType<typeof restaurantBySlug>>
  }
}

export async function requireRestaurant(db: PrismaClient, request: FastifyRequest) {
  const id = request.headers['x-restaurant-id']
  if (typeof id !== 'string' || !id.length || id.length > 200) {
    throw new HttpError(400, 'RESTAURANT_REQUIRED', 'X-Restaurant-Id is required')
  }
  const restaurant = await db.restaurant.findUnique({ where: { id, active: true } })
  if (!restaurant) throw restaurantNotFound()
  request.restaurant = restaurant
}
