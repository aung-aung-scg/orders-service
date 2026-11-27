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

export const metadata: Metadata = { title: "Reschedule reservation", referrer: "no-referrer", robots: { index: false } };

export default async function ReschedulePage({ params, searchParams }: PageProps<"/r/[slug]/booking/[code]/reschedule">) {
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
        <h1 className="text-2xl font-semibold">Reschedule reservation</h1>
        <Button asChild variant="link" className="w-fit px-0"><Link href={path}>Back to reservation</Link></Button>
        {booking ? (
          <>
            <p className="text-sm">Current booking: {bookingDate(booking.startsAt, bookingZone)} at {bookingTime(booking.startsAt, bookingZone)}.</p>
            <p className="text-sm text-muted-foreground">Reschedule before {bookingTime(booking.reschedulingDeadline, bookingZone)} on {bookingDate(booking.reschedulingDeadline, bookingZone)} ({bookingZone}).</p>
            <form method="get" action={path + "/reschedule"} className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm font-medium">New date <Input type="date" name="date" min={today} max={lastDay} defaultValue={date} required /></label>
              <Button type="submit" variant="outline">Show available times</Button>
            </form>
            {!slots ? <p role="alert" className="text-sm text-destructive">Couldn’t load times. Review your reservation and try again.</p> :
              slots.length ? <RescheduleForm key={date} slug={slug} code={code} revision={booking.revision} slots={slots.map(slot => ({
                startsAt: slot.startsAt, label: bookingTime(slot.startsAt, bookingZone), date: bookingDate(slot.startsAt, bookingZone),
              }))} /> : <p role="status" className="text-sm">No available times on this date. Choose another date.</p>}
          </>
        ) : <p role="alert">Couldn’t load your reservation. Try again shortly.</p>}
      </Card>
    </section>
  );
}
