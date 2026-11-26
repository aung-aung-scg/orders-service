import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Check, ChevronRight, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BackendError } from "@/lib/api";
import { getCustomerTable } from "@/lib/pos-api";
import { baht } from "@/lib/pos-schema";
import { ThemeToggle } from "../../theme-toggle";
import { AddItem, CartQuantity, OrderUpdates, PlaceOrder } from "./cart-controls";

const steps = [
  ["SUBMITTED", "Received"], ["PREPARING", "Preparing"], ["READY", "Ready"], ["SERVED", "Served"],
] as const;

export default async function CustomerPage({ params, searchParams }: PageProps<"/t/[token]">) {
  const { token } = await params;
  const query = z.uuid().safeParse((await searchParams).orderId);
  const { tableNumber, menu, order, ticket } = await getCustomerTable(token, query.data).catch(error => {
    if (error instanceof BackendError && error.status === 404) notFound();
    throw error;
  });

  const count = order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const currentStep = steps.findIndex(([status]) => status === ticket?.status);

  return (
    <div data-customer className="pb-28">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <h1 className="text-xl font-semibold tracking-tight">Table {tableNumber}</h1>
          <ThemeToggle />
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-7 px-4 py-6 sm:px-8 sm:py-9">
        <OrderUpdates status={ticket?.status} />
        {ticket && (
          <Card className="gap-4 rounded-2xl px-4 py-4 shadow-sm sm:px-6">
            <h2 className="text-lg font-semibold">Order status</h2>
            {ticket.status === "CANCELLED" ? <p role="status" className="text-destructive">Cancelled</p> : (
              <ol aria-label="Order progress" className="grid grid-cols-4 gap-1">
                {steps.map(([status, label], index) => (
                  <li key={status} aria-current={index === currentStep ? "step" : undefined} className={`grid justify-items-center gap-2 text-xs sm:text-sm ${index <= currentStep ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    <span aria-hidden="true" className={`grid size-8 place-items-center rounded-full ${index <= currentStep ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {index < currentStep ? <Check className="size-4" /> : index + 1}
                    </span>
                    {label}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        )}
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
                    <AddItem token={token} menuItemId={item.id} />
                  </Card>
                </li>
              ))}
            </ul>
          ) : <p className="rounded-2xl border bg-card p-6 text-muted-foreground">No menu items are available.</p>}
        </section>
      </div>
      <Sheet key={order?.id ?? "empty"}>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur">
          <SheetTrigger asChild>
            <Button className="mx-auto flex h-12 w-full max-w-lg justify-between px-4 text-sm">
              <span className="flex items-center gap-2"><ShoppingBag />{`Cart · ${count} ${count === 1 ? "item" : "items"}`}</span>
              <span className="flex items-center gap-2">{baht(order?.totalMinor ?? 0)} <ChevronRight /></span>
            </Button>
          </SheetTrigger>
        </div>
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
                    <CartQuantity token={token} itemId={item.id} quantity={item.quantity} />
                  </li>
                ))}
              </ul>
              <div className="border-t px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <PlaceOrder key={order.id} renderKey={randomUUID()} token={token} />
              </div>
            </>
          ) : <p className="px-5 py-10 text-center text-muted-foreground">Your cart is empty.</p>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
