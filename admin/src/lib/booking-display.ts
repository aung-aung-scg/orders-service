import "server-only";

export function bookingToday(bookingZone: string) {
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

export const bookingTime = (value: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, timeStyle: "short" }).format(new Date(value));
export const bookingDate = (value: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "full" }).format(new Date(value));
export const bookingStarted = (value: string) => Date.parse(value) <= Date.now();
