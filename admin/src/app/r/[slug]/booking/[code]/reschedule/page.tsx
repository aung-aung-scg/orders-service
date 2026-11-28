import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { publicRestaurant } from "@/lib/restaurant-api";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BackendError } from "@/lib/api";
import { bookingPath, getBooking, rescheduleAvailability } from "@/lib/booking-api";
import { bookingDate, bookingDayAfter, bookingTime, bookingToday } from "@/lib/booking-display";
import { RescheduleForm } from "./reschedule-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("booking.rescheduleReservation"), referrer: "no-referrer", robots: { index: false } };
}

export default async function ReschedulePage({ params, searchParams }: PageProps<"/r/[slug]/booking/[code]/reschedule">) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations()]);
  const { slug, code } = await params;
  const { timezone: bookingZone, maxDaysAhead: maxBookingDays } = await publicRestaurant(slug);
  if (!/^[\w-]{22,80}$/.test(code)) notFound();
  const path = bookingPath(slug, code);
  const booking = await getBooking(slug, code).catch(error => {
    if (error instanceof BackendError && error.status < 500) redirect(path);
    return null;
  });
  if (booking && !booking.canReschedule) redirect(path);
  const today = bookingToday(bookingZone);
  const lastDay = bookingDayAfter(today, maxBookingDays);
  const requested = z.iso.date().safeParse((await searchParams).date).data;
  const date = requested && requested >= today && requested <= lastDay ? requested : today;
  const slots = booking ? await rescheduleAvailability(slug, code, date).catch(() => null) : null;

  return (
    <section className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <Card className="gap-4 p-5 sm:p-7">
        <h1 className="text-2xl font-semibold">{t("booking.rescheduleReservation")}</h1>
        <Button asChild variant="link" className="w-fit px-0"><Link href={path}>{t("booking.backToReservation")}</Link></Button>
        {booking ? (
          <>
            <p className="text-sm">{t("booking.currentBooking")}{" "}{bookingDate(booking.startsAt, bookingZone, locale)}{" "}{t("booking.at")}{" "}{bookingTime(booking.startsAt, bookingZone, locale)}.</p>
            <p className="text-sm text-muted-foreground">{t("booking.rescheduleBefore")}{" "}{t("booking.timeOnDate", { time: bookingTime(booking.reschedulingDeadline, bookingZone, locale), date: bookingDate(booking.reschedulingDeadline, bookingZone, locale) })} ({bookingZone}).</p>
            <form method="get" action={path + "/reschedule"} className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm font-medium">{t("booking.newDate")}{" "}<Input type="date" name="date" min={today} max={lastDay} defaultValue={date} required /></label>
              <Button type="submit" variant="outline">{t("booking.showAvailableTimes")}</Button>
            </form>
            {!slots ? <p role="alert" className="text-sm text-destructive">{t("booking.couldnTLoadTimesReviewYourReservation")}</p> :
              slots.length ? <RescheduleForm key={date} slug={slug} code={code} revision={booking.revision} slots={slots.map(slot => ({
                startsAt: slot.startsAt, label: bookingTime(slot.startsAt, bookingZone, locale), date: bookingDate(slot.startsAt, bookingZone, locale),
              }))} /> : <p role="status" className="text-sm">{t("booking.noAvailableTimesOnThisDateChoose")}</p>}
          </>
        ) : <p role="alert">{t("booking.couldnTLoadYourReservationTryAgain")}</p>}
      </Card>
    </section>
  );
}
