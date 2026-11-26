import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingTable() {
  return (
    <div data-customer role="status" aria-label="Loading table menu" className="pb-28">
      <div className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <Skeleton className="h-6 w-24 rounded-lg" />
          <Skeleton className="size-9 rounded-lg" />
        </div>
      </div>
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-8 sm:py-9">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="space-y-4 rounded-2xl border bg-card p-4" key={index}>
              <Skeleton className="h-5 w-2/3 rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
