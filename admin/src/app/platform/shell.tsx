import type { ReactNode } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { platformLogout } from "./actions";
import { MobilePlatformNavigation, PlatformSidebar } from "./navigation";

export function PlatformShell({ children, loading = false }: { children: ReactNode; loading?: boolean }) {
  return <div className="min-h-dvh lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
    <PlatformSidebar />
    <div className="min-w-0">
      <header className="border-b bg-card">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <MobilePlatformNavigation />
            <span className="truncate text-sm font-medium">Platform management</span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <span className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" /> Super Admin
            </span>
            {!loading && <form action={platformLogout}>
              <Button variant="ghost" size="sm" aria-label="Sign out"><LogOut /> <span className="hidden sm:inline">Sign out</span></Button>
            </form>}
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-8 sm:py-9">{children}</main>
    </div>
  </div>;
}
