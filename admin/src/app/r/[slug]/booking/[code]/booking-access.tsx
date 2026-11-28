"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyGuestBooking } from "@/app/booking-actions";

export function VerifyBookingForm({ slug, code }: { slug: string; code: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(verifyGuestBooking.bind(null, slug, code), {});
  return (
    <form action={action} noValidate className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium">{t("booking.bookingPhoneNumber")}{" "}<Input type="tel" name="phone" autoComplete="tel" maxLength={40} required /></label>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button disabled={pending}>{pending ? t("booking.verifying") : t("booking.viewReservation")}</Button>
    </form>
  );
}

export function CopyBookingLink() {
  const t = useTranslations();
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
      <Button type="button" variant="outline" onClick={copy}>{t("booking.copyBookingLink")}</Button>
      <p className="text-sm text-muted-foreground">{t("booking.saveThisPrivateLinkToAccessYour")}</p>
      {status === "copied" && <p role="status" className="text-sm">{t("booking.bookingLinkCopied")}</p>}
      {status === "manual" && <p role="status" className="text-sm">{t("booking.copyThePrivateLinkFromYourBrowser")}</p>}
    </div>
  );
}
