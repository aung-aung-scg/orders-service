"use server";

import { backendText, text } from "@/i18n/server-text";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BackendError } from "@/lib/api";
import { kitchenRoles, requireRole } from "@/lib/auth";
import { addTableItem, changeTableItem, customerPath, joinDiningSession, setTicketStatus, submitTableOrder } from "@/lib/pos-api";

export type PosState = { error?: string; cartChanged?: boolean };

const lineId = z.string().min(1).max(200);
const quantityField = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(20));
const addFields = z.object({
  menuItemId: lineId,
  quantity: quantityField.refine(value => value > 0),
  note: z.string().trim().max(500),
});

async function failure(error: unknown): Promise<PosState> {
  if (error instanceof BackendError && error.status < 500) return { error: await backendText(error) };
  console.error("Customer or kitchen order request failed");
  return { error: await text("errors.theRequestFailedTryAgain") };
}

export async function joinTable(token: string, _state: PosState, form: FormData): Promise<PosState> {
  const code = z.string().trim().toUpperCase().regex(/^[0-9A-F]{10}$/).safeParse(form.get("code"));
  if (!code.success) return { error: await text("errors.enterThe10CharacterCodeFromStaff") };
  let sessionId: string;
  try {
    sessionId = await joinDiningSession(token, code.data);
  } catch (error) {
    return failure(error);
  }
  redirect(customerPath(token) + "?" + new URLSearchParams({ session: sessionId }));
}

export async function addCartItem(token: string, sessionId: string, menuItemId: string, _state: PosState, form: FormData): Promise<PosState> {
  const fields = addFields.safeParse({ menuItemId, quantity: form.get("quantity"), note: form.get("note") });
  if (!fields.success) return { error: await text("errors.enterAQuantityFrom1To20") };
  try {
    const { note, ...item } = fields.data;
    await addTableItem(token, sessionId, { ...item, note: note || undefined });
  } catch (error) {
    return failure(error);
  }
  revalidatePath(customerPath(token));
  return {};
}

export async function updateCartItem(token: string, sessionId: string, itemId: string, _state: PosState, form: FormData): Promise<PosState> {
  const quantity = quantityField.safeParse(form.get("quantity"));
  if (!quantity.success) return { error: await text("errors.enterAQuantityFrom0To20") };
  try {
    await changeTableItem(token, sessionId, itemId, quantity.data);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(customerPath(token));
  return {};
}

export async function placeTableOrder(token: string, sessionId: string, cartId: string, version: number, _state: PosState, form: FormData): Promise<PosState> {
  const key = z.uuid().safeParse(form.get("key"));
  if (!key.success) return { error: await text("errors.reloadThePageAndTryAgain") };
  let orderId: string;
  try {
    orderId = (await submitTableOrder(token, sessionId, key.data, cartId, version)).id;
  } catch (error) {
    if (error instanceof BackendError && error.code === "CART_CHANGED") {
      return { error: await backendText(error), cartChanged: true };
    }
    return failure(error);
  }
  revalidatePath(customerPath(token));
  redirect(customerPath(token) + "?" + new URLSearchParams({ view: "orders", orderId, session: sessionId }));
}

export async function advanceTicket(id: string, status: string): Promise<PosState> {
  await requireRole(kitchenRoles, { next: "/kitchen" });
  const fields = z.object({ id: z.uuid(), status: z.enum(["PREPARING", "READY", "SERVED", "CANCELLED"]) }).safeParse({ id, status });
  if (!fields.success) return { error: await text("errors.invalidTicketOrStatus") };
  try {
    await setTicketStatus(fields.data.id, fields.data.status);
    return {};
  } catch (error) {
    return failure(error);
  }
}
