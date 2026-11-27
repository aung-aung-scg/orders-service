"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function WorkspaceEmpty({ title, detail, children }: { title: string; detail?: string; children?: ReactNode }) {
  return <Card className="items-center gap-2 p-8 text-center">
    <p className="font-medium">{title}</p>
    {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
    {children}
  </Card>;
}

export function WorkspaceLoadError({ message, reset }: { message: string; reset?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <Card className="items-start gap-3 p-5">
    <CircleAlert className="size-5 text-destructive" aria-hidden="true" />
    <p role="alert" className="font-medium">{message}</p>
    <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(() => {
      if (reset) reset();
      router.refresh();
    })}>{pending ? "Retrying…" : "Try again"}</Button>
  </Card>;
}

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return <WorkspaceLoadError message="Couldn’t load this page." reset={reset} />;
}
