"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cancelGuestBooking } from "../../booking-actions";

export function CancelForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(cancelGuestBooking.bind(null, code), {});
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline">Cancel reservation</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this reservation?</DialogTitle>
          <DialogDescription>The table will be released for other guests.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-3">
          {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Keep reservation</Button></DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>{pending ? "Cancelling…" : "Cancel reservation"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
