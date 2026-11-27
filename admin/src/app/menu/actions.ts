"use server";

import { revalidatePath } from "next/cache";
import { BackendError } from "@/lib/api";
import { adminRoles, requireRole } from "@/lib/auth";
import { saveMenuImage, saveMenuItem } from "@/lib/menu-api";
import { menuImageMaxBytes } from "@/lib/menu-image";
import { parseMenuPrice } from "@/lib/menu-price";

export type MenuState = { name?: string; price?: string; image?: string; error?: string; saved?: boolean; itemId?: string };

function refreshMenu() {
  revalidatePath("/menu");
  revalidatePath("/t/[token]", "page");
}

function message(error: unknown) {
  return error instanceof BackendError && error.status < 500 ? error.backendMessage : "Couldn’t save the menu item. Try again.";
}

export async function submitMenuItem(id: string | undefined, state: MenuState, form: FormData): Promise<MenuState> {
  await requireRole(adminRoles, { next: "/menu" });
  const rawName = form.get("name");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const rawPrice = form.get("price");
  const priceMinor = typeof rawPrice === "string" ? parseMenuPrice(rawPrice) : null;
  const nameError = name.length < 1 || name.length > 80 ? "Enter a name of 1 to 80 characters." : undefined;
  if (nameError || priceMinor === null) {
    return { itemId: state.itemId, name: nameError, price: priceMinor === null ? "Enter a THB price with up to seven digits and two decimal places." : undefined };
  }
  const selected = form.get("image");
  const image = selected instanceof File && selected.size > 0 ? selected : undefined;
  if (image && image.size > menuImageMaxBytes) {
    return { itemId: state.itemId, image: "Choose an image no larger than 2 MB." };
  }
  let itemId = id ?? state.itemId;
  try {
    const item = await saveMenuItem({ name, priceMinor }, itemId);
    itemId = item.id;
  } catch (error) {
    return { itemId, error: message(error) };
  }
  try {
    if (image || form.get("removeImage") === "yes") await saveMenuImage(itemId, image);
  } catch (error) {
    refreshMenu();
    return { itemId, image: "Item details saved. " + (error instanceof BackendError && error.status < 500
      ? error.backendMessage : "The image change failed. Try again.") };
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
