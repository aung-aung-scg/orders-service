"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BackendError } from "@/lib/api";
import { kitchenRoles, requireRole } from "@/lib/auth";
import { addTableItem, changeTableItem, customerPath, setTicketStatus, submitTableOrder } from "@/lib/pos-api";

export type PosState = { error?: string };

const lineId = z.string().min(1).max(200);
const quantityField = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(20));
const addFields = z.object({
  menuItemId: lineId,
  quantity: quantityField.refine(value => value > 0),
  note: z.string().trim().max(500),
});

function failure(error: unknown): PosState {
  if (error instanceof BackendError && error.status < 500) return { error: error.backendMessage };
  console.error(error);
  return { error: "The request failed. Try again." };
}

export async function addCartItem(token: string, menuItemId: string, _state: PosState, form: FormData): Promise<PosState> {
  const fields = addFields.safeParse({ menuItemId, quantity: form.get("quantity"), note: form.get("note") });
  if (!fields.success) return { error: "Enter a quantity from 1 to 20 and use at most 500 characters for the note." };
  try {
    const { note, ...item } = fields.data;
    await addTableItem(token, { ...item, note: note || undefined });
  } catch (error) {
    return failure(error);
  }
  revalidatePath(customerPath(token));
  return {};
}

export async function updateCartItem(token: string, itemId: string, _state: PosState, form: FormData): Promise<PosState> {
  const quantity = quantityField.safeParse(form.get("quantity"));
  if (!quantity.success) return { error: "Enter a quantity from 0 to 20." };
  try {
    await changeTableItem(token, itemId, quantity.data);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(customerPath(token));
  return {};
}

export async function placeTableOrder(token: string, _state: PosState, form: FormData): Promise<PosState> {
  const key = z.uuid().safeParse(form.get("key"));
  if (!key.success) return { error: "Reload the page and try again." };
  let orderId: string;
  try {
    orderId = (await submitTableOrder(token, key.data)).id;
  } catch (error) {
    return failure(error);
  }
  revalidatePath(customerPath(token));
  redirect(customerPath(token) + "?" + new URLSearchParams({ orderId }));
}

export async function advanceTicket(id: string, status: string): Promise<PosState> {
  await requireRole(kitchenRoles, { next: "/kitchen" });
  const fields = z.object({ id: z.uuid(), status: z.enum(["PREPARING", "READY", "SERVED", "CANCELLED"]) }).safeParse({ id, status });
  if (!fields.success) return { error: "Invalid ticket or status." };
  try {
    await setTicketStatus(fields.data.id, fields.data.status);
    return {};
  } catch (error) {
    return failure(error);
  }
}
