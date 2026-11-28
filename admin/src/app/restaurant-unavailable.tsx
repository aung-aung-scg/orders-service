import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function RestaurantUnavailable() {
  const t = useTranslations();
  return <main className="grid min-h-[65vh] place-items-center px-4">
    <Card className="w-full max-w-md gap-4 p-6">
      <div className="flex justify-end"><LanguageSwitcher /></div>
      <h1 className="text-xl font-semibold">{t("common.restaurantTemporarilyUnavailable")}</h1>
      <p className="text-sm text-muted-foreground">{t("common.pleaseCheckBackLaterOrContactThe")}</p>
      <Button asChild variant="outline" className="w-fit"><Link href="/">{t("common.backToHomepage")}</Link></Button>
    </Card>
  </main>;
}
