"use server";

import { backendText, text } from "@/i18n/server-text";
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

async function message(error: unknown) {
  return error instanceof BackendError && error.status < 500 ? await backendText(error) : await text("menu.couldnTSaveTheMenuItemTry");
}

export async function submitMenuItem(id: string | undefined, state: MenuState, form: FormData): Promise<MenuState> {
  await requireRole(adminRoles, { next: "/menu" });
  const rawName = form.get("name");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const rawPrice = form.get("price");
  const priceMinor = typeof rawPrice === "string" ? parseMenuPrice(rawPrice) : null;
  const nameError = name.length < 1 || name.length > 80 ? await text("menu.enterANameOf1To80") : undefined;
  if (nameError || priceMinor === null) {
    return { itemId: state.itemId, name: nameError, price: priceMinor === null ? await text("menu.enterAThbPriceWithUpTo") : undefined };
  }
  const selected = form.get("image");
  const image = selected instanceof File && selected.size > 0 ? selected : undefined;
  if (image && image.size > menuImageMaxBytes) {
    return { itemId: state.itemId, image: await text("menu.chooseAnImageNoLargerThan2") };
  }
  let itemId = id ?? state.itemId;
  try {
    const item = await saveMenuItem({ name, priceMinor }, itemId);
    itemId = item.id;
  } catch (error) {
    return { itemId, error: await message(error) };
  }
  try {
    if (image || form.get("removeImage") === "yes") await saveMenuImage(itemId, image);
  } catch (error) {
    refreshMenu();
    return { itemId, image: await text("menu.itemDetailsSavedError", { error: error instanceof BackendError && error.status < 500
      ? await backendText(error) : await text("menu.theImageChangeFailedTryAgain") }) };
  }
  refreshMenu();
  return { saved: true };
}

export async function toggleMenuItem(id: string, available: boolean): Promise<MenuState> {
  await requireRole(adminRoles, { next: "/menu" });
  try {
    await saveMenuItem({ available }, id);
  } catch (error) {
    return { error: await message(error) };
  }
  refreshMenu();
  return {};
}
