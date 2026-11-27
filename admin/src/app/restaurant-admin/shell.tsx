import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { ThemeToggle } from "@/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { getRestaurant } from "@/lib/restaurant-api";
import { MobileRestaurantNavigation, RestaurantSidebar } from "./navigation";

export default async function RestaurantAdminShell({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session || session.mustChangePassword) return children;

  const restaurant = await getRestaurant(session.restaurantSlug).catch(() => null);
  const name = restaurant?.id === session.restaurantId ? restaurant.name : "Restaurant admin";
  const admin = session.role === "ADMIN";
  return <div className="min-h-dvh lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] print:block print:min-h-0">
    <RestaurantSidebar admin={admin} />
    <div className="min-w-0">
      <header className="border-b bg-card print:hidden">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <MobileRestaurantNavigation admin={admin} />
            <span className="truncate text-sm font-semibold sm:text-base" title={name}>{name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <span className="rounded-full border bg-muted/50 px-2 py-1 text-xs font-medium sm:px-2.5">{admin ? "Admin" : "Kitchen"}</span>
            <ThemeToggle />
            <form action={logout}><Button variant="ghost" size="sm" aria-label="Sign out"><LogOut /><span className="hidden sm:inline">Sign out</span></Button></form>
          </div>
        </div>
      </header>
      <div className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-8 sm:py-9 print:max-w-none print:p-0">{children}</div>
    </div>
  </div>;
}
