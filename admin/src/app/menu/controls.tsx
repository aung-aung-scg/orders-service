"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { MenuItem } from "@/lib/menu-api";
import { submitMenuItem, toggleMenuItem, type MenuState } from "./actions";

function ItemFields({ item, close }: { item?: MenuItem; close: () => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const digits = item ? String(item.priceMinor).padStart(3, "0") : "";
  const [price, setPrice] = useState(digits ? digits.slice(0, -2) + "." + digits.slice(-2) : "");
  const [state, action, pending] = useActionState(async (previous: MenuState, form: FormData) => {
    const result = await submitMenuItem(item?.id, previous, form);
    if (result.saved) close();
    return result;
  }, {});
  return (
    <form action={action} noValidate className="grid gap-4">
      <label className="grid gap-1.5 text-sm font-medium">
        Name
        <Input name="name" value={name} onChange={event => setName(event.target.value)} maxLength={80} required
          aria-invalid={Boolean(state.name)} aria-describedby={state.name ? "menu-name-error" : undefined} />
        {state.name && <span id="menu-name-error" className="text-destructive" role="alert">{state.name}</span>}
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Price (THB)
        <Input name="price" inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)}
          placeholder="120.50" required aria-invalid={Boolean(state.price)}
          aria-describedby={state.price ? "menu-price-error" : undefined} />
        {state.price && <span id="menu-price-error" className="text-destructive" role="alert">{state.price}</span>}
      </label>
      {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : item ? "Save changes" : "Add item"}</Button>
    </form>
  );
}

export function MenuEditor({ item }: { item?: MenuItem }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={item ? "outline" : "default"} aria-label={item ? "Edit " + item.name : undefined}>
          {item ? <><Pencil /> Edit</> : <><Plus /> Add item</>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Edit menu item" : "Add menu item"}</DialogTitle>
          <DialogDescription>Enter a name and a price in Thai baht.</DialogDescription>
        </DialogHeader>
        {open && <ItemFields item={item} close={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

export function AvailabilitySwitch({ item }: { item: MenuItem }) {
  const [state, action, pending] = useActionState(toggleMenuItem.bind(null, item.id, !item.available), {});
  return (
    <form action={action} className="space-y-1">
      <button type="submit" role="switch" aria-checked={item.available} aria-label={`Availability of ${item.name}`}
        disabled={pending} className="inline-flex items-center gap-2 rounded-md text-sm font-medium disabled:opacity-60">
        <span aria-hidden="true" className={`inline-flex h-6 w-10 shrink-0 items-center rounded-full border p-0.5 ${item.available ? "bg-primary" : "border-input bg-muted"}`}>
          <span className={`size-4 rounded-full shadow-sm transition-transform motion-reduce:transition-none ${item.available ? "translate-x-4 bg-primary-foreground" : "bg-muted-foreground"}`} />
        </span>
        {item.available ? "Available" : "Hidden"}
      </button>
      {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
    </form>
  );
}
