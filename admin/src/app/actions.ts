"use server";

import { backendText, text } from "@/i18n/server-text";
import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { adminRoles, requireRole } from "@/lib/auth";
import { BackendError, createOrder, createProduct, productsTag } from "@/lib/api";

export type FormState = { error?: string; success?: string };

const productFields = z.object({
  name: z.string().trim().min(1, "Enter a product name.").max(200, "Use at most 200 characters for the name."),
  stock: integerField(0, "Enter a whole stock quantity from 0 to 2,147,483,647."),
});
const orderFields = z.object({
  productId: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/, "Choose a product."),
  quantity: integerField(1, "Enter a whole order quantity from 1 to 2,147,483,647."),
});

function integerField(minimum: number, message: string) {
  return z.string().trim().regex(/^\d+$/, message).pipe(
    z.coerce.number<string>().int(message).min(minimum, message).max(2147483647, message),
  );
}

async function formError(error: unknown): Promise<FormState> {
  if (error instanceof BackendError && error.status < 500) {
    if (error.status === 409 && error.code === "INSUFFICIENT_STOCK") {
      return { error: await text("feedback.insufficientStock") };
    }
    return { error: await backendText(error) };
  }
  console.error(error);
  return { error: await text("errors.theBackendCouldNotCompleteTheRequest") };
}

export async function addProduct(_previous: FormState, form: FormData): Promise<FormState> {
  await requireRole(adminRoles, { next: "/products" });
  const input = productFields.safeParse({ name: form.get("name") ?? "", stock: form.get("stock") ?? "" });
  if (!input.success) return { error: await text("errors.checkTheHighlightedFieldsAndTryAgain") };

  try {
    await createProduct(input.data);
  } catch (error) {
    return formError(error);
  }
  updateTag(productsTag);
  revalidatePath("/products");
  return { success: await text("feedback.productCreated") };
}

export async function addOrder(_previous: FormState, form: FormData): Promise<FormState> {
  await requireRole(adminRoles, { next: "/orders" });
  const input = orderFields.safeParse({ productId: form.get("productId") ?? "", quantity: form.get("quantity") ?? "" });
  if (!input.success) return { error: await text("errors.checkTheHighlightedFieldsAndTryAgain") };

  try {
    await createOrder({ items: [input.data] }, randomUUID());
  } catch (error) {
    return formError(error);
  }
  updateTag(productsTag);
  revalidatePath("/orders");
  return { success: await text("feedback.orderCreated") };
}
