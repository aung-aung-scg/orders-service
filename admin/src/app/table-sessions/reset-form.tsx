"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { resetTable } from "./actions";

export function ResetForm({ id, current, override }: { id: string; current: string | null; override: boolean }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(resetTable.bind(null, id, current, override), {});
  const label = override ? t("tables.overrideAndReset") : current ? t("tables.resetTable") : t("tables.startSeating");
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant={override ? "destructive" : "outline"}>{label}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{t("tables.aNewJoinCodeIsIssuedAny")}</DialogDescription>
        </DialogHeader>
        <form action={action} noValidate className="grid gap-3">
          {override && <label className="grid gap-1 text-sm">{t("tables.overrideReason")}{" "}<Input name="reason" required maxLength={500} /></label>}
          {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
          <Button disabled={pending}>{pending ? t("auth.saving") : label}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
