"use client";

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
  const [message, setMessage] = useState("");
  return <>
    <section aria-label="Temporary credentials" className="divide-y overflow-hidden rounded-xl border bg-muted/30">
      {credentials.map(({ username, password }) => <div key={username} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
        <div className="grid min-w-0 gap-1">
          <strong>{username}</strong>
          <code className="select-all break-all text-muted-foreground">{password}</code>
        </div>
        <Button type="button" variant="outline" size="sm" aria-label={`Copy ${username} password`} onClick={async () => {
          try {
            await navigator.clipboard.writeText(password);
            setMessage(`Copied the ${username} password.`);
          } catch {
            setMessage("Copy failed. Select the password to copy it.");
          }
        }}><Copy /> Copy</Button>
      </div>)}
    </section>
    <p role="status" className="text-sm text-muted-foreground empty:hidden">{message}</p>
    <DialogFooter><Button onClick={close}><Check /> Dismiss credentials</Button></DialogFooter>
  </>;
}

export function RestaurantDialog({ operation, close, restoreFocus, onSuccess }: {
  operation: RestaurantOperation;
  close: () => void;
  restoreFocus: () => void;
  onSuccess: (message: string) => void;
}) {
  const [fields, setFields] = useState({ name: "", slug: "", timezone: "Asia/Bangkok" });
  const [username, setUsername] = useState("admin");
  const [state, action, pending] = useActionState(async (previous: PlatformState, form: FormData) => {
    if (operation.kind === "create") {
      const result = await createRestaurantAction(previous, form);
      if (result.credentials) onSuccess(`${fields.name.trim()} was created.`);
      return result;
    }
    const { restaurant } = operation;
    if (operation.kind === "reset") {
      const result = await resetRestaurantPasswordAction(restaurant.id, previous, form);
      if (result.credentials) onSuccess(`Password reset for ${username} at ${restaurant.name}.`);
      return result;
    }
    const result = await setRestaurantActiveAction(restaurant.id, !restaurant.active);
    if (!result.error) {
      onSuccess(`${restaurant.name} was ${restaurant.active ? "suspended" : "reactivated"}.`);
      close();
    }
    return result;
  }, {});

  const create = operation.kind === "create";
  const reset = operation.kind === "reset";
  const suspend = operation.kind === "status" && operation.restaurant.active;
  const title = create ? "Create restaurant" : reset ? "Reset password" : suspend ? "Suspend restaurant" : "Reactivate restaurant";
  const explanation = create ? "Create a restaurant and its two staff accounts."
    : reset ? `Reset a staff account for ${operation.restaurant.name}. Existing sessions for that account will end.`
      : suspend ? `Public booking and staff access for ${operation.restaurant.name} will be paused until reactivated.`
        : `Restore public booking and staff access for ${operation.restaurant.name}.`;

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
        <DialogTitle>{state.credentials ? <span className="flex items-center gap-2"><KeyRound className="size-5 text-primary" /> Temporary credentials</span> : title}</DialogTitle>
        <DialogDescription>{state.credentials
          ? "Copy these passwords before dismissing. They are shown once and must be changed at sign-in."
          : explanation}</DialogDescription>
      </DialogHeader>
      {state.credentials ? <Credentials credentials={state.credentials} close={close} /> : <form action={action} className="grid gap-4">
        {create && <fieldset disabled={pending} className="grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">Restaurant name
            <Input name="name" value={fields.name} onChange={event => setFields({ ...fields, name: event.target.value })} maxLength={120} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">Slug
            <Input name="slug" value={fields.slug} onChange={event => setFields({ ...fields, slug: event.target.value })} minLength={3} maxLength={40} aria-describedby="slug-help" required />
            <span id="slug-help" className="font-normal text-muted-foreground">Use lowercase letters, numbers, and hyphens.</span>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">Timezone
            <Input name="timezone" value={fields.timezone} onChange={event => setFields({ ...fields, timezone: event.target.value })} required />
          </label>
        </fieldset>}
        {reset && <label className="grid gap-1.5 text-sm font-medium">Staff account
          <select name="username" value={username} onChange={event => setUsername(event.target.value)} disabled={pending}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
            <option value="admin">admin</option><option value="kitchen">kitchen</option>
          </select>
        </label>}
        {state.error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{state.error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={close}>Cancel</Button>
          <Button type="submit" variant={suspend ? "destructive" : "default"} disabled={pending}>{pending ? "Saving…" : title}</Button>
        </DialogFooter>
      </form>}
    </DialogContent>
  </Dialog>;
}
