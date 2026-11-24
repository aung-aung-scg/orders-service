import "server-only";
import { z } from "zod";
import { backendFetch, request } from "./api";
import { customerTable, ticketStatus, tickets } from "./pos-schema";

const tableList = z.array(z.object({ id: z.string(), number: z.number().int(), active: z.boolean() }));
const updatedCart = z.object({ id: z.string() });

export function customerPath(token: string) {
  return "/t/" + encodeURIComponent(token);
}

export function getCustomerTable(token: string, orderId?: string) {
  const query = orderId ? "?" + new URLSearchParams({ orderId }) : "";
  return request(customerPath(token) + query, customerTable, { cache: "no-store" });
}

export function addTableItem(token: string, item: { menuItemId: string; quantity: number; note?: string }) {
  return request(customerPath(token) + "/order/items", updatedCart, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [item] }),
  });
}

export function changeTableItem(token: string, itemId: string, quantity: number) {
  return request(customerPath(token) + "/order/items/" + encodeURIComponent(itemId), updatedCart, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity }),
  });
}

export function submitTableOrder(token: string, key: string) {
  return request(customerPath(token) + "/order/submit", ticketStatus, {
    method: "POST",
    headers: { "Idempotency-Key": key },
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
