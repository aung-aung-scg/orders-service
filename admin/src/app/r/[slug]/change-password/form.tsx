"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changeStaffPassword } from "./actions";

export function ChangePasswordForm({ slug }: { slug: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(changeStaffPassword.bind(null, slug), {});
  return <form action={action} noValidate className="grid gap-4">
    <label className="grid gap-1.5 text-sm">{t("auth.temporaryPassword")}
      <Input name="currentPassword" type="password" autoComplete="current-password" required />
    </label>
    <label className="grid gap-1.5 text-sm">{t("auth.newPasswordAtLeast10Characters")}
      <Input name="newPassword" type="password" autoComplete="new-password" minLength={10} required />
    </label>
    <label className="grid gap-1.5 text-sm">{t("auth.confirmNewPassword")}
      <Input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required />
    </label>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <Button disabled={pending}>{pending ? t("auth.saving") : t("auth.changePassword")}</Button>
  </form>;
}
