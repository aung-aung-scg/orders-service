import { randomUUID } from "node:crypto";
import { publicRestaurant } from "@/lib/restaurant-api";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAvailability } from "@/lib/booking-api";
import { bookingDayAfter, bookingTime, bookingToday } from "@/lib/booking-display";
import { BookingForm, PartySize } from "./booking-form";

export default async function BookingPage({ params, searchParams }: PageProps<"/r/[slug]/book">) {
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
  const message = availability?.state === "CLOSED" ? "The restaurant is closed for today. Choose another date."
    : availability?.state === "FULLY_BOOKED" ? "Fully booked for this party size. Try another date or party size."
    : availability?.state === "NO_REMAINING_SLOTS" ? "No remaining booking slots for this date. Choose another date." : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Book a table at {name}</h1>
      <Card className="rounded-2xl p-4 shadow-sm sm:p-6">
        <form method="get" action={"/r/" + slug + "/book"} className="flex flex-wrap items-end gap-4">
          <label className="grid gap-1.5 text-sm font-medium">
            Date <Input type="date" name="date" min={today} max={lastDay} defaultValue={date} required />
          </label>
          <PartySize key={size} size={size} max={maxBookingParty} />
          <Button type="submit">Find times</Button>
        </form>
      </Card>
      <section className="space-y-3" aria-labelledby="booking-times">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="booking-times" className="text-xl font-semibold">Available times</h2>
          <p className="text-sm text-muted-foreground">{bookingZone}</p>
        </div>
        {!availability ? <p role="alert" className="text-destructive">Couldn’t load available times. Try again.</p> :
          message && <p className="rounded-2xl border bg-card p-4">{message}</p>}
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {slots?.map(slot => (
            <li key={slot.startsAt}>
              {slot.available ? (
                <Button asChild variant={selected === slot ? "default" : "outline"} className="h-10 w-full">
                  <Link prefetch={false} href={`/r/${slug}/book?${new URLSearchParams({ date, partySize: String(size), slot: slot.startsAt })}#guest-details`}>
                    {bookingTime(slot.startsAt, bookingZone)}
                  </Link>
                </Button>
              ) : <Button disabled variant="outline" className="h-10 w-full line-through" aria-label={`${bookingTime(slot.startsAt, bookingZone)} unavailable`}>{bookingTime(slot.startsAt, bookingZone)}</Button>}
            </li>
          ))}
        </ul>
      </section>
      {selected && (
        <Card id="guest-details" className="scroll-mt-4 gap-4 rounded-2xl p-4 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold">Guest details</h2>
          <p className="text-sm text-muted-foreground">{date} · {bookingTime(selected.startsAt, bookingZone)} · {size} guests</p>
          {!selected.available && <p className="text-sm text-destructive" role="alert">This time is unavailable. Choose another slot.</p>}
          <BookingForm key={`${selected.startsAt}:${size}`} slug={slug} startsAt={selected.startsAt}
            partySize={size} renderKey={randomUUID()} unavailable={!selected.available} />
        </Card>
      )}
    </div>
  );
}
