import { getFormatter, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { adminRoles, requireRole } from "@/lib/auth";
import { getProducts, stockDemoEnabled } from "@/lib/api";
import { ProductForm } from "../forms";

export default async function ProductsPage() {
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  await requireRole(adminRoles, { next: "/products" });
  if (!stockDemoEnabled()) notFound();
  await connection();
  const products = await getProducts();

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t("demo.products")}</h1>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{t("demo.stockDemo")}</span>
      </header>
      <ProductForm />
      {products.length ? (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full text-left text-sm [&_td]:border-t [&_td]:p-3 [&_th]:bg-muted [&_th]:p-3">
            <thead><tr><th>{t("menu.name")}</th><th>{t("demo.stock")}</th><th>{t("demo.version")}</th><th>{t("demo.createdAtUtc")}</th></tr></thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{format.number(product.stock)}</td>
                  <td>{format.number(product.version)}</td>
                  <td><time dateTime={product.createdAt}>{format.dateTime(new Date(product.createdAt), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>{t("demo.noProductsYet")}</p>}
    </section>
  );
}
