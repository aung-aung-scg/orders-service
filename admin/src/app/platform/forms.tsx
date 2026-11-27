"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { platformLogin } from "./actions";

export function PlatformLoginForm() {
  const [state, action, pending] = useActionState(platformLogin, {});
  return <form action={action} className="grid gap-4">
    <label className="grid gap-1.5 text-sm">Username<Input name="username" autoComplete="username" required /></label>
    <label className="grid gap-1.5 text-sm">Password<Input name="password" type="password" autoComplete="current-password" required /></label>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <Button disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
  </form>;
}
