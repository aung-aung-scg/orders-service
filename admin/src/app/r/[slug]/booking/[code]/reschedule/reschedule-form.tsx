"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { moveGuestBooking } from "@/app/booking-actions";

export function RescheduleForm({ slug, code, revision, slots }: {
  slug: string;
  code: string; revision: string; slots: { startsAt: string; label: string; date: string }[];
}) {
  const [choice, setChoice] = useState("");
  const [state, action, pending] = useActionState(moveGuestBooking.bind(null, slug, code, revision), {});
  const selected = slots.find(slot => slot.startsAt === choice);
  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">New time</legend>
        <div className="grid grid-cols-3 gap-2">
          {slots.map(slot => (
            <label key={slot.startsAt} className="flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border text-sm has-checked:border-primary">
              <input type="radio" name="time" checked={choice === slot.startsAt} onChange={() => setChoice(slot.startsAt)} />
              {slot.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Dialog>
        <DialogTrigger asChild><Button disabled={!selected}>Review change</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm rescheduling?</DialogTitle>
            <DialogDescription>{selected ? `Move your reservation to ${selected.date} at ${selected.label}.` :
              "This time is no longer listed. Choose another time to continue."}</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-3">
            <input type="hidden" name="startsAt" value={selected?.startsAt ?? ""} />
            {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Back</Button></DialogClose>
              <Button disabled={pending || !selected}>{pending ? "Saving…" : "Confirm reschedule"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
