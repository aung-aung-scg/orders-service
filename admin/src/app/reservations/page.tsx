import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { kitchenRoles, requireRole } from "@/lib/auth";
import { getStaffBookings } from "@/lib/booking-api";
import { bookingTime, bookingToday, bookingZone } from "@/lib/booking-display";
import { StatusButton } from "./status-button";

export default async function ReservationsPage({ searchParams }: PageProps<"/reservations">) {
  const query = await searchParams;
  const date = z.iso.date().safeParse(query.date).data ?? bookingToday();
  const next = query.date ? "/reservations?" + new URLSearchParams({ date }) : "/reservations";
  await requireRole(kitchenRoles, { next });
  const reservations = await getStaffBookings(date).catch(() => null);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Reservations</h1>
          <p className="text-sm text-muted-foreground">{bookingZone}</p>
        </div>
        <form method="get" action="/reservations" className="flex items-end gap-2">
          <label className="grid gap-1 text-sm font-medium">Date <Input type="date" name="date" defaultValue={date} required /></label>
          <Button type="submit" variant="outline">View day</Button>
        </form>
      </header>
      {!reservations ? <p role="alert" className="text-destructive">Couldn’t load reservations. Try again.</p> :
        !reservations.length ? <p className="rounded-2xl border bg-card p-5 text-muted-foreground">No reservations for this day.</p> : (
          <ul className="space-y-3">
            {reservations.map(booking => (
              <li key={booking.id}>
                <Card className="gap-3 rounded-2xl p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">{bookingTime(booking.startsAt)}–{bookingTime(booking.endsAt)} · {booking.guestName}</h2>
                      <p className="text-sm text-muted-foreground">{booking.partySize} guests · {booking.phone}</p>
                    </div>
                    <Badge variant={booking.status === "SEATED" ? "default" : "secondary"}>
                      {booking.status === "SEATED" ? `Seated at table ${booking.table.number}` : booking.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  {booking.status !== "SEATED" && <p className="text-sm">Table {booking.table.number}</p>}
                  {booking.notes && <p className="whitespace-pre-wrap wrap-break-word text-sm text-muted-foreground">{booking.notes}</p>}
                  <div className="flex flex-wrap gap-2">
                    {booking.status === "CONFIRMED" && (
                      <>
                        <StatusButton id={booking.id} status="SEATED" label="Seat" />
                        <StatusButton id={booking.id} status="NO_SHOW" label="No-show" />
                        <StatusButton id={booking.id} status="CANCELLED" label="Cancel" />
                      </>
                    )}
                    {booking.status === "SEATED" && <StatusButton id={booking.id} status="COMPLETED" label="Complete" />}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
