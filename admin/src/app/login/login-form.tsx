"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="space-y-4 text-sm">
      <input type="hidden" name="next" value={next} />
      <label className="grid gap-2 font-medium">Username <Input name="username" autoComplete="username" maxLength={100} required /></label>
      <label className="grid gap-2 font-medium">Password <Input name="password" type="password" autoComplete="current-password" maxLength={1024} required /></label>
      {state.error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive" role="alert">{state.error}</p>}
      <Button className="h-11 w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}
