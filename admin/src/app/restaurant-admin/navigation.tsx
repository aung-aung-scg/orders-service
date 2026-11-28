"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChefHat, Grid2X2, LayoutGrid, Menu, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const links = [
  { href: "/kitchen", label: "common.kitchen", icon: ChefHat },
  { href: "/reservations", label: "reservations.reservations", icon: CalendarDays },
  { href: "/table-sessions", label: "tables.tableSessions", icon: LayoutGrid },
  { href: "/menu", label: "menu.menu", icon: UtensilsCrossed, admin: true },
  { href: "/tables", label: "common.tables", icon: Grid2X2, admin: true },
];

function Navigation({ admin, mobile = false }: { admin: boolean; mobile?: boolean }) {
  const t = useTranslations();
  const path = usePathname();
  return <nav aria-label={t("common.restaurantAdministration")} className="grid gap-1">
    {links.filter(link => admin || !link.admin).map(({ href, label, icon: Icon }) => {
      const active = path === href || path.startsWith(href + "/");
      const link = <Link key={href} href={href} aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-offset-2 hover:bg-muted ${active ? "bg-muted text-primary" : "text-muted-foreground"}`}>
        <Icon className="size-4" aria-hidden="true" />{t(label)}
      </Link>;
      return mobile ? <SheetClose asChild key={href}>{link}</SheetClose> : link;
    })}
  </nav>;
}

function Brand() {
  const t = useTranslations();
  return <div className="flex items-center gap-3 text-sm font-semibold">
    <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><UtensilsCrossed className="size-4" aria-hidden="true" /></span>
    {t("common.restaurantAdmin")}
  </div>;
}

export function RestaurantSidebar({ admin }: { admin: boolean }) {
  return <aside className="hidden border-r bg-card lg:block print:hidden">
    <div className="sticky top-0 grid gap-8 p-5"><Brand /><Navigation admin={admin} /></div>
  </aside>;
}

export function MobileRestaurantNavigation({ admin }: { admin: boolean }) {
  const t = useTranslations();
  return <Sheet>
    <SheetTrigger asChild><Button variant="outline" size="icon-sm" aria-label={t("common.openRestaurantNavigation")} className="lg:hidden"><Menu /></Button></SheetTrigger>
    <SheetContent side="left" className="w-72 max-w-full gap-7 p-5 pt-12">
      <SheetTitle className="sr-only">{t("common.restaurantNavigation")}</SheetTitle>
      <SheetDescription className="sr-only">{t("common.navigateTheRestaurantStaffWorkspace")}</SheetDescription>
      <Brand /><Navigation admin={admin} mobile />
    </SheetContent>
  </Sheet>;
}
