"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Ellipsis, KeyRound, PauseCircle, PlayCircle, Plus, Search, SlidersHorizontal,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { listRestaurants } from "@/lib/platform-api";
import { RestaurantDialog, type RestaurantOperation } from "./restaurant-dialog";

type Restaurant = Awaited<ReturnType<typeof listRestaurants>>[number];
type StatusFilter = "all" | "active" | "suspended";
const PAGE_SIZE = 8;
const date = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

export function PlatformLoadError() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <>
    <h1 className="text-3xl font-semibold tracking-tight">Restaurants</h1>
    <Card className="items-start gap-3 p-6">
      <CircleAlert className="size-6 text-destructive" aria-hidden="true" />
      <p role="alert" className="font-medium">Couldn’t load restaurants.</p>
      <Button variant="outline" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
        {pending ? "Retrying…" : "Try again"}
      </Button>
    </Card>
  </>;
}

function RowMenu({ restaurant, select }: { restaurant: Restaurant; select: (operation: RestaurantOperation, anchor: HTMLElement | null) => void }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const openingDialog = useRef(false);
  const { active, name } = restaurant;
  const itemStyle = "flex w-full cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none data-highlighted:bg-muted [&>svg]:size-4";

  function choose(kind: "status" | "reset") {
    openingDialog.current = true;
    select({ kind, restaurant }, trigger.current);
  }

  return <DropdownMenu.Root modal={false}>
    <DropdownMenu.Trigger asChild>
      <Button ref={trigger} variant="outline" size="icon-sm" aria-label={`Actions for ${name}`}><Ellipsis /></Button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content align="end" sideOffset={5} className="z-40 min-w-44 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
        onCloseAutoFocus={event => {
          if (openingDialog.current) event.preventDefault();
          openingDialog.current = false;
        }}>
        <DropdownMenu.Item className={itemStyle} onSelect={() => choose("status")}>
          {active ? <PauseCircle /> : <PlayCircle />} {active ? "Suspend" : "Reactivate"}
        </DropdownMenu.Item>
        <DropdownMenu.Item className={itemStyle} onSelect={() => choose("reset")}><KeyRound /> Reset password</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}

