"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TemporaryCredential } from "@/lib/platform-api";
import { createRestaurantAction, platformLogin, resetRestaurantPasswordAction, setRestaurantActiveAction } from "./actions";

export function PlatformLoginForm() {
  const [state, action, pending] = useActionState(platformLogin, {});
  return <form action={action} className="grid gap-4">
    <label className="grid gap-1.5 text-sm">Username<Input name="username" autoComplete="username" required /></label>
    <label className="grid gap-1.5 text-sm">Password<Input name="password" type="password" autoComplete="current-password" required /></label>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <Button disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
  </form>;
}

function Credentials({ credentials, dismiss }: { credentials: TemporaryCredential[]; dismiss: () => void }) {
  const [message, setMessage] = useState("");
  return <section aria-label="Temporary credentials" className="grid gap-3 rounded-xl border p-4">
    <p className="text-sm font-medium">Save these temporary passwords now. They are shown once and must be changed at sign-in.</p>
    {credentials.map(({ username, password }) => <div key={username} className="flex flex-wrap items-center gap-2 text-sm">
      <strong>{username}</strong>
      <code className="rounded bg-muted px-2 py-1">{password}</code>
      <Button type="button" variant="outline" size="sm" onClick={async () => {
        try {
          await navigator.clipboard.writeText(password);
          setMessage(`Copied the ${username} password.`);
        } catch {
          setMessage("Copy failed. Select the password to copy it.");
        }
      }}>Copy {username} password</Button>
    </div>)}
    <p aria-live="polite" className="text-sm">{message}</p>
    <Button type="button" variant="outline" className="w-fit" onClick={dismiss}>Dismiss credentials</Button>
  </section>;
}

function CreateForm({ dismiss }: { dismiss: () => void }) {
  const [state, action, pending] = useActionState(createRestaurantAction, {});
  if (state.credentials) return <Credentials credentials={state.credentials} dismiss={dismiss} />;
  return <form action={action} className="grid gap-3 sm:grid-cols-3">
    <label className="grid gap-1.5 text-sm">Restaurant name<Input name="name" maxLength={120} required /></label>
    <label className="grid gap-1.5 text-sm">Slug<Input name="slug" minLength={3} maxLength={40} required /></label>
    <label className="grid gap-1.5 text-sm">Timezone<Input name="timezone" defaultValue="Asia/Bangkok" required /></label>
    {state.error && <p role="alert" className="text-sm text-destructive sm:col-span-3">{state.error}</p>}
    <Button disabled={pending} className="w-fit sm:col-span-3">{pending ? "Creating…" : "Create restaurant"}</Button>
  </form>;
}

export function CreateRestaurantForm() {
  const [instance, setInstance] = useState(0);
  return <CreateForm key={instance} dismiss={() => setInstance(instance + 1)} />;
}

function ResetForm({ id, name, dismiss }: { id: string; name: string; dismiss: () => void }) {
  const [state, action, pending] = useActionState(resetRestaurantPasswordAction.bind(null, id), {});
  if (state.credentials) return <Credentials credentials={state.credentials} dismiss={dismiss} />;
  return <form action={action} className="grid gap-2" onSubmit={event => {
    if (!window.confirm(`Reset this staff password for ${name}? Existing sessions for the account will end.`)) event.preventDefault();
  }}>
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label={`Staff account for ${name}`} name="username" className="h-8 rounded-md border bg-background px-2 text-sm">
        <option value="admin">admin</option><option value="kitchen">kitchen</option>
      </select>
      <Button size="sm" variant="outline" disabled={pending}>{pending ? "Resetting…" : "Reset password"}</Button>
    </div>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
  </form>;
}

export function RestaurantControls({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [instance, setInstance] = useState(0);
  const [state, action, pending] = useActionState(setRestaurantActiveAction.bind(null, id, !active), {});
  const label = active ? "Suspend" : "Reactivate";
  return <div className="grid gap-2">
    <form action={action} onSubmit={event => {
      if (!window.confirm(`${label} ${name}?`)) event.preventDefault();
    }}>
      <Button size="sm" variant={active ? "destructive" : "outline"} disabled={pending}>{pending ? "Saving…" : label}</Button>
      {state.error && <p role="alert" className="mt-1 text-sm text-destructive">{state.error}</p>}
    </form>
    <ResetForm key={instance} id={id} name={name} dismiss={() => setInstance(instance + 1)} />
  </div>;
}
