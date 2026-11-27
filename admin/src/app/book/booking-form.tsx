"use client";

import { useActionState, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitBooking } from "../booking-actions";

export function PartySize({ size, max }: { size: number; max: number }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-1.5">
      <label htmlFor="booking-party" className="text-sm font-medium">Party size</label>
      <div className="flex items-center gap-1.5">
        <Button type="button" size="icon" variant="outline" aria-label="Fewer guests" onClick={() => input.current?.stepDown()}><Minus /></Button>
        <Input ref={input} id="booking-party" type="number" name="partySize" min={1} max={max} defaultValue={size} required className="w-16 text-center" />
        <Button type="button" size="icon" variant="outline" aria-label="More guests" onClick={() => input.current?.stepUp()}><Plus /></Button>
      </div>
    </div>
  );
}

export function BookingForm({ startsAt, partySize, renderKey, unavailable }: {
  startsAt: string; partySize: number; renderKey: string; unavailable: boolean;
}) {
  const [key] = useState(renderKey);
  const [state, action, pending] = useActionState(submitBooking.bind(null, startsAt, partySize), {});
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="key" value={key} />
      <label className="grid gap-1.5 text-sm font-medium">Name <Input name="guestName" autoComplete="name" maxLength={200} required /></label>
      <label className="grid gap-1.5 text-sm font-medium">Phone <Input name="phone" type="tel" autoComplete="tel" minLength={3} maxLength={40} required /></label>
      <label className="grid gap-1.5 text-sm font-medium">Email (optional) <Input name="email" type="email" autoComplete="email" maxLength={254} /></label>
      <label className="grid gap-1.5 text-sm font-medium">
        Notes (optional)
        <textarea name="notes" maxLength={1000} rows={3} className="rounded-md border border-input bg-transparent p-2 font-normal" />
      </label>
      {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending || unavailable}>{pending ? "Booking…" : "Confirm reservation"}</Button>
    </form>
  );
}