export function PlatformDashboard({ restaurants }: { restaurants: Restaurant[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [operation, setOperation] = useState<RestaurantOperation | null>(null);
  const [feedback, setFeedback] = useState("");
  const returnFocus = useRef<HTMLElement | null>(null);
  const createButton = useRef<HTMLButtonElement>(null);

  const active = restaurants.filter(restaurant => restaurant.active).length;
  const stats = [
    { label: "Total Restaurants", count: restaurants.length, icon: Building2, tone: "bg-primary/10 text-primary" },
    { label: "Active", count: active, icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
    { label: "Suspended", count: restaurants.length - active, icon: PauseCircle, tone: "bg-amber-500/15 text-amber-800 dark:text-amber-200" },
  ];
  const needle = query.trim().toLowerCase();
  const found = restaurants.filter(restaurant => {
    const matchesStatus = filter === "all" || restaurant.active === (filter === "active");
    return matchesStatus && (restaurant.name.toLowerCase().includes(needle) || restaurant.slug.toLowerCase().includes(needle));
  });
  const pageCount = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const visible = found.slice(offset, offset + PAGE_SIZE);

  function open(selected: RestaurantOperation, anchor: HTMLElement | null) {
    returnFocus.current = anchor;
    setFeedback("");
    setOperation(selected);
  }

  function clearFilters() {
    setQuery("");
    setFilter("all");
    setPage(1);
  }

  return <>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Restaurants</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage restaurant access and staff credentials.</p>
      </div>
      <Button ref={createButton} onClick={event => open({ kind: "create" }, event.currentTarget)}><Plus /> Create restaurant</Button>
    </div>
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.map(({ label, count, icon: Icon, tone }) => <div key={label} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
        <div><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{count}</dd></div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="size-5" aria-hidden="true" /></span>
      </div>)}
    </dl>
    <div role="status" className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm empty:hidden">
      {feedback && <><CheckCircle2 className="size-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />{feedback}</>}
    </div>
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5">
        <h2 className="text-base font-semibold">Restaurant directory</h2>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <div className="relative min-w-36 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search name or slug" aria-label="Search restaurants" className="pl-9 sm:w-56" />
          </div>
          <div className="relative">
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <select value={filter} onChange={event => { setFilter(event.target.value as StatusFilter); setPage(1); }} aria-label="Filter by status"
              className="h-9 rounded-md border border-input bg-background pr-2 pl-8 text-sm focus-visible:outline-2 focus-visible:outline-ring">
              <option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>
      {visible.length ? <table aria-label="Restaurants" className="block w-full text-left text-sm sm:table">
        <thead className="hidden bg-muted/40 text-xs font-medium text-muted-foreground sm:table-header-group">
          <tr><th scope="col" className="px-5 py-3">Restaurant</th><th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">Created (UTC)</th><th scope="col" className="px-5 py-3 text-right">Actions</th></tr>
        </thead>
        <tbody className="block divide-y sm:table-row-group">
          {visible.map(restaurant => <tr key={restaurant.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 px-4 py-3 hover:bg-muted/20 sm:table-row">
            <th scope="row" className="min-w-0 text-left font-normal sm:px-5 sm:py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="hidden size-9 shrink-0 place-items-center rounded-lg border bg-muted/60 sm:grid"><Building2 className="size-4 text-muted-foreground" aria-hidden="true" /></span>
                <div className="min-w-0">
                  <p className="font-medium wrap-break-word">{restaurant.name}</p>
                  <p className="text-xs wrap-break-word text-muted-foreground">{restaurant.slug}</p>
                </div>
              </div>
            </th>
            <td className="col-start-1 row-start-2 pt-2 sm:px-4 sm:py-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${restaurant.active
                ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                : "bg-amber-500/15 text-amber-900 dark:text-amber-200"}`}>
                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{restaurant.active ? "Active" : "Suspended"}
              </span>
            </td>
            <td className="col-start-2 row-start-2 whitespace-nowrap pt-2 text-right text-xs text-muted-foreground sm:px-4 sm:py-3 sm:text-left sm:text-sm">
              <time dateTime={restaurant.createdAt}>{date.format(new Date(restaurant.createdAt))}</time>
            </td>
            <td className="col-start-2 row-start-1 text-right sm:px-5 sm:py-3"><RowMenu restaurant={restaurant} select={open} /></td>
          </tr>)}
        </tbody>
      </table> : <div className="grid justify-items-center gap-2 px-4 py-12 text-center">
        <Building2 className="mb-1 size-7 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">{restaurants.length ? "No matching restaurants" : "No restaurants yet"}</p>
        <p className="text-sm text-muted-foreground">{restaurants.length ? "Try a different search or status filter." : "Create a restaurant to get started."}</p>
        {restaurants.length > 0 && <Button onClick={clearFilters} variant="outline" size="sm" className="mt-2">Clear filters</Button>}
      </div>}
      {found.length > 0 && <nav aria-label="Restaurant pages" className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 sm:px-5">
        <p aria-live="polite" className="text-xs text-muted-foreground">Showing {offset + 1}–{offset + visible.length} of {found.length}</p>
        <div className="flex items-center gap-2 text-xs">
          <Button variant="outline" size="icon-sm" disabled={currentPage === 1} aria-label="Previous page" onClick={() => setPage(currentPage - 1)}><ChevronLeft /></Button>
          <span>Page {currentPage} of {pageCount}</span>
          <Button variant="outline" size="icon-sm" disabled={currentPage === pageCount} aria-label="Next page" onClick={() => setPage(currentPage + 1)}><ChevronRight /></Button>
        </div>
      </nav>}
    </Card>
    {operation && <RestaurantDialog operation={operation} close={() => setOperation(null)} onSuccess={setFeedback}
      restoreFocus={() => (returnFocus.current?.isConnected ? returnFocus.current : createButton.current)?.focus()} />}
  </>;
}
