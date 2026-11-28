"use server";

import { cookies } from "next/headers";
import { isLocale, localeCookie } from "./locales";

export async function setLanguage(value: string) {
  if (!isLocale(value)) return;
  (await cookies()).set(localeCookie, value, {
    path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production",
    maxAge: 365 * 24 * 60 * 60,
  });
}
