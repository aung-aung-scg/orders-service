import { createHash } from "node:crypto";
import { BackendError } from "@/lib/api";
import { getTranslations } from "next-intl/server";
import { getBooking } from "@/lib/booking-api";

const calendarTime = (iso: string) => iso.replaceAll(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

export async function GET(_request: Request, { params }: RouteContext<"/r/[slug]/booking/[code]/calendar">) {
  const { slug, code } = await params;
  if (!/^[\w-]{22,80}$/.test(code)) return new Response(null, { status: 404 });
  try {
    const booking = await getBooking(slug, code);
    if (booking.status === "CANCELLED") return new Response(null, { status: 404 });
    const uid = createHash("sha256").update(code).digest("base64url");
    return new Response([
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Orders Service//Booking//EN",
      "BEGIN:VEVENT", `UID:${uid}@orders-service`, `DTSTAMP:${calendarTime(new Date().toISOString())}`,
      `LAST-MODIFIED:${calendarTime(booking.revision)}`,
      `DTSTART:${calendarTime(booking.startsAt)}`, `DTEND:${calendarTime(booking.endsAt)}`,
      `SUMMARY:${(await getTranslations("common"))("restaurantReservations")}`,
      `DESCRIPTION:${(await getTranslations("booking"))("calendarDescription", { table: booking.table.number, count: booking.partySize })}`,
      "END:VEVENT", "END:VCALENDAR", "",
    ].join("\r\n"), {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="reservation.ics"', "Cache-Control": "no-store" },
    });
  } catch (error) {
    return new Response(null, { status: error instanceof BackendError && error.status < 500 ? error.status : 502 });
  }
}
