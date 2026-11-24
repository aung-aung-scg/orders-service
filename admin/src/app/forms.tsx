"use client";

import { useActionState } from "react";
import { addOrder, addProduct, type FormState } from "./actions";

function Feedback({ error, success }: FormState) {
  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}
    </>
  );
}

export function ProductForm() {
  const [state, action, pending] = useActionState(addProduct, {});

  return (
    <form action={action} aria-label="Create product">
      <label>Name <input name="name" required maxLength={200} /></label>
      <label>Stock <input name="stock" type="number" required min={0} max={2147483647} /></label>
      <button disabled={pending}>{pending ? "Creating…" : "Create product"}</button>
      <Feedback {...state} />
    </form>
  );
}

export function OrderForm({ products }: { products: { id: string; name: string; stock: number }[] }) {
  const [state, action, pending] = useActionState(addOrder, {});
  if (!products.length) return <p>Create a product before placing an order.</p>;

  return (
    <form action={action} aria-label="Create order">
      <label>Product
        <select name="productId" required defaultValue="">
          <option value="" disabled>Choose a product</option>
          {products.map(product => (
            <option key={product.id} value={product.id}>{product.name} ({product.stock} in stock)</option>
          ))}
        </select>
      </label>
      <label>Quantity <input name="quantity" type="number" required min={1} max={2147483647} defaultValue={1} /></label>
      <button disabled={pending}>{pending ? "Creating…" : "Create order"}</button>
      <Feedback {...state} />
    </form>
  );
}
