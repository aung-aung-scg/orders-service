import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import en from "../../messages/en.json";
import { defaultLocale, isLocale, localeCookie, quantityFormats } from "./locales";

const load = {
  en: async () => en,
  th: async () => (await import("../../messages/th.json")).default,
  ja: async () => (await import("../../messages/ja.json")).default,
  my: async () => (await import("../../messages/my.json")).default,
};

export default getRequestConfig(async () => {
  const preferred = (await cookies()).get(localeCookie)?.value;
  const locale = isLocale(preferred) ? preferred : defaultLocale;
  const translated = await load[locale]() as Record<string, Record<string, string>>;
  const messages = Object.fromEntries(Object.entries(en).map(([namespace, entries]) =>
    [namespace, { ...entries, ...translated[namespace] }],
  ));
  return { locale, messages, formats: quantityFormats(locale), timeZone: "Asia/Bangkok" };
});
