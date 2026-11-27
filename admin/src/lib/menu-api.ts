import "server-only";
import { z } from "zod";
import { request } from "./api";
import { kitchenHeaders } from "./pos-api";

const item = z.object({ id: z.string(), name: z.string(), priceMinor: z.number().int(), available: z.boolean(), imageKey: z.string().nullish() });
export type MenuItem = z.infer<typeof item>;

export async function listMenu() {
  return request("/staff/menu", z.array(item), { cache: "no-store", headers: await kitchenHeaders() });
}

export async function saveMenuItem(input: Partial<Omit<MenuItem, "id" | "imageKey">>, id?: string) {
  return request(id ? "/staff/menu/" + encodeURIComponent(id) : "/staff/menu", item, {
    method: id ? "PATCH" : "POST",
    cache: "no-store",
    headers: { ...await kitchenHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function saveMenuImage(id: string, file?: File) {
  const body = file ? new FormData() : undefined;
  if (file) body?.set("image", file);
  return request("/staff/menu/" + encodeURIComponent(id) + "/image", item, {
    method: file ? "POST" : "DELETE",
    cache: "no-store",
    headers: await kitchenHeaders(),
    body,
  });
}
