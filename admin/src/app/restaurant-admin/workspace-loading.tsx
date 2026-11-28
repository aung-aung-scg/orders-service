import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

export default function WorkspaceLoading() {
  const t = useTranslations();
  return <div aria-busy="true" className="grid gap-6">
    <p role="status" className="sr-only">{t("common.loading")}</p>
    <Skeleton className="h-11 w-48" />
    <div className="grid gap-3 sm:grid-cols-3">
      {["first", "second", "third"].map(slot => <Skeleton key={slot} className="h-24 rounded-xl" />)}
    </div>
    <Skeleton className="h-56 rounded-xl" />
  </div>;
}
