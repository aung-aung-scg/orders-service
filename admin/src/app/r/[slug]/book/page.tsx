import { getLocale, getTranslations } from "next-intl/server";
import { randomUUID } from "node:crypto";
import { publicRestaurant } from "@/lib/restaurant-api";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAvailability } from "@/lib/booking-api";
import { bookingDate, bookingDayAfter, bookingTime, bookingToday } from "@/lib/booking-display";
import { BookingForm, PartySize } from "./booking-form";

export default async function BookingPage({ params, searchParams }: PageProps<"/r/[slug]/book">) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations()]);
  const { slug } = await params;
  const { timezone: bookingZone, maxDaysAhead: maxBookingDays, maxParty: maxBookingParty, name } = await publicRestaurant(slug);
  const query = await searchParams;
  const today = bookingToday(bookingZone);
  const lastDay = bookingDayAfter(today, maxBookingDays);
  const requested = z.iso.date().safeParse(query.date);
  const date = requested.success && requested.data >= today && requested.data <= lastDay ? requested.data : today;
  const partySize = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(maxBookingParty));
  const size = partySize.safeParse(query.partySize).data ?? Math.min(2, maxBookingParty);
  const availability = await getAvailability(slug, date, size).catch(() => null);
  const slots = availability?.slots;
  const selected = slots?.find(slot => slot.startsAt === query.slot);
  const message = availability?.state === "CLOSED" ? t("feedback.closed")
    : availability?.state === "FULLY_BOOKED" ? t("feedback.fullyBooked")
    : availability?.state === "NO_REMAINING_SLOTS" ? t("feedback.noSlots") : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("booking.bookATableAtName", { name })}</h1>
      <Card className="rounded-2xl p-4 shadow-sm sm:p-6">
        <form method="get" action={"/r/" + slug + "/book"} className="flex flex-wrap items-end gap-4">
          <label className="grid gap-1.5 text-sm font-medium">
            {t("booking.date")}{" "}<Input type="date" name="date" min={today} max={lastDay} defaultValue={date} required />
          </label>
          <PartySize key={size} size={size} max={maxBookingParty} />
          <Button type="submit">{t("booking.findTimes")}</Button>
        </form>
      </Card>
      <section className="space-y-3" aria-labelledby="booking-times">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="booking-times" className="text-xl font-semibold">{t("booking.availableTimes")}</h2>
          <p className="text-sm text-muted-foreground">{bookingZone}</p>
        </div>
        {!availability ? <p role="alert" className="text-destructive">{t("booking.couldnTLoadAvailableTimesTryAgain")}</p> :
          message && <p className="rounded-2xl border bg-card p-4">{message}</p>}
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {slots?.map(slot => (
            <li key={slot.startsAt}>
              {slot.available ? (
                <Button asChild variant={selected === slot ? "default" : "outline"} className="h-10 w-full">
                  <Link prefetch={false} href={`/r/${slug}/book?${new URLSearchParams({ date, partySize: String(size), slot: slot.startsAt })}#guest-details`}>
                    {bookingTime(slot.startsAt, bookingZone, locale)}
                  </Link>
                </Button>
              ) : <Button disabled variant="outline" className="h-10 w-full line-through" aria-label={t("booking.p0Unavailable", { p0: bookingTime(slot.startsAt, bookingZone, locale) })}>{bookingTime(slot.startsAt, bookingZone, locale)}</Button>}
            </li>
          ))}
        </ul>
      </section>
      {selected && (
        <Card id="guest-details" className="scroll-mt-4 gap-4 rounded-2xl p-4 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold">{t("booking.guestDetails")}</h2>
          <p className="text-sm text-muted-foreground">{bookingDate(selected.startsAt, bookingZone, locale)} · {bookingTime(selected.startsAt, bookingZone, locale)} · {t("booking.countPluralOneGuestOtherGuests", { count: size })}</p>
          {!selected.available && <p className="text-sm text-destructive" role="alert">{t("booking.thisTimeIsUnavailableChooseAnotherSlot")}</p>}
          <BookingForm key={`${selected.startsAt}:${size}`} slug={slug} startsAt={selected.startsAt}
            partySize={size} renderKey={randomUUID()} unavailable={!selected.available} />
        </Card>
      )}
    </div>
  );
}
