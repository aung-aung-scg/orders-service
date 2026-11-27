import "server-only";
import { z } from "zod";
import { request } from "./api";
import { kitchenHeaders } from "./pos-api";

const item = z.object({ id: z.string(), name: z.string(), priceMinor: z.number().int(), available: z.boolean() });
export type MenuItem = z.infer<typeof item>;

export function listMenu() {
  return request("/staff/menu", z.array(item), { cache: "no-store", headers: kitchenHeaders() });
}

export function saveMenuItem(input: Partial<Omit<MenuItem, "id">>, id?: string) {
  return request(id ? "/staff/menu/" + encodeURIComponent(id) : "/staff/menu", item, {
    method: id ? "PATCH" : "POST",
    cache: "no-store",
    headers: { ...kitchenHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
