"use server";

import { revalidatePath } from "next/cache";
import { BackendError } from "@/lib/api";
import { adminRoles, requireRole } from "@/lib/auth";
import { saveMenuItem } from "@/lib/menu-api";
import { parseMenuPrice } from "@/lib/menu-price";

export type MenuState = { name?: string; price?: string; error?: string; saved?: boolean };

function refreshMenu() {
  revalidatePath("/menu");
  revalidatePath("/t/[token]", "page");
}

function message(error: unknown) {
  return error instanceof BackendError && error.status < 500 ? error.backendMessage : "Couldn’t save the menu item. Try again.";
}

export async function submitMenuItem(id: string | undefined, _state: MenuState, form: FormData): Promise<MenuState> {
  await requireRole(adminRoles, { next: "/menu" });
  const rawName = form.get("name");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const rawPrice = form.get("price");
  const priceMinor = typeof rawPrice === "string" ? parseMenuPrice(rawPrice) : null;
  const nameError = name.length < 1 || name.length > 80 ? "Enter a name of 1 to 80 characters." : undefined;
  if (nameError || priceMinor === null) {
    return { name: nameError, price: priceMinor === null ? "Enter a THB price with up to seven digits and two decimal places." : undefined };
  }
  try {
    await saveMenuItem({ name, priceMinor }, id);
  } catch (error) {
    return { error: message(error) };
  }
  refreshMenu();
  return { saved: true };
}

export async function toggleMenuItem(id: string, available: boolean): Promise<MenuState> {
  await requireRole(adminRoles, { next: "/menu" });
  try {
    await saveMenuItem({ available }, id);
  } catch (error) {
    return { error: message(error) };
  }
  refreshMenu();
  return {};
}
