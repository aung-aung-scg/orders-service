import { connection } from "next/server";
import { notFound } from "next/navigation";
import { adminRoles, requireRole } from "@/lib/auth";
import { getProducts, stockDemoEnabled } from "@/lib/api";
import { ProductForm } from "../forms";

export default async function ProductsPage() {
  await requireRole(adminRoles, { next: "/products" });
  if (!stockDemoEnabled()) notFound();
  await connection();
  const products = await getProducts();

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Stock demo</span>
      </header>
      <ProductForm />
      {products.length ? (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full text-left text-sm [&_td]:border-t [&_td]:p-3 [&_th]:bg-muted [&_th]:p-3">
            <thead><tr><th>Name</th><th>Stock</th><th>Version</th><th>Created at (UTC)</th></tr></thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.stock}</td>
                  <td>{product.version}</td>
                  <td><time dateTime={product.createdAt}>{product.createdAt}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>No products yet.</p>}
    </section>
  );
}
