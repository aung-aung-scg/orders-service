"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BackendError } from "@/lib/api";
import { kitchenRoles, requireRole } from "@/lib/auth";
import { bookingPath, cancelBooking, createBooking, findBookings, rescheduleBooking, updateBookingStatus, verifyBooking } from "@/lib/booking-api";
import { bookingDate, bookingTime } from "@/lib/booking-display";

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

export async function verifyGuestBooking(code: string, _state: BookingState, form: FormData): Promise<BookingState> {
  const phone = phoneInput.safeParse(form.get("phone"));
  if (!phone.success) return { error: "Enter the phone number used to book." };
  try {
    await verifyBooking(code, phone.data);
  } catch (error) {
    return feedback(error);
  }
  redirect(bookingPath(code));
}

export type BookingLookupState = BookingState & { bookings?: {
  code: string; date: string; time: string; guests: number; table: number;
}[] };

export async function lookupGuestBookings(_state: BookingLookupState, form: FormData): Promise<BookingLookupState> {
  const phone = phoneInput.safeParse(form.get("phone"));
  if (!phone.success) return { error: "Enter the phone number used to book." };
  try {
    const rows = await findBookings(phone.data);
    return { bookings: rows.map(row => ({
      code: row.code, date: bookingDate(row.startsAt), time: bookingTime(row.startsAt),
      guests: row.partySize, table: row.table.number,
    })) };
  } catch (error) {
    return feedback(error);
  }
}

export async function moveGuestBooking(code: string, revision: string, _state: BookingState, form: FormData): Promise<BookingState> {
  const startsAt = z.iso.datetime().safeParse(form.get("startsAt"));
  if (!startsAt.success) return { error: "Choose a reservation time." };
  try {
    await rescheduleBooking(code, revision, startsAt.data);
  } catch (error) {
    if (error instanceof BackendError && error.status === 409) revalidatePath(bookingPath(code) + "/reschedule");
    return feedback(error);
  }
  revalidatePath(bookingPath(code));
  redirect(bookingPath(code));
}

function feedback(error: unknown): BookingState {
  if (error instanceof BackendError && error.status < 500) return { error: error.backendMessage };
  return { error: "The booking service is unavailable. Try again shortly." };
}

export async function submitBooking(startsAt: string, partySize: number, _state: BookingState, form: FormData): Promise<BookingState> {
  const fields = guestFields.safeParse({
    guestName: form.get("guestName"), phone: form.get("phone"), email: form.get("email"),
    notes: form.get("notes"), key: form.get("key"),
  });
  if (!fields.success) return { error: "Check your name, phone number, and optional email and notes." };
  const { key, guestName, phone, email, notes } = fields.data;
  let code: string;
  try {
    ({ code } = await createBooking({ startsAt, partySize, guestName, phone, email: email || undefined, notes: notes || undefined }, key));
  } catch (error) {
    if (error instanceof BackendError && error.code === "SLOT_UNAVAILABLE") {
      revalidatePath("/book");
      return { error: "That time is no longer available. Pick another time from the updated slots." };
    }
    return feedback(error);
  }
  redirect(bookingPath(code));
}

export async function cancelGuestBooking(code: string): Promise<BookingState> {
  try {
    await cancelBooking(code);
  } catch (error) {
    if (error instanceof BackendError && error.code === "CANNOT_CANCEL") revalidatePath(bookingPath(code));
    return feedback(error);
  }
  revalidatePath(bookingPath(code));
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
