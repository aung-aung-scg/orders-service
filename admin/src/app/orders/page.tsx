import { connection } from "next/server";
import { notFound } from "next/navigation";
import { adminRoles, requireRole } from "@/lib/auth";
import { getOrders, getProducts, stockDemoEnabled } from "@/lib/api";
import { OrderForm } from "../forms";

export default async function OrdersPage() {
  await requireRole(adminRoles, { next: "/orders" });
  if (!stockDemoEnabled()) notFound();
  await connection();
  const [orders, products] = await Promise.all([getOrders(), getProducts()]);
  const productNames = new Map(products.map(({ id, name }) => [id, name]));

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
      <OrderForm products={products.map(({ id, name, stock }) => ({ id, name, stock }))} />
      {orders.length ? (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full text-left text-sm [&_td]:border-t [&_td]:p-3 [&_th]:bg-muted [&_th]:p-3">
            <thead><tr><th>Order ID</th><th>Status</th><th>Items</th></tr></thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{order.status}</td>
                  <td>
                    <ul>
                      {order.items.map(item => (
                        <li key={item.id}>{productNames.get(item.productId) ?? item.productId} × {item.quantity}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>No orders yet.</p>}
    </section>
  );
}
