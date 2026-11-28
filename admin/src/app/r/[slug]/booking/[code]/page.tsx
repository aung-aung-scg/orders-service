import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { bookingStatusKeys } from "@/i18n/status";
import type { Metadata } from "next";
import { publicRestaurant } from "@/lib/restaurant-api";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BackendError } from "@/lib/api";
import { bookingPath, getBooking } from "@/lib/booking-api";
import { bookingDate, bookingStarted, bookingTime } from "@/lib/booking-display";
import { CancelForm } from "./cancel-form";
import { CopyBookingLink, VerifyBookingForm } from "./booking-access";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("booking.yourReservation"), referrer: "no-referrer", robots: { index: false } };
}

export default async function ConfirmationPage({ params }: PageProps<"/r/[slug]/booking/[code]">) {
  const [locale, t, format] = await Promise.all([getLocale(), getTranslations(), getFormatter()]);
  const { slug, code } = await params;
  const { timezone: bookingZone } = await publicRestaurant(slug);
  if (!/^[\w-]{22,80}$/.test(code)) notFound();
  const booking = await getBooking(slug, code).catch(error => {
    if (error instanceof BackendError && error.status === 404) notFound();
    return error instanceof BackendError && error.status === 403 ? "verify" : null;
  });
  if (booking === "verify") {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <Card className="gap-4 p-5">
          <h1 className="text-2xl font-semibold">{t("booking.verifyYourReservation")}</h1>
          <p className="text-sm text-muted-foreground">{t("booking.enterThePhoneNumberUsedToBook")}</p>
          <VerifyBookingForm slug={slug} code={code} />
        </Card>
      </div>
    );
  }
  if (!booking) return <p role="alert" className="mx-auto max-w-lg px-4 py-10 text-destructive">{t("booking.couldnTLoadYourReservationTryAgain")}</p>;
  const cancelled = booking.status === "CANCELLED";
  const past = bookingStarted(booking.startsAt);
  const upcoming = booking.status === "CONFIRMED" && !past;

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <Card className="gap-5 rounded-2xl p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{cancelled ? t("booking.reservationCancelled") : t("booking.yourReservation")}</h1>
          <Badge variant={cancelled ? "outline" : "secondary"}>{t(bookingStatusKeys[booking.status])}</Badge>
        </div>
        {past && <p className="text-sm text-muted-foreground">{t("booking.thisReservationSStartTimeHasPassed")}</p>}
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2"><dt className="text-muted-foreground">{t("booking.date")}</dt><dd className="font-medium">{bookingDate(booking.startsAt, bookingZone, locale)}</dd></div>
          <div className="col-span-2"><dt className="text-muted-foreground">{t("booking.time")}{" "}{bookingZone}</dt>
            <dd className="font-medium">{bookingTime(booking.startsAt, bookingZone, locale)}–{bookingTime(booking.endsAt, bookingZone, locale)}</dd></div>
          <div><dt className="text-muted-foreground">{t("kitchen.table")}</dt><dd className="font-medium">{booking.table.number}</dd></div>
          <div><dt className="text-muted-foreground">{t("booking.guests2")}</dt><dd className="font-medium">{format.number(booking.partySize, "quantity")}</dd></div>
        </dl>
        {upcoming && (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{booking.canCancel ? t("booking.cancelOnlineBefore") : t("booking.onlineCancellationClosedAt")}{" "}
              {t("booking.timeOnDate", { time: bookingTime(booking.cancellationDeadline, bookingZone, locale), date: bookingDate(booking.cancellationDeadline, bookingZone, locale) })} ({bookingZone}).</p>
            <p>{booking.canReschedule ? t("booking.rescheduleOnlineBefore") : t("booking.onlineReschedulingClosedAt")}{" "}
              {t("booking.timeOnDate", { time: bookingTime(booking.reschedulingDeadline, bookingZone, locale), date: bookingDate(booking.reschedulingDeadline, bookingZone, locale) })} ({bookingZone}).</p>
          </div>
        )}
        {upcoming ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild><a href={bookingPath(slug, code) + "/calendar"}>{t("booking.downloadCalendarEvent")}</a></Button>
            {booking.canReschedule && <Button asChild variant="outline"><Link href={bookingPath(slug, code) + "/reschedule"}>{t("booking.reschedule")}</Link></Button>}
            {booking.canCancel && <CancelForm slug={slug} code={code} />}
          </div>
        ) : <Button asChild variant="outline"><Link href={"/r/" + slug + "/book"}>{t("common.bookATable")}</Link></Button>}
        <CopyBookingLink />
      </Card>
    </div>
  );
}
