import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { logout } from "./login/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orders admin",
  description: "Manage inventory and orders",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  return (
    <html lang="en">
      <body>
        <header>
          <nav aria-label="Admin">
            <strong>Orders admin</strong>
            {session?.role === "ADMIN" && (
              <>
                <Link href="/products">Products</Link>
                <Link href="/orders">Orders</Link>
                <Link href="/tables">Tables</Link>
              </>
            )}
            {session && (
              <>
                <Link href="/kitchen">Kitchen</Link>
                <form action={logout} className="logout-form"><button>Sign out</button></form>
              </>
            )}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
