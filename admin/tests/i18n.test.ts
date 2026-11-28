import { createTranslator } from "next-intl";
import { expect, test, vi } from "vitest";
import en from "../messages/en.json";
import th from "../messages/th.json";
import ja from "../messages/ja.json";
import my from "../messages/my.json";
import { defaultLocale, isLocale, locales, quantityFormats } from "../src/i18n/locales";
import { bookingTime } from "../src/lib/booking-display";
import { baht } from "../src/lib/pos-schema";

vi.mock("server-only", () => ({}));

test("accepts only supported locale preferences", () => {
  expect(defaultLocale).toBe("en");
  expect(locales.filter(isLocale)).toEqual(["en", "th", "ja", "my"]);
  expect(isLocale("invalid")).toBe(false);
});

for (const [locale, messages] of Object.entries({ en, th, ja, my })) {
  test(`${locale} catalogs cover every message and interpolate values`, () => {
    expect(Object.keys(messages)).toEqual(Object.keys(en));
    for (const [namespace, source] of Object.entries(en)) {
      const translated = messages[namespace as keyof typeof en];
      expect(Object.keys(translated)).toEqual(Object.keys(source));
      const t = createTranslator({ locale, messages: messages as typeof en, formats: quantityFormats(locale), onError: error => { throw error; } });
      for (const [key, message] of Object.entries(source)) {
        const variables = [...message.matchAll(/\{([a-zA-Z][\w]*)(?:,|\})/g)].map(([, name]) => name);
        const values = Object.fromEntries(variables.map(name => [name, /^(count|number|first|last|total|current|table|limit)$/.test(name) ? 2 : "Example"]));
        expect(t(`${namespace}.${key}` as Parameters<typeof t>[0], values)).toBeTruthy();
      }
    }
  });
}

test("localizes display formats without changing the timezone or THB amount", () => {
  const instant = "2026-11-27T13:00:00.000Z";
  expect(bookingTime(instant, "Asia/Bangkok", "ja")).toBe("20:00");
  expect(bookingTime(instant, "Asia/Tokyo", "ja")).toBe("22:00");
  expect(baht(12345, "th")).toBe(new Intl.NumberFormat("th", { style: "currency", currency: "THB" }).format(123.45));
});

test("formats Burmese quantities while keeping printed table identifiers", () => {
  const t = createTranslator({ locale: "my", messages: my, formats: quantityFormats("my") });
  const count = new Intl.NumberFormat("my", { numberingSystem: "mymr" }).format(12);
  expect(t("booking.countPluralOneGuestOtherGuests", { count: 12 })).toContain(count);
  expect(t("kitchen.p0Min", { p0: 12 })).toContain(count);
  expect(t("customer.tableNumber", { number: 12 })).toContain("12");
  expect(t("feedback.tableHistory", { number: 1200 })).toContain("1200");
  expect(t("customer.orderSubtotal")).toBe("စုစုပေါင်း (အခွန်နှင့် အခြားကျသင့်ငွေများ မပါမီ)");
});
