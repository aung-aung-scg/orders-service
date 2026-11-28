"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { TemporaryCredential } from "@/lib/platform-api";
import { createRestaurantAction, resetRestaurantPasswordAction, setRestaurantActiveAction, type PlatformState } from "./actions";

type Target = { id: string; name: string; active: boolean };
export type RestaurantOperation = { kind: "create" } | { kind: "status" | "reset"; restaurant: Target };

function Credentials({ credentials, close }: { credentials: TemporaryCredential[]; close: () => void }) {
  const t = useTranslations();
  const [message, setMessage] = useState("");
  return <>
    <section aria-label={t("platform.temporaryCredentials")} className="divide-y overflow-hidden rounded-xl border bg-muted/30">
      {credentials.map(({ username, password }) => <div key={username} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
        <div className="grid min-w-0 gap-1">
          <strong>{username}</strong>
          <code className="select-all break-all text-muted-foreground">{password}</code>
        </div>
        <Button type="button" variant="outline" size="sm" aria-label={t("platform.copyP0Password", { p0: username })} onClick={async () => {
          try {
            await navigator.clipboard.writeText(password);
            setMessage(t("feedback.copiedPassword", { username }));
          } catch {
            setMessage(t("feedback.copyFailed"));
          }
        }}><Copy />{" "}{t("platform.copy")}</Button>
      </div>)}
    </section>
    <p role="status" className="text-sm text-muted-foreground empty:hidden">{message}</p>
    <DialogFooter><Button onClick={close}><Check />{" "}{t("platform.dismissCredentials")}</Button></DialogFooter>
  </>;
}

export function RestaurantDialog({ operation, close, restoreFocus, onSuccess }: {
  operation: RestaurantOperation;
  close: () => void;
  restoreFocus: () => void;
  onSuccess: (message: string) => void;
}) {
  const t = useTranslations();
  const [fields, setFields] = useState({ name: "", slug: "", timezone: "Asia/Bangkok" });
  const [username, setUsername] = useState("admin");
  const [state, action, pending] = useActionState(async (previous: PlatformState, form: FormData) => {
    if (operation.kind === "create") {
      const result = await createRestaurantAction(previous, form);
      if (result.credentials) onSuccess(t("platform.p0WasCreated", { p0: fields.name.trim() }));
      return result;
    }
    const { restaurant } = operation;
    if (operation.kind === "reset") {
      const result = await resetRestaurantPasswordAction(restaurant.id, previous, form);
      if (result.credentials) onSuccess(t("platform.passwordResetForP0AtP1", { p0: username, p1: restaurant.name }));
      return result;
    }
    const result = await setRestaurantActiveAction(restaurant.id, !restaurant.active);
    if (!result.error) {
      onSuccess(t("platform.p0WasP1", { p0: restaurant.name, p1: restaurant.active ? t("platform.suspended2") : t("platform.reactivated") }));
      close();
    }
    return result;
  }, {});

  const create = operation.kind === "create";
  const reset = operation.kind === "reset";
  const suspend = operation.kind === "status" && operation.restaurant.active;
  const title = create ? t("platform.createRestaurant") : reset ? t("platform.resetPassword") : suspend ? t("platform.suspendRestaurant") : t("platform.reactivateRestaurant");
  const explanation = create ? t("platform.createARestaurantAndItsTwoStaff")
    : reset ? t("platform.resetAStaffAccountForP0Existing", { p0: operation.restaurant.name })
      : suspend ? t("platform.publicBookingAndStaffAccessForP0", { p0: operation.restaurant.name })
        : t("platform.restorePublicBookingAndStaffAccessFor", { p0: operation.restaurant.name });

  function protectDialog(event: { preventDefault: () => void }) {
    if (pending || state.credentials) event.preventDefault();
  }

  return <Dialog open onOpenChange={open => {
    if (!open && !pending && !state.credentials) close();
  }}>
    <DialogContent showCloseButton={!pending && !state.credentials} onEscapeKeyDown={protectDialog}
      onInteractOutside={protectDialog} onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{state.credentials ? <span className="flex items-center gap-2"><KeyRound className="size-5 text-primary" />{" "}{t("platform.temporaryCredentials")}</span> : title}</DialogTitle>
        <DialogDescription>{state.credentials
          ? t("platform.copyThesePasswordsBeforeDismissingTheyAre")
          : explanation}</DialogDescription>
      </DialogHeader>
      {state.credentials ? <Credentials credentials={state.credentials} close={close} /> : <form action={action} noValidate className="grid gap-4">
        {create && <fieldset disabled={pending} className="grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">{t("platform.restaurantName")}
            <Input name="name" value={fields.name} onChange={event => setFields({ ...fields, name: event.target.value })} maxLength={120} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">{t("platform.slug")}
            <Input name="slug" value={fields.slug} onChange={event => setFields({ ...fields, slug: event.target.value })} minLength={3} maxLength={40} aria-describedby="slug-help" required />
            <span id="slug-help" className="font-normal text-muted-foreground">{t("platform.useLowercaseLettersNumbersAndHyphens")}</span>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">{t("platform.timezone")}
            <Input name="timezone" value={fields.timezone} onChange={event => setFields({ ...fields, timezone: event.target.value })} required />
          </label>
        </fieldset>}
        {reset && <label className="grid gap-1.5 text-sm font-medium">{t("platform.staffAccount")}
          <select name="username" value={username} onChange={event => setUsername(event.target.value)} disabled={pending}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
            <option value="admin">admin</option><option value="kitchen">kitchen</option>
          </select>
        </label>}
        {state.error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{state.error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={close}>{t("reservations.cancel")}</Button>
          <Button type="submit" variant={suspend ? "destructive" : "default"} disabled={pending}>{pending ? t("auth.saving") : title}</Button>
        </DialogFooter>
      </form>}
    </DialogContent>
  </Dialog>;
}
