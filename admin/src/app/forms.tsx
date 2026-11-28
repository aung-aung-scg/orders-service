"use client";

import { useFormatter, useTranslations } from "next-intl";
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
  const t = useTranslations();
  const [state, action, pending] = useActionState(addProduct, {});

  return (
    <form action={action} noValidate aria-label={t("demo.createProduct")} className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 text-sm shadow-sm">
      <label className="grid gap-1">{t("menu.name")}{" "}<Input name="name" required maxLength={200} /></label>
      <label className="grid gap-1">{t("demo.stock")}{" "}<Input name="stock" type="number" required min={0} max={2147483647} /></label>
      <Button disabled={pending}>{pending ? t("demo.creating") : t("demo.createProduct")}</Button>
      <Feedback {...state} />
    </form>
  );
}

export function OrderForm({ products }: { products: { id: string; name: string; stock: number }[] }) {
  const t = useTranslations();
  const format = useFormatter();
  const [state, action, pending] = useActionState(addOrder, {});
  if (!products.length) return <p>{t("demo.createAProductBeforePlacingAnOrder")}</p>;

  return (
    <form action={action} noValidate aria-label={t("demo.createOrder")} className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 text-sm shadow-sm">
      <label className="grid min-w-0 gap-1">{t("demo.product")}
        <select name="productId" required defaultValue="" className="h-9 max-w-full rounded-md border border-input bg-card px-2">
          <option value="" disabled>{t("demo.chooseAProduct")}</option>
          {products.map(product => (
            <option key={product.id} value={product.id}>{product.name} ({format.number(product.stock, "quantity")}{" "}{t("demo.inStock")}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">{t("customer.quantity")}{" "}<Input name="quantity" type="number" required min={1} max={2147483647} defaultValue={1} /></label>
      <Button disabled={pending}>{pending ? t("demo.creating") : t("demo.createOrder")}</Button>
      <Feedback {...state} />
    </form>
  );
}
