import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BackendError } from "@/lib/api";
import { bookingPath, getBooking } from "@/lib/booking-api";
import { bookingDate, bookingStarted, bookingTime, bookingZone } from "@/lib/booking-display";
import { CancelForm } from "./cancel-form";
import { CopyBookingLink, VerifyBookingForm } from "./booking-access";

export const metadata: Metadata = { title: "Your reservation", referrer: "no-referrer", robots: { index: false } };

export default async function ConfirmationPage({ params }: PageProps<"/booking/[code]">) {
  const { code } = await params;
  if (!/^[\w-]{22,80}$/.test(code)) notFound();
  const booking = await getBooking(code).catch(error => {
    if (error instanceof BackendError && error.status === 404) notFound();
    return error instanceof BackendError && error.status === 403 ? "verify" : null;
  });
  if (booking === "verify") {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <Card className="gap-4 p-5">
          <h1 className="text-2xl font-semibold">Verify your reservation</h1>
          <p className="text-sm text-muted-foreground">Enter the phone number used to book.</p>
          <VerifyBookingForm code={code} />
        </Card>
      </div>
    );
  }
  if (!booking) return <p role="alert" className="mx-auto max-w-lg px-4 py-10 text-destructive">Couldn’t load your reservation. Try again shortly.</p>;
  const cancelled = booking.status === "CANCELLED";
  const past = bookingStarted(booking.startsAt);
  const upcoming = booking.status === "CONFIRMED" && !past;

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <Card className="gap-5 rounded-2xl p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{cancelled ? "Reservation cancelled" : "Your reservation"}</h1>
          <Badge variant={cancelled ? "outline" : "secondary"}>{booking.status.replaceAll("_", " ")}</Badge>
        </div>
        {past && <p className="text-sm text-muted-foreground">This reservation’s start time has passed.</p>}
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2"><dt className="text-muted-foreground">Date</dt><dd className="font-medium">{bookingDate(booking.startsAt)}</dd></div>
          <div className="col-span-2"><dt className="text-muted-foreground">Time · {bookingZone}</dt>
            <dd className="font-medium">{bookingTime(booking.startsAt)}–{bookingTime(booking.endsAt)}</dd></div>
          <div><dt className="text-muted-foreground">Table</dt><dd className="font-medium">{booking.table.number}</dd></div>
          <div><dt className="text-muted-foreground">Guests</dt><dd className="font-medium">{booking.partySize}</dd></div>
        </dl>
        {upcoming && (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{booking.canCancel ? "Cancel online before" : "Online cancellation closed at"}{" "}
              {bookingTime(booking.cancellationDeadline)} on {bookingDate(booking.cancellationDeadline)} ({bookingZone}).</p>
            <p>{booking.canReschedule ? "Reschedule online before" : "Online rescheduling closed at"}{" "}
              {bookingTime(booking.reschedulingDeadline)} on {bookingDate(booking.reschedulingDeadline)} ({bookingZone}).</p>
          </div>
        )}
        {upcoming ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild><a href={bookingPath(code) + "/calendar"}>Download calendar event</a></Button>
            {booking.canReschedule && <Button asChild variant="outline"><Link href={bookingPath(code) + "/reschedule"}>Reschedule</Link></Button>}
            {booking.canCancel && <CancelForm code={code} />}
          </div>
        ) : <Button asChild variant="outline"><Link href="/book">Book a table</Link></Button>}
        <CopyBookingLink />
      </Card>
    </div>
  );
}
