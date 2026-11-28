import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import Home from "../src/app/page";
import messages from "../messages/en.json";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/ui/button", () => ({ Button: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/ui/card", () => ({ Card: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/language-switcher", () => ({ LanguageSwitcher: () => null }));

test("the public landing offers separate booking and staff paths", () => {
  const html = renderToStaticMarkup(<NextIntlClientProvider locale="en" messages={messages} timeZone="Asia/Bangkok"><Home /></NextIntlClientProvider>);
  expect(html).toContain('<a href="/r/default/book">Book a table</a>');
  expect(html).toContain('<a href="/r/default/login">Staff sign in</a>');
  expect(html).not.toContain('href="/products"');
});
