"use client";

import { useActionState, useEffect, useState } from "react";
import { advanceTicket } from "@/app/pos-actions";
import { tickets as ticketSchema, type Ticket } from "@/lib/pos-schema";

const columns = [
  { status: "SUBMITTED", label: "New", next: "PREPARING", button: "Start preparing" },
  { status: "PREPARING", label: "Preparing", next: "READY", button: "Mark ready" },
  { status: "READY", label: "Ready", next: "SERVED", button: "Mark served" },
] as const;

function StatusButton({ id, status, label }: { id: string; status: string; label: string }) {
  const [state, action, pending] = useActionState(advanceTicket.bind(null, id, status), {});
  return (
    <form className="pos-form" action={action}>
      <button disabled={pending}>{pending ? "Updating…" : label}</button>
      {state.error && <p className="error" role="alert">{state.error}</p>}
    </form>
  );
}

export function KitchenBoard({ initialTickets }: { initialTickets: Ticket[] }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [reconnecting, setReconnecting] = useState(false);
  const [now, setNow] = useState<number>();

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const stream = new EventSource("/kitchen/stream");
    let pollTimer: number | undefined;
    let pendingPoll: AbortController | undefined;

    const stopPolling = () => {
      window.clearInterval(pollTimer);
      pollTimer = undefined;
      pendingPoll?.abort();
      pendingPoll = undefined;
    };
    const poll = async () => {
      if (pendingPoll) return;
      const controller = new AbortController();
      pendingPoll = controller;
      try {
        const response = await fetch("/kitchen/orders", { signal: controller.signal, cache: "no-store" });
        if (!response.ok || controller.signal.aborted) return;
        const data = ticketSchema.safeParse(await response.json());
        if (data.success && !controller.signal.aborted) setTickets(data.data);
      } catch {
        // The interval retries while the event stream reconnects.
      } finally {
        if (pendingPoll === controller) pendingPoll = undefined;
      }
    };
    const receive = (event: MessageEvent<string>) => {
      try {
        const data = ticketSchema.parse(JSON.parse(event.data));
        stopPolling();
        setTickets(data);
        setReconnecting(false);
      } catch {
        fallback();
      }
    };
    const fallback = () => {
      setReconnecting(true);
      if (pollTimer === undefined) {
        void poll();
        pollTimer = window.setInterval(poll, 5000);
      }
    };
    stream.addEventListener("snapshot", receive);
    stream.addEventListener("tickets", receive);
    stream.onerror = fallback;
    return () => {
      stream.close();
      stopPolling();
      window.clearInterval(clock);
    };
  }, []);

  return (
    <>
      {reconnecting && <p role="status">Reconnecting to the kitchen stream…</p>}
      <div className="kitchen-columns">
        {columns.map(column => (
          <section key={column.status} aria-label={column.label}>
            <h2>{column.label}</h2>
            {tickets.filter(ticket => ticket.status === column.status).map(ticket => (
              <article className="pos-card" key={ticket.id}>
                <h3>Table {ticket.table.number}</h3>
                {now !== undefined && <p>{Math.max(0, Math.floor((now - Date.parse(ticket.submittedAt)) / 60000))} min elapsed</p>}
                <ul>
                  {ticket.items.map(item => (
                    <li key={item.id}>
                      {item.quantity} × {item.nameSnapshot}
                      {item.note && <p>{item.note}</p>}
                    </li>
                  ))}
                </ul>
                <StatusButton id={ticket.id} status={column.next} label={column.button} />
                {column.status !== "READY" && <StatusButton id={ticket.id} status="CANCELLED" label="Cancel order" />}
              </article>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
