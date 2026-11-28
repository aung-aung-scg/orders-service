"use server";

import { backendText, text } from "@/i18n/server-text";
import { getLocale } from "next-intl/server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BackendError } from "@/lib/api";
import { kitchenRoles, requireRole } from "@/lib/auth";
import { bookingPath, cancelBooking, createBooking, findBookings, rescheduleBooking, updateBookingStatus, verifyBooking } from "@/lib/booking-api";
import { bookingDate, bookingTime } from "@/lib/booking-display";
import { getRestaurant } from "@/lib/restaurant-api";

export type BookingState = { error?: string };
const phoneInput = z.string().trim().max(40).regex(/^\+?[\d().\s-]+$/)
  .refine(value => /^\d{7,15}$/.test(value.replace(/\D/g, "")));
const guestFields = z.object({
  guestName: z.string().trim().min(1).max(200),
  phone: phoneInput,
  email: z.union([z.literal(""), z.email().max(254)]),
  notes: z.string().trim().max(1000),
  key: z.uuid(),
});

export async function verifyGuestBooking(slug: string, code: string, _state: BookingState, form: FormData): Promise<BookingState> {
  const phone = phoneInput.safeParse(form.get("phone"));
  if (!phone.success) return { error: await text("booking.enterThePhoneNumberUsedToBook") };
  try {
    await verifyBooking(slug, code, phone.data);
  } catch (error) {
    return feedback(error);
  }
  redirect(bookingPath(slug, code));
}

export type BookingLookupState = BookingState & { bookings?: {
  code: string; date: string; time: string; guests: number; table: number;
}[] };

export async function lookupGuestBookings(slug: string, _state: BookingLookupState, form: FormData): Promise<BookingLookupState> {
  const phone = phoneInput.safeParse(form.get("phone"));
  if (!phone.success) return { error: await text("booking.enterThePhoneNumberUsedToBook") };
  try {
    const [{ timezone }, rows] = await Promise.all([getRestaurant(slug), findBookings(slug, phone.data)]);
    const locale = await getLocale();
    return { bookings: rows.map(row => ({
      code: row.code, date: bookingDate(row.startsAt, timezone, locale), time: bookingTime(row.startsAt, timezone, locale),
      guests: row.partySize, table: row.table.number,
    })) };
  } catch (error) {
    return feedback(error);
  }
}

export async function moveGuestBooking(slug: string, code: string, revision: string, _state: BookingState, form: FormData): Promise<BookingState> {
  const startsAt = z.iso.datetime().safeParse(form.get("startsAt"));
  if (!startsAt.success) return { error: await text("errors.chooseAReservationTime") };
  try {
    await rescheduleBooking(slug, code, revision, startsAt.data);
  } catch (error) {
    if (error instanceof BackendError && error.status === 409) revalidatePath(bookingPath(slug, code) + "/reschedule");
    return feedback(error);
  }
  revalidatePath(bookingPath(slug, code));
  redirect(bookingPath(slug, code));
}

async function feedback(error: unknown): Promise<BookingState> {
  if (error instanceof BackendError && error.status < 500) return { error: await backendText(error) };
  return { error: await text("errors.theBookingServiceIsUnavailableTryAgain") };
}

export async function submitBooking(slug: string, startsAt: string, partySize: number, _state: BookingState, form: FormData): Promise<BookingState> {
  const fields = guestFields.safeParse({
    guestName: form.get("guestName"), phone: form.get("phone"), email: form.get("email"),
    notes: form.get("notes"), key: form.get("key"),
  });
  if (!fields.success) return { error: await text("errors.checkYourNamePhoneNumberAndOptional") };
  const { key, guestName, phone, email, notes } = fields.data;
  let code: string;
  try {
    ({ code } = await createBooking(slug, { startsAt, partySize, guestName, phone, email: email || undefined, notes: notes || undefined }, key));
  } catch (error) {
    if (error instanceof BackendError && error.code === "SLOT_UNAVAILABLE") {
      revalidatePath("/book");
      return { error: await text("errors.thatTimeIsNoLongerAvailablePick") };
    }
    return feedback(error);
  }
  redirect(bookingPath(slug, code));
}

export async function cancelGuestBooking(slug: string, code: string): Promise<BookingState> {
  try {
    await cancelBooking(slug, code);
  } catch (error) {
    if (error instanceof BackendError && error.code === "CANNOT_CANCEL") revalidatePath(bookingPath(slug, code));
    return feedback(error);
  }
  revalidatePath(bookingPath(slug, code));
  return {};
}

export async function changeStaffBooking(id: string, status: "SEATED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"): Promise<BookingState> {
  await requireRole(kitchenRoles, { next: "/reservations" });
  try {
    await updateBookingStatus(id, status);
  } catch (error) {
    revalidatePath("/reservations");
    return feedback(error);
  }
  revalidatePath("/reservations");
  return {};
}
