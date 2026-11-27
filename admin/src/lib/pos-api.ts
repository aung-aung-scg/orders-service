import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { backendFetch, request } from "./api";
import { customerTable, submittedOrder, ticketStatus, tickets } from "./pos-schema";

const tableList = z.array(z.object({ id: z.string(), number: z.number().int(), active: z.boolean() }));
const updatedCart = z.object({ id: z.string() });

export function customerPath(token: string) {
  return "/t/" + encodeURIComponent(token);
}

function sessionCookie(token: string) {
  return "dining_" + createHash("sha256").update(token).digest("hex");
}

async function sessionHeaders(token: string, sessionId?: string) {
  const access = (await cookies()).get(sessionCookie(token))?.value;
  const headers = new Headers({ "Content-Type": "application/json" });
  if (access) headers.set("x-dining-session", access);
  if (sessionId) headers.set("x-dining-session-id", sessionId);
  return headers;
}

export async function joinDiningSession(token: string, code: string) {
  const { accessToken, sessionId } = await request(customerPath(token) + "/join", z.object({ accessToken: z.string(), sessionId: z.uuid() }), {
    method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  (await cookies()).set(sessionCookie(token), accessToken, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: customerPath(token),
  });
  return sessionId;
}

export async function getCustomerTable(token: string, orderId?: string) {
  const query = orderId ? "?" + new URLSearchParams({ orderId }) : "";
  return request(customerPath(token) + query, customerTable, { cache: "no-store", headers: await sessionHeaders(token) });
}

export async function addTableItem(token: string, sessionId: string, item: { menuItemId: string; quantity: number; note?: string }) {
  return request(customerPath(token) + "/order/items", updatedCart, {
    method: "POST",
    headers: await sessionHeaders(token, sessionId),
    body: JSON.stringify({ items: [item] }),
  });
}

export async function changeTableItem(token: string, sessionId: string, itemId: string, quantity: number) {
  return request(customerPath(token) + "/order/items/" + encodeURIComponent(itemId), updatedCart, {
    method: "PATCH",
    headers: await sessionHeaders(token, sessionId),
    body: JSON.stringify({ quantity }),
  });
}

export async function submitTableOrder(token: string, sessionId: string, key: string, cartId: string, version: number) {
  const headers = await sessionHeaders(token, sessionId);
  headers.set("Idempotency-Key", key);
  return request(customerPath(token) + "/order/submit", ticketStatus, {
    method: "POST",
    headers,
    body: JSON.stringify({ cartId, version }),
  });
}

export function kitchenHeaders() {
  const key = process.env.KITCHEN_API_KEY;
  if (!key) throw new Error("KITCHEN_API_KEY is required");
  return { "x-kitchen-api-key": key };
}

export function getTickets(signal?: AbortSignal) {
  return request("/kitchen/orders", tickets, { cache: "no-store", headers: kitchenHeaders(), signal });
}

export function setTicketStatus(id: string, status: string) {
  return request("/kitchen/orders/" + encodeURIComponent(id) + "/status", ticketStatus, {
    method: "PATCH",
    headers: { ...kitchenHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export function listTables() {
  return request("/tables", tableList, { cache: "no-store", headers: kitchenHeaders() });
}

export function getTableQr(id: string, signal: AbortSignal) {
  return backendFetch("/tables/" + encodeURIComponent(id) + "/qr", { cache: "no-store", headers: kitchenHeaders(), signal });
}

export function kitchenStream(signal: AbortSignal) {
  return backendFetch("/kitchen/stream", { cache: "no-store", headers: kitchenHeaders(), signal });
}

const diningSession = z.object({ id: z.uuid(), joinCode: z.string() });

export function listDiningSessions() {
  const list = z.array(z.object({
    id: z.uuid(), number: z.number().int(), session: diningSession.nullable(), activeTickets: z.number().int(),
  }));
  return request("/staff/table-sessions", list, { cache: "no-store", headers: kitchenHeaders() });
}

export function getTableOrderHistory(id: string) {
  return request("/staff/table-sessions/" + encodeURIComponent(id) + "/orders", z.object({
    number: z.number().int(), orders: z.array(submittedOrder),
  }), { cache: "no-store", headers: kitchenHeaders() });
}

export function resetDiningSession(id: string, input: {
  expectedSessionId: string | null; actor: { id: string; role: "ADMIN" | "KITCHEN" }; overrideReason?: string;
}) {
  return request("/staff/table-sessions/" + encodeURIComponent(id) + "/reset", diningSession, {
    method: "POST", cache: "no-store",
    headers: { ...kitchenHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}
