import "server-only";

export const bookingZone = process.env.BOOKING_TZ ?? "Asia/Bangkok";
export const maxBookingDays = Number(process.env.BOOKING_MAX_DAYS_AHEAD ?? 30);
export const maxBookingParty = Number(process.env.BOOKING_MAX_PARTY ?? 10);

export function bookingToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: bookingZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts();
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function bookingDayAfter(day: string, days: number) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const time = new Intl.DateTimeFormat("en-GB", { timeZone: bookingZone, timeStyle: "short" });
const fullDate = new Intl.DateTimeFormat("en-GB", { timeZone: bookingZone, dateStyle: "full" });
export const bookingTime = (value: string) => time.format(new Date(value));
export const bookingDate = (value: string) => fullDate.format(new Date(value));
export const bookingStarted = (value: string) => Date.parse(value) <= Date.now();
