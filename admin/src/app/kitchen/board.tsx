"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRight, Clock3, Volume2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { advanceTicket } from "@/app/pos-actions";
import { tickets as ticketSchema, type Ticket } from "@/lib/pos-schema";

const columns = [
  { status: "SUBMITTED", label: "New", next: "PREPARING", button: "Start preparing" },
  { status: "PREPARING", label: "Preparing", next: "READY", button: "Mark ready" },
  { status: "READY", label: "Ready", next: "SERVED", button: "Mark served" },
] as const;

function StatusButton({ id, status, label }: { id: string; status: string; label: string }) {
  const [state, action, pending] = useActionState(advanceTicket.bind(null, id, status), {});
  const cancel = status === "CANCELLED";
  return (
    <form action={action}>
      <Button variant={cancel ? "ghost" : "default"} size={cancel ? "sm" : "lg"}
        className={cancel ? "w-full text-muted-foreground" : "h-11 w-full justify-between"}
        disabled={pending}>{pending ? "Updating…" : label}{!cancel && <ArrowRight />}</Button>
      {state.error && <p className="mt-2 text-sm text-destructive" role="alert">{state.error}</p>}
    </form>
  );
}

function chirp(audio: AudioContext | null) {
  if (!audio || audio.state !== "running") return;
  const tone = audio.createOscillator();
  const gain = audio.createGain();
  const start = audio.currentTime;
  tone.frequency.value = 740;
  gain.gain.setValueAtTime(0.15, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
  tone.connect(gain).connect(audio.destination);
  tone.start(start);
  tone.stop(start + 0.18);
}

function Age({ now, submittedAt }: { now?: number; submittedAt: string }) {
  const minutes = now === undefined ? 0 : Math.max(0, Math.floor((now - Date.parse(submittedAt)) / 60000));
  const color = minutes < 5 ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" :
    minutes < 10 ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" :
      "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200";
  return <Badge className={color}><Clock3 /> {now === undefined ? "—" : `${minutes} min`}</Badge>;
}

export function KitchenBoard({ initialTickets }: { initialTickets: Ticket[] }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [reconnecting, setReconnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState<number>();
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const soundEnabled = useRef(false);
  const knownTickets = useRef(new Set(initialTickets.map(ticket => ticket.id)));

  async function toggleSound() {
    if (soundEnabled.current) {
      soundEnabled.current = false;
      setSound(false);
      return;
    }
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      soundEnabled.current = true;
      setSound(true);
    } catch {
      setSound(false);
    }
  }

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    let stream: EventSource | undefined;
    let reconnectTimer: number | undefined;
    let pollTimer: number | undefined;
    let pendingPoll: AbortController | undefined;

    const updateBoard = (data: Ticket[]) => {
      const ids = new Set(data.map(ticket => ticket.id));
      const isNew = data.some(ticket => ticket.status === "SUBMITTED" && !knownTickets.current.has(ticket.id));
      knownTickets.current = ids;
      setTickets(data);
      if (isNew && soundEnabled.current) {
        try { chirp(audio.current); } catch {}
      }
    };
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
        if (data.success && !controller.signal.aborted) updateBoard(data.data);
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
        updateBoard(data);
        setConnected(true);
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
      if (stream?.readyState === EventSource.CLOSED && reconnectTimer === undefined) {
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = undefined;
          connect();
        }, 5000);
      }
    };
    function connect() {
      stream?.close();
      stream = new EventSource("/kitchen/stream");
      stream.addEventListener("snapshot", receive);
      stream.addEventListener("tickets", receive);
      stream.onerror = fallback;
    }
    connect();
    return () => {
      stream?.close();
      window.clearTimeout(reconnectTimer);
      stopPolling();
      window.clearInterval(clock);
      if (audio.current) void audio.current.close().catch(() => {});
      audio.current = null;
    };
  }, []);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Kitchen</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" role="status" className="px-2.5 py-1.5">
            <span aria-hidden="true" className={`size-2 rounded-full ${connected && !reconnecting ? "bg-emerald-500" : "bg-amber-500"}`} />
            {reconnecting ? "Reconnecting" : connected ? "Live" : "Connecting"}
          </Badge>
          <Button type="button" variant="outline" aria-label="New ticket sound" aria-pressed={sound} onClick={toggleSound}>
            {sound ? <Volume2 /> : <VolumeX />} Sound {sound ? "on" : "off"}
          </Button>
        </div>
      </header>
      <div className="grid items-start gap-4 md:grid-cols-3">
        {columns.map(column => {
          const lane = tickets.filter(ticket => ticket.status === column.status);
          return (
            <section key={column.status} aria-label={column.label} className="min-w-0 space-y-3 rounded-2xl border bg-muted/45 p-3">
              <div className="flex items-center justify-between gap-2 px-1 py-1">
                <h2 className="text-lg font-semibold">{column.label}</h2>
                <Badge variant="secondary">{lane.length}</Badge>
              </div>
              {!lane.length && <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">No tickets</p>}
              {lane.map(ticket => (
                <article key={ticket.id}>
                  <Card className="gap-4 rounded-2xl p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="min-w-0 wrap-break-word text-2xl font-semibold tracking-tight">Table {ticket.table.number}</h3>
                      <Age now={now} submittedAt={ticket.submittedAt} />
                    </div>
                    {ticket.previousSeating && <Badge variant="outline">Previous seating</Badge>}
                    <ul className="divide-y border-y">
                      {ticket.items.map(item => (
                        <li key={item.id} className="flex items-start gap-2 py-3 text-sm">
                          <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 font-semibold tabular-nums">{item.quantity}×</span>
                          <div className="min-w-0 space-y-1 wrap-break-word">
                            <p className="font-medium">{item.nameSnapshot}</p>
                            {item.note && <p className="text-muted-foreground">{item.note}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="space-y-1">
                      <StatusButton id={ticket.id} status={column.next} label={column.button} />
                      {column.status !== "READY" && <StatusButton id={ticket.id} status="CANCELLED" label="Cancel order" />}
                    </div>
                  </Card>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
