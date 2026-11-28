"use server";

import { backendText, text } from "@/i18n/server-text";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BackendError, request } from "@/lib/api";
import { getSession, setStaffSession, staffCredentialHeaders } from "@/lib/auth";

export type PasswordState = { error?: string };
const fields = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(10).max(1024),
  confirmPassword: z.string().max(1024),
});

export async function changeStaffPassword(slug: string, _state: PasswordState, form: FormData): Promise<PasswordState> {
  const session = await getSession();
  if (!session) redirect("/r/" + encodeURIComponent(slug) + "/login");
  if (session.restaurantSlug !== slug) redirect("/r/" + session.restaurantSlug + "/change-password");
  const home = session.role === "ADMIN" ? "/menu" : "/kitchen";
  if (!session.mustChangePassword) redirect(home);
  const input = fields.safeParse({
    currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword"), confirmPassword: form.get("confirmPassword"),
  });
  if (!input.success) return { error: await text("auth.enterYourTemporaryPasswordAndANew") };
  const { currentPassword, newPassword, confirmPassword } = input.data;
  if (newPassword !== confirmPassword) return { error: await text("auth.theNewPasswordsDoNotMatch") };
  if (currentPassword === newPassword) return { error: await text("auth.chooseAPasswordDifferentFromTheTemporary") };
  let result;
  try {
    result = await request("/auth/change-password", z.object({ credentialVersion: z.number().int().nonnegative() }), {
      method: "POST", cache: "no-store", headers: { ...staffCredentialHeaders(session), "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  } catch (error) {
    if (error instanceof BackendError && error.status === 401) redirect("/r/" + slug + "/login");
    return { error: error instanceof BackendError && error.status === 400 ? await backendText(error) : await text("auth.couldNotChangeYourPasswordTryAgain") };
  }
  await setStaffSession({ ...session, credentialVersion: result.credentialVersion });
  redirect(home);
}
