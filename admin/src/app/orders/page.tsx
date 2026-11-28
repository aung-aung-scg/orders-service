import { getFormatter, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { adminRoles, requireRole } from "@/lib/auth";
import { getOrders, getProducts, stockDemoEnabled } from "@/lib/api";
import { OrderForm } from "../forms";

export default async function OrdersPage() {
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  await requireRole(adminRoles, { next: "/orders" });
  if (!stockDemoEnabled()) notFound();
  await connection();
  const [orders, products] = await Promise.all([getOrders(), getProducts()]);
  const productNames = new Map(products.map(({ id, name }) => [id, name]));

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">{t("demo.orders")}</h1>
      <OrderForm products={products.map(({ id, name, stock }) => ({ id, name, stock }))} />
      {orders.length ? (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full text-left text-sm [&_td]:border-t [&_td]:p-3 [&_th]:bg-muted [&_th]:p-3">
            <thead><tr><th>{t("demo.orderId")}</th><th>{t("platform.status")}</th><th>{t("demo.items")}</th></tr></thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{t(({ PENDING: "feedback.stockPending", PAID: "feedback.stockPaid", REFUNDED: "feedback.stockRefunded", FAILED: "feedback.stockFailed", CANCELLED: "feedback.stockCancelled", CONFIRMED: "booking.confirmed" } as Record<string, string>)[order.status] ?? "feedback.stockPending")}</td>
                  <td>
                    <ul>
                      {order.items.map(item => (
                        <li key={item.id}>{productNames.get(item.productId) ?? item.productId} × {format.number(item.quantity, "quantity")}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>{t("demo.noOrdersYet")}</p>}
    </section>
  );
}
