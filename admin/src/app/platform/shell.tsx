import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { platformLogout } from "./actions";
import { MobilePlatformNavigation, PlatformSidebar } from "./navigation";

export function PlatformShell({ children, loading = false }: { children: ReactNode; loading?: boolean }) {
  const t = useTranslations();
  return <div className="min-h-dvh lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
    <PlatformSidebar />
    <div className="min-w-0">
      <header className="border-b bg-card">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <MobilePlatformNavigation />
            <span className="truncate text-sm font-medium">{t("platform.platformManagement")}</span>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-4">
            <LanguageSwitcher />
            <span className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />{" "}{t("platform.superAdmin")}
            </span>
            {!loading && <form action={platformLogout}>
              <Button variant="ghost" size="sm" aria-label={t("common.signOut")}><LogOut /> <span className="hidden sm:inline">{t("common.signOut")}</span></Button>
            </form>}
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-8 sm:py-9">{children}</main>
    </div>
  </div>;
}
