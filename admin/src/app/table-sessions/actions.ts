"use server";

import { backendText, text } from "@/i18n/server-text";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BackendError } from "@/lib/api";
import { kitchenRoles, requireRole } from "@/lib/auth";
import { resetDiningSession } from "@/lib/pos-api";

export async function resetTable(id: string, expectedSessionId: string | null, override: boolean,
  _state: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const actor = await requireRole(kitchenRoles, { next: "/table-sessions" });
  let overrideReason: string | undefined;
  if (override) {
    if (actor.role !== "ADMIN") return { error: await text("errors.onlyAdminsCanOverrideActiveTickets") };
    const reason = z.string().trim().min(1).max(500).safeParse(form.get("reason"));
    if (!reason.success) return { error: await text("errors.enterAnOverrideReason") };
    overrideReason = reason.data;
  }
  try {
    await resetDiningSession(id, { expectedSessionId, actor: { id: actor.sub, role: actor.role }, overrideReason });
  } catch (error) {
    return { error: error instanceof BackendError && error.status < 500 ? await backendText(error) : await text("errors.couldnTResetTheTable") };
  }
  revalidatePath("/table-sessions");
  return {};
}
