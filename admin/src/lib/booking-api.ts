import "server-only";
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { request } from "./api";
import { kitchenHeaders } from "./pos-api";

const status = z.enum(["CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"]);
const times = z.object({ startsAt: z.iso.datetime(), endsAt: z.iso.datetime() });
const details = times.extend({
  status, partySize: z.number().int(), table: z.object({ number: z.number().int() }),
  guestName: z.string(), phone: z.string(), email: z.string().nullable(), notes: z.string().nullable(),
});
const booking = details.extend({ code: z.string() });
const bookingView = details.omit({ guestName: true, phone: true, email: true, notes: true }).extend({
  code: z.string(), revision: z.iso.datetime(), cancellationDeadline: z.iso.datetime(), canCancel: z.boolean(),
  reschedulingDeadline: z.iso.datetime(), canReschedule: z.boolean(),
});
const access = z.object({ grant: z.string(), maxAge: z.number().int().nonnegative() });
const slots = z.array(times.extend({ available: z.boolean() }));
const staffList = z.array(details.extend({ id: z.uuid() }));

async function publicHeaders() {
  const ip = (await headers()).get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const key = process.env.KITCHEN_API_KEY;
  return ip && key ? { "x-booking-client-ip": ip, "x-kitchen-api-key": key } : new Headers();
}

const cookiePrefix = "reservation_";
const grantName = (code: string) => cookiePrefix + createHash("sha256").update(code).digest("hex");

async function rememberBooking(code: string, grant: z.infer<typeof access>) {
  (await cookies()).set(grantName(code), grant.grant, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: grant.maxAge,
  });
}

async function bookingHeaders(code?: string) {
  const response = new Headers(await publicHeaders());
  response.set("Content-Type", "application/json");
  if (code) {
    const grant = (await cookies()).get(grantName(code))?.value;
    if (grant) response.set("X-Reservation-Access", grant);
  }
  return response;
}

export async function getAvailability(date: string, partySize: number) {
  const query = new URLSearchParams({ date, partySize: String(partySize), summary: "1" });
  return request("/availability?" + query, z.object({
    slots, state: z.enum(["AVAILABLE", "CLOSED", "FULLY_BOOKED", "NO_REMAINING_SLOTS"]),
  }), { cache: "no-store", headers: await publicHeaders() });
}

export async function createBooking(input: {
  startsAt: string; partySize: number; guestName: string; phone: string; email?: string; notes?: string;
}, key: string) {
  const requestHeaders = new Headers(await publicHeaders());
  requestHeaders.set("Content-Type", "application/json");
  requestHeaders.set("Idempotency-Key", key);
  const result = await request("/reservations", booking.extend(access.shape), {
    method: "POST", cache: "no-store", headers: requestHeaders, body: JSON.stringify(input),
  });
  await rememberBooking(result.code, result);
  return result;
}

export function bookingPath(code: string) {
  return "/booking/" + encodeURIComponent(code);
}

export async function getBooking(code: string) {
  return request("/reservations/" + encodeURIComponent(code), bookingView, { cache: "no-store", headers: await bookingHeaders(code) });
}

export async function cancelBooking(code: string) {
  return request("/reservations/" + encodeURIComponent(code) + "/cancel", z.object({ status }), {
    method: "POST", cache: "no-store", headers: await bookingHeaders(code),
    body: "{}",
  });
}

export async function verifyBooking(code: string, phone: string) {
  const grant = await request("/reservations/" + encodeURIComponent(code) + "/verify", access, {
    method: "POST", cache: "no-store", headers: await bookingHeaders(), body: JSON.stringify({ phone }),
  });
  await rememberBooking(code, grant);
}

export async function findBookings(phone: string) {
  const grants = (await cookies()).getAll().filter(cookie => cookie.name.startsWith(cookiePrefix))
    .map(cookie => cookie.value).filter(value => value.length <= 150).slice(-64);
  return request("/reservations/lookup", z.array(bookingView), {
    method: "POST", cache: "no-store", headers: await bookingHeaders(), body: JSON.stringify({ phone, grants }),
  });
}

export async function rescheduleAvailability(code: string, date: string) {
  return request("/reservations/" + encodeURIComponent(code) + "/availability?" + new URLSearchParams({ date }), z.array(times), {
    cache: "no-store", headers: await bookingHeaders(code),
  });
}

export async function rescheduleBooking(code: string, revision: string, startsAt: string) {
  return request("/reservations/" + encodeURIComponent(code) + "/reschedule", bookingView, {
    method: "PATCH", cache: "no-store", headers: await bookingHeaders(code), body: JSON.stringify({ revision, startsAt }),
  });
}

export function getStaffBookings(date: string) {
  return request("/staff/reservations?" + new URLSearchParams({ date }), staffList, {
    cache: "no-store", headers: kitchenHeaders(),
  });
}

export function updateBookingStatus(id: string, next: z.infer<typeof status>) {
  return request("/staff/reservations/" + encodeURIComponent(id) + "/status", z.object({ id: z.uuid(), status }), {
    method: "PATCH", cache: "no-store",
    headers: { ...kitchenHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ status: next }),
  });
}
