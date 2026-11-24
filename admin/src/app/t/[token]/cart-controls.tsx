"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addCartItem, placeTableOrder, updateCartItem, type PosState } from "@/app/pos-actions";

function ErrorMessage({ error }: PosState) {
  return error ? <p className="error" role="alert">{error}</p> : null;
}

export function AddItem({ token, menuItemId }: { token: string; menuItemId: string }) {
  const [state, action, pending] = useActionState(addCartItem.bind(null, token, menuItemId), {});
  return (
    <form className="pos-form" action={action}>
      <label>Quantity <input name="quantity" type="number" min={1} max={20} defaultValue={1} required /></label>
      <label>Note <input name="note" maxLength={500} /></label>
      <button disabled={pending}>{pending ? "Adding…" : "Add to cart"}</button>
      <ErrorMessage {...state} />
    </form>
  );
}

export function CartQuantity({ token, itemId, quantity }: { token: string; itemId: string; quantity: number }) {
  const [state, action, pending] = useActionState(updateCartItem.bind(null, token, itemId), {});
  return (
    <form className="pos-form" action={action}>
      <label>Quantity <input key={quantity} name="quantity" type="number" min={1} max={20} defaultValue={quantity} required /></label>
      <button disabled={pending}>Update</button>
      <button disabled={pending} formNoValidate formAction={() => {
        const form = new FormData();
        form.set("quantity", "0");
        action(form);
      }}>Remove</button>
      <ErrorMessage {...state} />
    </form>
  );
}

export function PlaceOrder({ token, renderKey }: { token: string; renderKey: string }) {
  const [key] = useState(renderKey);
  const [state, action, pending] = useActionState(placeTableOrder.bind(null, token), {});
  return (
    <form className="pos-form" action={action}>
      <input type="hidden" name="key" value={key} />
      <button disabled={pending}>{pending ? "Placing order…" : "Place order"}</button>
      <ErrorMessage {...state} />
    </form>
  );
}

export function PollOrder() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}
