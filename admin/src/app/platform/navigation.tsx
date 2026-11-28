"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ComponentProps } from "react";
import { Building2, Menu, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function PlatformBrand() {
  const t = useTranslations();
  return <div className="flex items-center gap-3">
    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
      <UtensilsCrossed className="size-4" aria-hidden="true" />
    </span>
    <span className="text-sm font-semibold tracking-tight">{t("platform.restaurantPlatform")}</span>
  </div>;
}

function RestaurantsLink(props: Omit<ComponentProps<typeof Link>, "href">) {
  const t = useTranslations();
  return <Link {...props} href="/platform" aria-current="page" className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5 text-sm font-medium outline-offset-4">
    <Building2 className="size-4 text-primary" aria-hidden="true" />{" "}{t("platform.restaurants")}
  </Link>;
}

export function PlatformSidebar() {
  const t = useTranslations();
  return <aside className="hidden border-r bg-card lg:block">
    <div className="sticky top-0 grid gap-8 p-5">
      <PlatformBrand />
      <nav aria-label={t("platform.platformNavigation")}><RestaurantsLink /></nav>
    </div>
  </aside>;
}

export function MobilePlatformNavigation() {
  const t = useTranslations();
  return <Sheet>
    <SheetTrigger asChild>
      <Button variant="outline" size="icon" aria-label={t("platform.openPlatformNavigation")} className="lg:hidden"><Menu /></Button>
    </SheetTrigger>
    <SheetContent side="left" className="w-72 gap-7 p-5 pt-12">
      <SheetTitle className="sr-only">{t("platform.platformNavigation")}</SheetTitle>
      <SheetDescription className="sr-only">{t("platform.navigateTheSuperAdminPlatform")}</SheetDescription>
      <PlatformBrand />
      <nav aria-label={t("platform.platformNavigation")}><SheetClose asChild><RestaurantsLink /></SheetClose></nav>
    </SheetContent>
  </Sheet>;
}
