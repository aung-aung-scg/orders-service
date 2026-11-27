"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changeStaffPassword } from "./actions";

export function ChangePasswordForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(changeStaffPassword.bind(null, slug), {});
  return <form action={action} className="grid gap-4">
    <label className="grid gap-1.5 text-sm">Temporary password
      <Input name="currentPassword" type="password" autoComplete="current-password" required />
    </label>
    <label className="grid gap-1.5 text-sm">New password (at least 10 characters)
      <Input name="newPassword" type="password" autoComplete="new-password" minLength={10} required />
    </label>
    <label className="grid gap-1.5 text-sm">Confirm new password
      <Input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required />
    </label>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <Button disabled={pending}>{pending ? "Saving…" : "Change password"}</Button>
  </form>;
}
