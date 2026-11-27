"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { resetTable } from "./actions";

export function ResetForm({ id, current, override }: { id: string; current: string | null; override: boolean }) {
  const [state, action, pending] = useActionState(resetTable.bind(null, id, current, override), {});
  const label = override ? "Override and reset" : current ? "Reset table" : "Start seating";
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant={override ? "destructive" : "outline"}>{label}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>A new join code is issued. Any unsubmitted cart is closed. Submitted tickets stay in the kitchen.</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-3">
          {override && <label className="grid gap-1 text-sm">Override reason <Input name="reason" required maxLength={500} /></label>}
          {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
          <Button disabled={pending}>{pending ? "Saving…" : label}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
