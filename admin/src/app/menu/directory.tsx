"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import Image from "next/image";
import { CheckCircle2, ChevronLeft, ChevronRight, EyeOff, ImageIcon, Search, SlidersHorizontal, UtensilsCrossed } from "lucide-react";
import { WorkspaceEmpty } from "@/app/restaurant-admin/workspace-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { MenuItem } from "@/lib/menu-api";
import { menuImagePath } from "@/lib/menu-image";
import { AvailabilitySwitch, MenuEditor } from "./controls";

type Availability = "all" | "available" | "hidden";
const PAGE_SIZE = 8;

function MenuThumbnail({ item }: { item: MenuItem }) {
  const image = menuImagePath(item.imageKey);
  return image
    ? <Image src={image} alt="" width={40} height={40} unoptimized className="size-10 shrink-0 rounded-lg object-cover" />
    : <span className="grid size-10 shrink-0 place-items-center rounded-lg border bg-muted/50 text-muted-foreground">
      <ImageIcon className="size-4" aria-hidden="true" />
    </span>;
}

export function MenuDirectory({ items }: { items: MenuItem[] }) {
  const t = useTranslations();
  const format = useFormatter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Availability>("all");
  const [page, setPage] = useState(1);
  const available = items.filter(item => item.available).length;
  const stats = [
    { label: t("menu.totalItems"), count: items.length, icon: UtensilsCrossed, tone: "bg-primary/10 text-primary" },
    { label: t("menu.available"), count: available, icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
    { label: t("menu.hidden"), count: items.length - available, icon: EyeOff, tone: "bg-amber-500/15 text-amber-800 dark:text-amber-200" },
  ];
  const needle = search.trim().toLowerCase();
  const found = items.filter(item =>
    (filter === "all" || item.available === (filter === "available")) && item.name.toLowerCase().includes(needle),
  );
  const pageCount = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const visible = found.slice(offset, offset + PAGE_SIZE);

  function clearFilters() {
    setSearch("");
    setFilter("all");
    setPage(1);
  }

  return <section className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("menu.menu")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("menu.manageDishesPricesAndAvailability")}</p>
      </div>
      <MenuEditor />
    </header>
    <dl className="grid gap-3 sm:grid-cols-3">
      {stats.map(({ label, count, icon: Icon, tone }) => <div key={label} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
        <div><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{format.number(count)}</dd></div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="size-5" aria-hidden="true" /></span>
      </div>)}
    </dl>
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5">
        <h2 className="text-base font-semibold">{t("menu.menuItems")}</h2>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <div className="relative min-w-36 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder={t("menu.searchMenuItems")} aria-label={t("menu.searchMenuItems")} className="pl-9 sm:w-56" />
          </div>
          <div className="relative">
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <select value={filter} onChange={event => { setFilter(event.target.value as Availability); setPage(1); }} aria-label={t("menu.filterAvailability")}
              className="h-9 rounded-md border border-input bg-background pr-2 pl-8 text-sm focus-visible:outline-2 focus-visible:outline-ring">
              <option value="all">{t("menu.allItems")}</option><option value="available">{t("menu.available")}</option><option value="hidden">{t("menu.hidden")}</option>
            </select>
          </div>
        </div>
      </div>
      {visible.length ? <table aria-label={t("menu.menuItems")} className="block w-full text-left text-sm md:table">
        <thead className="hidden bg-muted/40 text-xs text-muted-foreground md:table-header-group">
          <tr><th scope="col" className="px-5 py-3">{t("menu.item")}</th><th scope="col" className="px-4 py-3">{t("menu.price")}</th>
            <th scope="col" className="px-4 py-3">{t("menu.availability")}</th><th scope="col" className="px-5 py-3 text-right">{t("menu.actions")}</th></tr>
        </thead>
        <tbody className="grid gap-3 bg-muted/20 p-3 md:table-row-group md:divide-y md:bg-transparent md:p-0">
          {visible.map(item => <tr key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 rounded-xl border bg-card p-3 md:table-row md:border-0 md:bg-transparent md:hover:bg-muted/20">
            <th scope="row" className="min-w-0 text-left font-medium md:px-5 md:py-3">
              <div className="flex min-w-0 items-center gap-3"><MenuThumbnail item={item} /><span className="wrap-break-word">{item.name}</span></div>
            </th>
            <td className="whitespace-nowrap text-right font-medium tabular-nums md:px-4 md:py-3 md:text-left">{format.number(item.priceMinor / 100, { style: "currency", currency: "THB" })}</td>
            <td className="md:px-4 md:py-3"><AvailabilitySwitch item={item} /></td>
            <td className="text-right md:px-5 md:py-3"><MenuEditor item={item} /></td>
          </tr>)}
        </tbody>
      </table> : <div className="p-4">
        <WorkspaceEmpty title={items.length ? t("menu.noMatchingMenuItems") : t("menu.noMenuItemsYet")}
          detail={items.length ? t("menu.tryADifferentSearchOrAvailabilityFilter") : t("menu.addAnItemToStartBuildingYour")}>
          {items.length > 0 && <Button variant="outline" size="sm" className="mt-2" onClick={clearFilters}>{t("menu.clearFilters")}</Button>}
        </WorkspaceEmpty>
      </div>}
      {found.length > 0 && <nav aria-label={t("menu.menuPages")} className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 sm:px-5">
        <p aria-live="polite" className="text-xs text-muted-foreground">{t("customer.showingFirstLastOfCount", { first: offset + 1, last: offset + visible.length, count: found.length })}</p>
        <div className="flex items-center gap-2 text-xs">
          <Button variant="outline" size="icon-sm" disabled={currentPage === 1} aria-label={t("menu.previousPage")} onClick={() => setPage(currentPage - 1)}><ChevronLeft /></Button>
          <span>{t("customer.pageCurrentOfTotal", { current: currentPage, total: pageCount })}</span>
          <Button variant="outline" size="icon-sm" disabled={currentPage === pageCount} aria-label={t("menu.nextPage")} onClick={() => setPage(currentPage + 1)}><ChevronRight /></Button>
        </div>
      </nav>}
    </Card>
  </section>;
}
