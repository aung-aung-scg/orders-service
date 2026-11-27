"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCartItem, joinTable, placeTableOrder, updateCartItem, type PosState } from "@/app/pos-actions";
import { orderLabels, type SubmittedOrder } from "@/lib/pos-schema";

function ErrorMessage({ error }: PosState) {
  return error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null;
}

function Quantity({ initial = 1 }: { initial?: number }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border p-1">
      <Button type="button" variant="ghost" size="icon" aria-label="Decrease quantity" onClick={() => input.current?.stepDown()}><Minus /></Button>
      <Input ref={input} aria-label="Quantity" name="quantity" type="number" min={1} max={20} defaultValue={initial} required
        className="w-11 appearance-none border-0 px-0 text-center tabular-nums shadow-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
      <Button type="button" variant="ghost" size="icon" aria-label="Increase quantity" onClick={() => input.current?.stepUp()}><Plus /></Button>
    </div>
  );
}

export function JoinTable({ token }: { token: string }) {
  const [state, action, pending] = useActionState(joinTable.bind(null, token), {});
  return (
    <form action={action} className="grid gap-3">
      <label className="grid gap-1.5 text-sm font-medium">
        Join code
        <Input name="code" autoCapitalize="characters" autoComplete="off" spellCheck={false} required />
      </label>
      <ErrorMessage {...state} />
      <Button disabled={pending}>{pending ? "Joining…" : "Join table"}</Button>
    </form>
  );
}

export function AddItem({ token, sessionId, menuItemId }: { token: string; sessionId: string; menuItemId: string }) {
  const [state, action, pending] = useActionState(addCartItem.bind(null, token, sessionId, menuItemId), {});
  return (
    <form className="grid gap-3" action={action}>
      <label className="grid gap-1.5 text-sm text-muted-foreground">
        Note <Input name="note" maxLength={500} placeholder="Optional" className="h-10 text-foreground" />
      </label>
      <div className="flex items-center justify-between gap-2">
        <Quantity />
        <Button className="h-11" disabled={pending}><ShoppingBag /> {pending ? "Adding…" : "Add to cart"}</Button>
      </div>
      <ErrorMessage {...state} />
    </form>
  );
}

export function CartQuantity({ token, sessionId, itemId, quantity }: { token: string; sessionId: string; itemId: string; quantity: number }) {
  const [state, action, pending] = useActionState(updateCartItem.bind(null, token, sessionId, itemId), {});
  return (
    <form className="grid gap-2" action={action}>
      <div className="flex flex-wrap items-center gap-2">
        <Quantity key={quantity} initial={quantity} />
        <Button variant="outline" disabled={pending}>Update</Button>
        <Button variant="ghost" className="text-destructive" disabled={pending} formNoValidate formAction={() => {
          const form = new FormData();
          form.set("quantity", "0");
          action(form);
        }}>Remove</Button>
      </div>
      <ErrorMessage {...state} />
    </form>
  );
}

export function PlaceOrder({ token, sessionId, renderKey, cartId, version }: { token: string; sessionId: string; renderKey: string; cartId: string; version: number }) {
  const router = useRouter();
  const [key] = useState(renderKey);
  const [state, action, pending] = useActionState(placeTableOrder.bind(null, token, sessionId, cartId, version), {});
  return (
    <form className="grid gap-2" action={action}>
      <input type="hidden" name="key" value={key} />
      <ErrorMessage {...state} />
      {state.cartChanged ? <Button type="button" onClick={() => router.refresh()}>Review updated cart</Button> :
        <Button className="h-12 w-full text-base" disabled={pending}>{pending ? "Placing order…" : "Place order"}</Button>}
    </form>
  );
}

export function OrderUpdates({ orders }: { orders: Pick<SubmittedOrder, "id" | "status">[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const previous = useRef(new Map(orders.map(order => [order.id, order.status])));

  useEffect(() => {
    for (const { id, status } of orders) {
      if (previous.current.has(id) && previous.current.get(id) !== status) toast(`Order status: ${orderLabels[status]}`);
    }
    previous.current = new Map(orders.map(order => [order.id, order.status]));
  }, [orders]);
  useEffect(() => {
    if (pending) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) startTransition(() => router.refresh());
    }, 5000);
    return () => window.clearInterval(timer);
  }, [pending, router]);
  return <Toaster position="top-center" className="[--normal-bg:var(--card)] [--normal-border:var(--border)] [--normal-text:var(--foreground)]" />;
}
