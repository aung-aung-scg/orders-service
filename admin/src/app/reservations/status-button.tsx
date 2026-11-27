"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { changeStaffBooking } from "../booking-actions";

export function StatusButton({ id, status, label }: {
  id: string; status: "SEATED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"; label: string;
}) {
  const [state, action, pending] = useActionState(changeStaffBooking.bind(null, id, status), {});
  return (
    <form action={action} className="space-y-1">
      <Button disabled={pending} size="sm" variant={status === "SEATED" || status === "COMPLETED" ? "default" : "outline"}>
        {pending ? "Updating…" : label}
      </Button>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
