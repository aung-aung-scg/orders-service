"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addOrder, addProduct, type FormState } from "./actions";

function Feedback({ error, success }: FormState) {
  return (
    <>
      {error && <p className="w-full text-destructive" role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}
    </>
  );
}

export function ProductForm() {
  const [state, action, pending] = useActionState(addProduct, {});

  return (
    <form action={action} aria-label="Create product" className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 text-sm shadow-sm">
      <label className="grid gap-1">Name <Input name="name" required maxLength={200} /></label>
      <label className="grid gap-1">Stock <Input name="stock" type="number" required min={0} max={2147483647} /></label>
      <Button disabled={pending}>{pending ? "Creating…" : "Create product"}</Button>
      <Feedback {...state} />
    </form>
  );
}

export function OrderForm({ products }: { products: { id: string; name: string; stock: number }[] }) {
  const [state, action, pending] = useActionState(addOrder, {});
  if (!products.length) return <p>Create a product before placing an order.</p>;

  return (
    <form action={action} aria-label="Create order" className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 text-sm shadow-sm">
      <label className="grid min-w-0 gap-1">Product
        <select name="productId" required defaultValue="" className="h-9 max-w-full rounded-md border border-input bg-card px-2">
          <option value="" disabled>Choose a product</option>
          {products.map(product => (
            <option key={product.id} value={product.id}>{product.name} ({product.stock} in stock)</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">Quantity <Input name="quantity" type="number" required min={1} max={2147483647} defaultValue={1} /></label>
      <Button disabled={pending}>{pending ? "Creating…" : "Create order"}</Button>
      <Feedback {...state} />
    </form>
  );
}
