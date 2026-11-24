"use server";

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

function formError(error: unknown): FormState {
  if (error instanceof BackendError && error.status < 500) {
    if (error.status === 409 && error.code === "INSUFFICIENT_STOCK") {
      return { error: "Insufficient stock for this product. Choose a smaller quantity or another product." };
    }
    return { error: error.backendMessage };
  }
  console.error(error);
  return { error: "The backend could not complete the request." };
}

export async function addProduct(_previous: FormState, form: FormData): Promise<FormState> {
  await requireRole(adminRoles, { next: "/products" });
  const input = productFields.safeParse({ name: form.get("name") ?? "", stock: form.get("stock") ?? "" });
  if (!input.success) return { error: input.error.issues.map(issue => issue.message).join(" ") };

  try {
    await createProduct(input.data);
  } catch (error) {
    return formError(error);
  }
  updateTag(productsTag);
  revalidatePath("/products");
  return { success: "Product created." };
}

export async function addOrder(_previous: FormState, form: FormData): Promise<FormState> {
  await requireRole(adminRoles, { next: "/orders" });
  const input = orderFields.safeParse({ productId: form.get("productId") ?? "", quantity: form.get("quantity") ?? "" });
  if (!input.success) return { error: input.error.issues.map(issue => issue.message).join(" ") };

  try {
    await createOrder({ items: [input.data] }, randomUUID());
  } catch (error) {
    return formError(error);
  }
  updateTag(productsTag);
  revalidatePath("/orders");
  return { success: "Order created." };
}
