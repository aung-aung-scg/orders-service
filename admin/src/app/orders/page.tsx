import { connection } from "next/server";
import { adminRoles, requireRole } from "@/lib/auth";
import { getOrders, getProducts } from "@/lib/api";
import { OrderForm } from "../forms";

export default async function OrdersPage() {
  await requireRole(adminRoles, { next: "/orders" });
  await connection();
  const [orders, products] = await Promise.all([getOrders(), getProducts()]);
  const productNames = new Map(products.map(({ id, name }) => [id, name]));

  return (
    <>
      <h1>Orders</h1>
      <OrderForm products={products.map(({ id, name, stock }) => ({ id, name, stock }))} />
      {orders.length ? (
        <div className="table-scroll">
          <table>
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
    </>
  );
}
