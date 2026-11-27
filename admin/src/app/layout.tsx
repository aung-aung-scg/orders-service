import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { CalendarDays, ChefHat, Grid2X2, LogOut, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { logout } from "./login/actions";
import { ThemeToggle } from "./theme-toggle";
import "./globals.css";

const geist = localFont({
  src: "../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Orders admin",
  description: "Manage inventory and orders",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <body>
        {session && (
          <header data-staff-nav className="border-b bg-card print:hidden">
            <nav aria-label="Staff" className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-1 px-3 py-2 sm:gap-2 sm:px-8">
              <span className="mr-auto hidden text-sm font-semibold sm:block">Orders admin</span>
              <Button asChild variant="ghost"><Link href="/kitchen"><ChefHat /> Kitchen</Link></Button>
              <Button asChild variant="ghost"><Link href="/reservations"><CalendarDays /> Reservations</Link></Button>
              <Button asChild variant="ghost"><Link href="/table-sessions"><Grid2X2 /> Table sessions</Link></Button>
              {session.role === "ADMIN" && (
                <>
                  <Button asChild variant="ghost"><Link href="/menu"><Utensils /> Menu</Link></Button>
                  <Button asChild variant="ghost"><Link href="/tables"><Grid2X2 /> Tables</Link></Button>
                </>
              )}
              <div className="ml-auto sm:ml-0"><ThemeToggle /></div>
              <form action={logout}>
                <Button variant="outline"><LogOut /> Logout</Button>
              </form>
            </nav>
          </header>
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}
