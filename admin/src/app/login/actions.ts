"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BackendError, request } from "@/lib/api";
import { getSession, sessionCookie, setStaffSession, staffRole, type StaffRole } from "@/lib/auth";
import { kitchenApiKeyHeaders } from "@/lib/pos-api";
import { getRestaurant } from "@/lib/restaurant-api";

const credentials = z.object({
  username: z.string().trim().toLowerCase().min(1).max(100),
  password: z.string().min(1).max(1024),
});
const staff = z.object({
  id: z.string().min(1), username: z.string().min(1), role: staffRole, restaurantId: z.string(),
  mustChangePassword: z.boolean(), credentialVersion: z.number().int().nonnegative(),
});
type LoginState = { error?: string };
const invalid = { error: "Unable to sign in. Check your credentials or try again later." };
const attempts = new Map<string, { count: number; expires: number }>();
const windowMs = 15 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.expires <= now) attempts.delete(key);
}, 60_000).unref();

function destination(value: FormDataEntryValue | null, role: StaffRole, slug: string) {
  const fallback = role === "ADMIN" ? "/menu" : "/kitchen";
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 2048) return fallback;
  try {
    const origin = "https://orders-admin.invalid";
    const decoded = decodeURIComponent(value);
    if (!/^\/(?!\/)/.test(decoded) || /[\\\p{Cc}]/u.test(decoded)) return fallback;
    const target = new URL(value, origin);
    if (target.origin !== origin || !/^\/(?!\/)/.test(decodeURIComponent(target.pathname))) {
      return fallback;
    }
    const prefix = "/r/" + slug;
    if (target.pathname.startsWith("/r/") && !target.pathname.startsWith(prefix + "/")) return fallback;
    const staffPath = target.pathname.startsWith(prefix + "/") ? target.pathname.slice(prefix.length) : target.pathname;
    if (staffPath === "/login") return fallback;
    if (role === "KITCHEN" && staffPath !== "/reservations" && !/^\/(?:kitchen|table-sessions)(?:\/|$)/.test(staffPath)) return fallback;
    return target.pathname + target.search + target.hash;
  } catch {
    return fallback;
  }
}

export async function login(slug: string, _state: LoginState, form: FormData): Promise<LoginState> {
  const input = credentials.safeParse({ username: form.get("username"), password: form.get("password") });
  if (!input.success) return invalid;

  const ip = (await headers()).get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
  const existing = await getSession();
  if (existing && existing.restaurantSlug !== slug) redirect("/r/" + existing.restaurantSlug + "/login");
  const key = JSON.stringify([slug, input.data.username, ip]);
  const now = Date.now();
  let entry = attempts.get(key);
  if (!entry || entry.expires <= now) {
    entry = { count: 0, expires: now + windowMs };
    attempts.set(key, entry);
  }
  if (entry.count >= 5) return invalid;
  entry.count++;

  let user: z.infer<typeof staff>;
  try {
    const restaurant = await getRestaurant(slug);
    user = await request("/auth/verify", staff, {
      method: "POST",
      cache: "no-store",
      headers: { ...kitchenApiKeyHeaders(), "X-Restaurant-Id": restaurant.id, "Content-Type": "application/json" },
      body: JSON.stringify(input.data),
    });
    if (user.restaurantId !== restaurant.id) return invalid;
  } catch (error) {
    if (!(error instanceof BackendError && error.code === "INVALID_CREDENTIALS")) entry.count--;
    return invalid;
  }

  if (attempts.get(key) === entry) attempts.delete(key);
  await setStaffSession({
    sub: user.id, username: user.username, role: user.role, restaurantId: user.restaurantId, restaurantSlug: slug,
    credentialVersion: user.credentialVersion,
  });
  if (user.mustChangePassword) redirect("/r/" + slug + "/change-password");
  redirect(destination(form.get("next"), user.role, slug));
}

export async function logout() {
  const session = await getSession();
  (await cookies()).delete(sessionCookie);
  redirect("/r/" + (session?.restaurantSlug ?? "default") + "/login");
}
