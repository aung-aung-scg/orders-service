import { createTranslator } from "next-intl";
import { expect, test, vi } from "vitest";
import en from "../messages/en.json";
import th from "../messages/th.json";
import ja from "../messages/ja.json";
import my from "../messages/my.json";
import { BackendError } from "../src/lib/api";
import { backendText } from "../src/i18n/server-text";
import { quantityFormats } from "../src/i18n/locales";

const nextIntl = vi.hoisted(() => ({ getLocale: vi.fn(), getTranslations: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next-intl/server", () => nextIntl);

for (const [locale, messages] of Object.entries({ en, th, ja, my })) {
  test(`${locale} explains kitchen transition and cart limit failures`, async () => {
    const t = createTranslator({ locale, messages, formats: quantityFormats(locale) });
    nextIntl.getLocale.mockResolvedValue(locale);
    nextIntl.getTranslations.mockResolvedValue(t);
    for (const [code, expected] of [
      ["INVALID_STATUS_TRANSITION", t("feedback.invalidStatusTransition")],
      ["LINE_LIMIT", t("feedback.cartLineLimit", { limit: 50 })],
      ["TOTAL_LIMIT", t("feedback.cartTotalLimit")],
    ]) {
      expect(await backendText(new BackendError(409, code, "Original error"))).toBe(expected);
      expect(expected).not.toBe(t("errors.theRequestFailedTryAgain"));
    }
    expect(t("feedback.cartLineLimit", { limit: 50 })).toContain(new Intl.NumberFormat(locale, quantityFormats(locale).number.quantity).format(50));
  });
}
