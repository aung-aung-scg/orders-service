"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <label>Username <input name="username" autoComplete="username" maxLength={100} required /></label>
      <label>Password <input name="password" type="password" autoComplete="current-password" maxLength={1024} required /></label>
      <button disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      {state.error && <p className="error" role="alert">{state.error}</p>}
    </form>
  );
}
