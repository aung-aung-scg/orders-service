import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ClipboardList, ShoppingBag, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BackendError } from "@/lib/api";
import { customerPath, getCustomerTable } from "@/lib/pos-api";
import { baht } from "@/lib/pos-schema";
import { ThemeToggle } from "../../theme-toggle";
import { OrderHistory } from "../../order-history";
import { AddItem, CartQuantity, JoinTable, OrderUpdates, PlaceOrder } from "./cart-controls";

export default async function CustomerPage({ params, searchParams }: PageProps<"/t/[token]">) {
  const { token } = await params;
  const paramsQuery = await searchParams;
  const query = z.uuid().safeParse(paramsQuery.orderId);
  const showingOrders = paramsQuery.view === "orders" || (paramsQuery.view === undefined && query.success);
  const { tableNumber, sessionId, menu, order, submittedOrders, sessionTotalMinor, sessionEnded } = await getCustomerTable(token).catch(error => {
    if (error instanceof BackendError && error.status === 404) notFound();
    throw error;
  });

  if (!sessionId || (paramsQuery.session !== undefined && paramsQuery.session !== sessionId)) {
    const ended = sessionEnded || typeof paramsQuery.session === "string";
    return (
      <div data-customer className="mx-auto max-w-md px-4 py-10">
        <Card className="gap-4 rounded-2xl p-5">
          <h1 className="text-2xl font-semibold">Join Table {tableNumber}</h1>
          {ended && <p role="status" className="font-medium">This dining session has ended.</p>}
          <p className="text-sm text-muted-foreground">Ask staff for the current join code. Everyone using that code shares one cart.</p>
          <JoinTable token={token} />
        </Card>
      </div>
    );
  }
  if (paramsQuery.session === undefined) {
    const search = new URLSearchParams({ session: sessionId });
    if (showingOrders) search.set("view", "orders");
    if (query.data) search.set("orderId", query.data);
    redirect(customerPath(token) + "?" + search);
  }

  const count = order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const menuPath = customerPath(token) + "?" + new URLSearchParams({ session: sessionId });
  const ordersPath = menuPath + "&view=orders";

  return (
    <div data-customer className="pb-28">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <h1 className="text-xl font-semibold tracking-tight">Table {tableNumber}</h1>
          <ThemeToggle />
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-7 px-4 py-6 sm:px-8 sm:py-9">
        <OrderUpdates orders={submittedOrders.map(({ id, status }) => ({ id, status }))} />
        {showingOrders ? (
          <section aria-labelledby="my-orders-title" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="my-orders-title" className="text-3xl font-semibold tracking-tight">My Orders</h2>
              <p className="rounded-xl border bg-card px-3 py-2 text-sm">Session total <strong className="tabular-nums">{baht(sessionTotalMinor)}</strong></p>
            </div>
            <OrderHistory orders={submittedOrders} expandedOrderId={query.data} />
          </section>
        ) : (
          <section aria-labelledby="menu-title" className="space-y-4">
          <h2 id="menu-title" className="text-3xl font-semibold tracking-tight">Menu</h2>
          {menu.length ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {menu.map(item => (
                <li key={item.id}>
                  <Card className="h-full gap-5 rounded-2xl px-4 py-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 wrap-break-word text-base font-semibold">{item.name}</h3>
                      <p className="shrink-0 font-semibold text-accent-foreground">{baht(item.priceMinor)}</p>
                    </div>
                    <AddItem token={token} sessionId={sessionId} menuItemId={item.id} />
                  </Card>
                </li>
              ))}
            </ul>
          ) : <p className="rounded-2xl border bg-card p-6 text-muted-foreground">No menu items are available.</p>}
          </section>
        )}
      </div>
      <Sheet key={order?.id ?? "empty"}>
        <nav aria-label="Table ordering" className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur">
          <div className="mx-auto grid max-w-lg grid-cols-3 gap-1 sm:gap-2">
            <Button asChild variant={showingOrders ? "ghost" : "secondary"} className="h-12 min-w-0 gap-1 px-1.5 text-xs sm:text-sm">
              <Link href={menuPath} prefetch={false} aria-current={showingOrders ? undefined : "page"}><Utensils /> Menu</Link>
            </Button>
            <SheetTrigger asChild>
              <Button aria-label={`Cart · ${count} ${count === 1 ? "item" : "items"}`} variant="ghost" className="h-12 min-w-0 gap-1 px-1.5 text-xs sm:text-sm">
                <ShoppingBag /> Cart <Badge variant="outline">{count}</Badge>
              </Button>
            </SheetTrigger>
            <Button asChild variant={showingOrders ? "secondary" : "ghost"} className="h-12 min-w-0 gap-1 px-1.5 text-xs sm:text-sm">
              <Link href={ordersPath} prefetch={false} aria-current={showingOrders ? "page" : undefined}>
                <ClipboardList className="hidden sm:block" /> My Orders <Badge variant="outline">{submittedOrders.length}</Badge>
              </Link>
            </Button>
          </div>
        </nav>
        <SheetContent side="bottom" className="mx-auto flex max-h-[90dvh] max-w-xl gap-0 overflow-hidden rounded-t-2xl">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle>Your cart</SheetTitle>
            <SheetDescription>{count} {count === 1 ? "item" : "items"} · {baht(order?.totalMinor ?? 0)}</SheetDescription>
          </SheetHeader>
          {order?.items.length ? (
            <>
              <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {order.items.map(item => (
                  <li key={item.id} className="space-y-3 rounded-xl border bg-background p-3">
                    <div className="flex justify-between gap-2 text-sm">
                      <strong className="min-w-0 wrap-break-word">{item.nameSnapshot}</strong>
                      <span className="shrink-0 text-muted-foreground">{baht(item.unitPriceMinor)} each</span>
                    </div>
                    {item.note && <p className="wrap-break-word text-sm text-muted-foreground">{item.note}</p>}
                    <CartQuantity token={token} sessionId={sessionId} itemId={item.id} quantity={item.quantity} />
                  </li>
                ))}
              </ul>
              <div className="border-t px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <PlaceOrder key={`${order.id}:${order.version}`} renderKey={randomUUID()} token={token} sessionId={sessionId} cartId={order.id} version={order.version} />
              </div>
            </>
          ) : <p className="px-5 py-10 text-center text-muted-foreground">Your cart is empty.</p>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
