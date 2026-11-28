export const locales = ["en", "th", "ja", "my"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const localeCookie = "NEXT_LOCALE";

export const languageNames: Record<Locale, string> = {
  en: "English", th: "ไทย", ja: "日本語", my: "မြန်မာ",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.some(locale => locale === value);
}

export function quantityFormats(locale: string) {
  return { number: { quantity: locale === "my" ? { numberingSystem: "mymr" } : {} } };
}
