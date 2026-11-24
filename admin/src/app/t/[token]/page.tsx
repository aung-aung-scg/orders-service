import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BackendError } from "@/lib/api";
import { getCustomerTable } from "@/lib/pos-api";
import { baht } from "@/lib/pos-schema";
import { AddItem, CartQuantity, PlaceOrder, PollOrder } from "./cart-controls";
import "../../pos.css";

export default async function CustomerPage({ params, searchParams }: PageProps<"/t/[token]">) {
  const { token } = await params;
  const query = z.uuid().safeParse((await searchParams).orderId);
  const { tableNumber, menu, order, ticket } = await getCustomerTable(token, query.data).catch(error => {
    if (error instanceof BackendError && error.status === 404) notFound();
    throw error;
  });

  return (
    <div className="customer-pos">
      <h1>Table {tableNumber}</h1>
      {ticket && (
        <p role="status" className="pos-card">
          Order status <strong>{ticket.status}</strong>
          {ticket.status !== "SERVED" && ticket.status !== "CANCELLED" && <PollOrder />}
        </p>
      )}
      <section aria-labelledby="cart-title">
        <h2 id="cart-title">Cart</h2>
        {order?.items.length ? (
          <>
            <ul className="pos-list">
              {order.items.map(item => (
                <li className="pos-card" key={item.id}>
                  <strong>{item.nameSnapshot}</strong> · {baht(item.unitPriceMinor)} each
                  {item.note && <p>{item.note}</p>}
                  <CartQuantity token={token} itemId={item.id} quantity={item.quantity} />
                </li>
              ))}
            </ul>
            <p><strong>Total {baht(order.totalMinor)}</strong></p>
            <PlaceOrder key={order.id} renderKey={randomUUID()} token={token} />
          </>
        ) : <p>Your cart is empty.</p>}
      </section>
      <section aria-labelledby="menu-title">
        <h2 id="menu-title">Menu</h2>
        {menu.length ? (
          <ul className="pos-list">
            {menu.map(item => (
              <li className="pos-card" key={item.id}>
                <h3>{item.name}</h3>
                <p>{baht(item.priceMinor)}</p>
                <AddItem token={token} menuItemId={item.id} />
              </li>
            ))}
          </ul>
        ) : <p>No menu items are available.</p>}
      </section>
    </div>
  );
}
