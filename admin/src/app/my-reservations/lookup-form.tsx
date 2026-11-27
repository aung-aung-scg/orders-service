"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lookupGuestBookings } from "../booking-actions";

export function LookupForm() {
  const [state, action, pending] = useActionState(lookupGuestBookings, {});
  return (
    <>
      <form action={action} className="grid gap-3">
        <label className="grid gap-1 text-sm font-medium">Booking phone number <Input name="phone" type="tel" autoComplete="tel" maxLength={40} required /></label>
        <Button disabled={pending}>{pending ? "Finding…" : "Find reservations"}</Button>
      </form>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.bookings && (state.bookings.length ? (
        <ul className="space-y-2">
          {state.bookings.map(booking => (
            <li key={booking.code} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
              <div><p className="font-medium">{booking.date} · {booking.time}</p><p>{booking.guests} guests · Table {booking.table}</p></div>
              <Button asChild size="sm" variant="outline"><Link prefetch={false} href={"/booking/" + encodeURIComponent(booking.code)}>View reservation</Link></Button>
            </li>
          ))}
        </ul>
      ) : <p role="status" className="text-sm text-muted-foreground">No upcoming reservations are available in this browser. Open your saved booking link or contact the restaurant.</p>)}
    </>
  );
}
