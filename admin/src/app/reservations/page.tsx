import { getLocale, getTranslations } from "next-intl/server";
import { bookingStatusKeys } from "@/i18n/status";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { kitchenRoles, requireRole } from "@/lib/auth";
import { getStaffBookings } from "@/lib/booking-api";
import { bookingTime, bookingToday } from "@/lib/booking-display";
import { publicRestaurant } from "@/lib/restaurant-api";
import { WorkspaceEmpty, WorkspaceLoadError } from "@/app/restaurant-admin/workspace-state";
import { StatusButton } from "./status-button";

export default async function ReservationsPage({ searchParams }: PageProps<"/reservations">) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations()]);
  const query = await searchParams;
  const requested = z.iso.date().safeParse(query.date).data;
  const next = requested ? "/reservations?" + new URLSearchParams({ date: requested }) : "/reservations";
  const session = await requireRole(kitchenRoles, { next });
  const { timezone: bookingZone } = await publicRestaurant(session.restaurantSlug);
  const date = requested ?? bookingToday(bookingZone);
  const reservations = await getStaffBookings(date).catch(() => null);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("reservations.reservations")}</h1>
          <p className="text-sm text-muted-foreground">{bookingZone}</p>
        </div>
        <form method="get" action="/reservations" className="flex items-end gap-2">
          <label className="grid gap-1 text-sm font-medium">{t("booking.date")}{" "}<Input type="date" name="date" defaultValue={date} required /></label>
          <Button type="submit" variant="outline">{t("reservations.viewDay")}</Button>
        </form>
      </header>
      {!reservations ? <WorkspaceLoadError message={t("reservations.couldnTLoadReservations")} /> :
        !reservations.length ? <WorkspaceEmpty title={t("reservations.noReservationsForThisDay")} /> : (
          <ul className="space-y-3">
            {reservations.map(booking => (
              <li key={booking.id}>
                <Card className="gap-3 rounded-2xl p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">{bookingTime(booking.startsAt, bookingZone, locale)}–{bookingTime(booking.endsAt, bookingZone, locale)} · {booking.guestName}</h2>
                      <p className="text-sm text-muted-foreground">{t("booking.countPluralOneGuestOtherGuests", { count: booking.partySize })} · {booking.phone}</p>
                    </div>
                    <Badge variant={booking.status === "SEATED" ? "default" : "secondary"}>
                      {booking.status === "SEATED" ? t("reservations.seatedAtTableP0", { p0: booking.table.number }) : t(bookingStatusKeys[booking.status])}
                    </Badge>
                  </div>
                  {booking.status !== "SEATED" && <p className="text-sm">{t("kitchen.table")}{" "}{booking.table.number}</p>}
                  {booking.notes && <p className="whitespace-pre-wrap wrap-break-word text-sm text-muted-foreground">{booking.notes}</p>}
                  <div className="flex flex-wrap gap-2">
                    {booking.status === "CONFIRMED" && (
                      <>
                        <StatusButton id={booking.id} status="SEATED" label={t("reservations.seat")} />
                        <StatusButton id={booking.id} status="NO_SHOW" label={t("booking.noShow")} />
                        <StatusButton id={booking.id} status="CANCELLED" label={t("reservations.cancel")} />
                      </>
                    )}
                    {booking.status === "SEATED" && <StatusButton id={booking.id} status="COMPLETED" label={t("reservations.complete")} />}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
