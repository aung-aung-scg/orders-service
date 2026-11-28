"use client";

import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitBooking } from "@/app/booking-actions";

export function PartySize({ size, max }: { size: number; max: number }) {
  const t = useTranslations();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-1.5">
      <label htmlFor="booking-party" className="text-sm font-medium">{t("booking.partySize")}</label>
      <div className="flex items-center gap-1.5">
        <Button type="button" size="icon" variant="outline" aria-label={t("booking.fewerGuests")} onClick={() => input.current?.stepDown()}><Minus /></Button>
        <Input ref={input} id="booking-party" type="number" name="partySize" min={1} max={max} defaultValue={size} required className="w-16 text-center" />
        <Button type="button" size="icon" variant="outline" aria-label={t("booking.moreGuests")} onClick={() => input.current?.stepUp()}><Plus /></Button>
      </div>
    </div>
  );
}

export function BookingForm({ slug, startsAt, partySize, renderKey, unavailable }: {
  slug: string;
  startsAt: string; partySize: number; renderKey: string; unavailable: boolean;
}) {
  const t = useTranslations();
  const [key] = useState(renderKey);
  const [state, action, pending] = useActionState(submitBooking.bind(null, slug, startsAt, partySize), {});
  return (
    <form action={action} noValidate className="grid gap-4">
      <input type="hidden" name="key" value={key} />
      <label className="grid gap-1.5 text-sm font-medium">{t("menu.name")}{" "}<Input name="guestName" autoComplete="name" maxLength={200} required /></label>
      <label className="grid gap-1.5 text-sm font-medium">{t("booking.phone")}{" "}<Input name="phone" type="tel" autoComplete="tel" minLength={3} maxLength={40} required /></label>
      <label className="grid gap-1.5 text-sm font-medium">{t("booking.emailOptional")}{" "}<Input name="email" type="email" autoComplete="email" maxLength={254} /></label>
      <label className="grid gap-1.5 text-sm font-medium">
        {t("booking.notesOptional")}
        <textarea name="notes" maxLength={1000} rows={3} className="rounded-md border border-input bg-transparent p-2 font-normal" />
      </label>
      {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending || unavailable}>{pending ? t("booking.booking") : t("booking.confirmReservation")}</Button>
    </form>
  );
}
