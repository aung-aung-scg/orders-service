"use server";

import { backendText, text } from "@/i18n/server-text";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BackendError, request } from "@/lib/api";
import { createRestaurant, resetRestaurantPassword, setRestaurantActive, type TemporaryCredential } from "@/lib/platform-api";
import { platformCookie, platformKeyHeaders, requirePlatform, setPlatformSession } from "@/lib/platform-auth";

export type PlatformState = { error?: string; credentials?: TemporaryCredential[] };

const loginInput = z.object({ username: z.string().trim().toLowerCase().min(1).max(100), password: z.string().min(1).max(1024) });
const loginResult = z.object({ id: z.string(), role: z.literal("SUPER_ADMIN"), credentialVersion: z.number().int().nonnegative() });
const attempts = new Map<string, { count: number; expires: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, attempt] of attempts) if (attempt.expires <= now) attempts.delete(ip);
}, 60_000).unref();

export async function platformLogin(_state: PlatformState, form: FormData): Promise<PlatformState> {
  const input = loginInput.safeParse({ username: form.get("username"), password: form.get("password") });
  if (!input.success) return { error: await text("auth.unableToSignInCheckYourCredentials") };
  const ip = (await headers()).get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
  const now = Date.now();
  let attempt = attempts.get(ip);
  if (!attempt || attempt.expires <= now) {
    attempt = { count: 0, expires: now + 15 * 60_000 };
    attempts.set(ip, attempt);
  }
  if (attempt.count >= 5) return { error: await text("auth.unableToSignInCheckYourCredentials") };
  attempt.count++;

  const session = await request("/platform/auth/verify", loginResult, {
    method: "POST", cache: "no-store", headers: { ...platformKeyHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input.data),
  }).catch(() => null);
  if (!session) return { error: await text("auth.unableToSignInCheckYourCredentials") };
  attempts.delete(ip);
  await setPlatformSession({ sub: session.id, role: session.role, credentialVersion: session.credentialVersion });
  redirect("/platform");
}

export async function platformLogout() {
  await requirePlatform();
  (await cookies()).set(platformCookie, "", {
    path: "/platform", maxAge: 0, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
  });
  redirect("/platform/login");
}

async function failure(error: unknown): Promise<PlatformState> {
  if (error instanceof BackendError) {
    if (error.status === 401 || error.status === 403) redirect("/platform/login");
    if (error.status === 409) return { error: await text("errors.thatRestaurantSlugIsAlreadyInUse") };
    if (error.status === 400) return { error: await text("errors.checkTheRestaurantNameSlugAndTimezone") };
    if (error.status === 404) return { error: await backendText(error) };
  }
  return { error: await text("errors.theChangeCouldNotBeSavedTry") };
}

export async function createRestaurantAction(_state: PlatformState, form: FormData): Promise<PlatformState> {
  const session = await requirePlatform();
  const input = z.object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().min(3).max(40).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    timezone: z.string().trim().min(1).max(80),
  }).safeParse({ name: form.get("name"), slug: form.get("slug"), timezone: form.get("timezone") });
  if (!input.success) return { error: await text("errors.enterANameAValidSlugAnd") };
  try {
    const result = await createRestaurant(session, input.data);
    revalidatePath("/platform");
    return { credentials: result.credentials };
  } catch (error) {
    return failure(error);
  }
}

export async function setRestaurantActiveAction(id: string, active: boolean): Promise<PlatformState> {
  const session = await requirePlatform();
  try {
    await setRestaurantActive(session, id, active);
    revalidatePath("/platform");
    return {};
  } catch (error) {
    return failure(error);
  }
}

export async function resetRestaurantPasswordAction(id: string, _state: PlatformState, form: FormData): Promise<PlatformState> {
  const session = await requirePlatform();
  const username = z.enum(["admin", "kitchen"]).safeParse(form.get("username"));
  if (!username.success) return { error: await text("errors.selectAStaffAccount") };
  try {
    return { credentials: [await resetRestaurantPassword(session, id, username.data)] };
  } catch (error) {
    return failure(error);
  }
}
