"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lookupGuestBookings } from "@/app/booking-actions";

export function LookupForm({ slug }: { slug: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(lookupGuestBookings.bind(null, slug), {});
  return (
    <>
      <form action={action} noValidate className="grid gap-3">
        <label className="grid gap-1 text-sm font-medium">{t("booking.bookingPhoneNumber")}{" "}<Input name="phone" type="tel" autoComplete="tel" maxLength={40} required /></label>
        <Button disabled={pending}>{pending ? t("booking.finding") : t("booking.findReservations")}</Button>
      </form>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.bookings && (state.bookings.length ? (
        <ul className="space-y-2">
          {state.bookings.map(booking => (
            <li key={booking.code} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
              <div><p className="font-medium">{booking.date} · {booking.time}</p><p>{t("booking.countPluralOneGuestOtherGuests", { count: booking.guests })} · {t("customer.tableNumber", { number: booking.table })}</p></div>
              <Button asChild size="sm" variant="outline"><Link prefetch={false} href={"/r/" + slug + "/booking/" + encodeURIComponent(booking.code)}>{t("booking.viewReservation")}</Link></Button>
            </li>
          ))}
        </ul>
      ) : <p role="status" className="text-sm text-muted-foreground">{t("booking.noUpcomingReservationsAreAvailableInThis")}</p>)}
    </>
  );
}
