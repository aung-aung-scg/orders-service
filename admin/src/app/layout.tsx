import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "@fontsource/noto-sans-thai/thai-400.css";
import "@fontsource/noto-sans-jp/400.css";
import "@fontsource/noto-sans-myanmar/myanmar-400.css";
import "./globals.css";

const geist = localFont({
  src: "../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return { title: t("ordersAdmin"), description: t("manageInventoryAndOrders") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={geist.variable} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider><main>{children}</main></NextIntlClientProvider>
      </body>
    </html>
  );
}
