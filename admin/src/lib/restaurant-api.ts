import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { BackendError, request } from "./api";

const restaurant = z.object({
  id: z.string(), slug: z.string(), name: z.string(), timezone: z.string(),
  openTime: z.string(), closeTime: z.string(), maxDaysAhead: z.number(), maxParty: z.number(),
});

export const getRestaurant = cache((slug: string) => {
  return request("/restaurants/" + encodeURIComponent(slug), restaurant, { cache: "no-store" });
});

export function listPublicRestaurantSlugs() {
  return request("/restaurants", z.array(z.object({ slug: z.string() })), { cache: "no-store" });
}

export function isRestaurantUnavailable(error: unknown) {
  return error instanceof BackendError && error.code === "RESTAURANT_UNAVAILABLE";
}

export async function publicRestaurant(slug: string) {
  return getRestaurant(slug).catch(error => {
    if (isRestaurantUnavailable(error)) redirect("/restaurant-unavailable");
    if (error instanceof BackendError && error.status === 404) notFound();
    throw error;
  });
}
