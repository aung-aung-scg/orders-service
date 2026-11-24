import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orders admin",
  description: "Manage inventory and orders",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <header>
          <nav aria-label="Admin">
            <strong>Orders admin</strong>
            <Link href="/products">Products</Link>
            <Link href="/orders">Orders</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
