"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { platformLogin } from "./actions";

export function PlatformLoginForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(platformLogin, {});
  return <form action={action} noValidate className="grid gap-4">
    <label className="grid gap-1.5 text-sm">{t("auth.username")}<Input name="username" autoComplete="username" required /></label>
    <label className="grid gap-1.5 text-sm">{t("auth.password")}<Input name="password" type="password" autoComplete="current-password" required /></label>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <Button disabled={pending}>{pending ? t("auth.signingIn") : t("auth.signIn")}</Button>
  </form>;
}
