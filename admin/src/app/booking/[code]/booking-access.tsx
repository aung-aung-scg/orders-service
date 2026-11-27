"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyGuestBooking } from "../../booking-actions";

export function VerifyBookingForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(verifyGuestBooking.bind(null, code), {});
  return (
    <form action={action} className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium">Booking phone number <Input type="tel" name="phone" autoComplete="tel" maxLength={40} required /></label>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button disabled={pending}>{pending ? "Verifying…" : "View reservation"}</Button>
    </form>
  );
}

export function CopyBookingLink() {
  const [status, setStatus] = useState<"copied" | "manual">();
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.origin + window.location.pathname);
      setStatus("copied");
    } catch {
      setStatus("manual");
    }
  }
  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={copy}>Copy booking link</Button>
      <p className="text-sm text-muted-foreground">Save this private link to access your reservation on another device.</p>
      {status === "copied" && <p role="status" className="text-sm">Booking link copied.</p>}
      {status === "manual" && <p role="status" className="text-sm">Copy the private link from your browser’s address bar.</p>}
    </div>
  );
}
