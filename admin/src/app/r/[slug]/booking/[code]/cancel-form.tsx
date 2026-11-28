"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cancelGuestBooking } from "@/app/booking-actions";

export function CancelForm({ slug, code }: { slug: string; code: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(cancelGuestBooking.bind(null, slug, code), {});
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline">{t("booking.cancelReservation")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("booking.cancelThisReservation")}</DialogTitle>
          <DialogDescription>{t("booking.theTableWillBeReleasedForOther")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-3">
          {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">{t("booking.keepReservation")}</Button></DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>{pending ? t("booking.cancelling") : t("booking.cancelReservation")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
