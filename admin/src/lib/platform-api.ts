import "server-only";
import { z } from "zod";
import { request } from "./api";
import { platformHeaders, requirePlatform } from "./platform-auth";

const restaurant = z.object({ id: z.string(), name: z.string(), slug: z.string(), active: z.boolean(), createdAt: z.string() });
const credential = z.object({ username: z.string(), password: z.string().length(16) });
type PlatformSession = Awaited<ReturnType<typeof requirePlatform>>;
export type TemporaryCredential = z.infer<typeof credential>;

export function listRestaurants(session: PlatformSession) {
  return request("/platform/restaurants", z.array(restaurant), { cache: "no-store", headers: platformHeaders(session) });
}

export function createRestaurant(session: PlatformSession, input: { name: string; slug: string; timezone: string }) {
  return request("/platform/restaurants", z.object({ restaurant, credentials: z.array(credential) }), {
    method: "POST", cache: "no-store", headers: { ...platformHeaders(session), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function setRestaurantActive(session: PlatformSession, id: string, active: boolean) {
  return request("/platform/restaurants/" + encodeURIComponent(id), restaurant, {
    method: "PATCH", cache: "no-store", headers: { ...platformHeaders(session), "Content-Type": "application/json" },
    body: JSON.stringify({ active }),
  });
}

export function resetRestaurantPassword(session: PlatformSession, id: string, username: string) {
  return request("/platform/restaurants/" + encodeURIComponent(id) + "/reset-password", credential, {
    method: "POST", cache: "no-store", headers: { ...platformHeaders(session), "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
}
