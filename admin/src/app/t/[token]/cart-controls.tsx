"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCartItem, placeTableOrder, updateCartItem, type PosState } from "@/app/pos-actions";

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

export function AddItem({ token, menuItemId }: { token: string; menuItemId: string }) {
  const [state, action, pending] = useActionState(addCartItem.bind(null, token, menuItemId), {});
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

export function CartQuantity({ token, itemId, quantity }: { token: string; itemId: string; quantity: number }) {
  const [state, action, pending] = useActionState(updateCartItem.bind(null, token, itemId), {});
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

export function PlaceOrder({ token, renderKey }: { token: string; renderKey: string }) {
  const [key] = useState(renderKey);
  const [state, action, pending] = useActionState(placeTableOrder.bind(null, token), {});
  return (
    <form className="grid gap-2" action={action}>
      <input type="hidden" name="key" value={key} />
      <ErrorMessage {...state} />
      <Button className="h-12 w-full text-base" disabled={pending}>{pending ? "Placing order…" : "Place order"}</Button>
    </form>
  );
}

const labels: Record<string, string> = { SUBMITTED: "Received", PREPARING: "Preparing", READY: "Ready", SERVED: "Served", CANCELLED: "Cancelled" };

export function OrderUpdates({ status }: { status?: string }) {
  const router = useRouter();
  const previous = useRef(status);
  const active = status && status !== "SERVED" && status !== "CANCELLED";

  useEffect(() => {
    if (previous.current !== status && status && labels[status]) toast(`Order status: ${labels[status]}`);
    previous.current = status;
  }, [status]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [active, router]);
  return <Toaster position="top-center" className="[--normal-bg:var(--card)] [--normal-border:var(--border)] [--normal-text:var(--foreground)]" />;
}
