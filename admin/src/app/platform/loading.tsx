import { Skeleton } from "@/components/ui/skeleton";
import { PlatformShell } from "./shell";

export default function Loading() {
  return <PlatformShell loading>
    <div aria-busy="true" className="grid gap-6">
      <p role="status" className="sr-only">Loading restaurants…</p>
      <Skeleton className="h-16 w-full max-w-sm rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-3">
        {["total", "active", "suspended"].map(label => <Skeleton key={label} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  </PlatformShell>;
}
