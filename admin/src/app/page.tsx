import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Home() {
  const t = useTranslations();
  return (
    <section className="mx-auto max-w-xl px-4 py-12 sm:py-20">
      <Card className="gap-4 p-6 sm:p-8">
        <div className="flex justify-end"><LanguageSwitcher /></div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("common.restaurantReservations")}</h1>
        <p className="text-muted-foreground">{t("common.findATimeAndReserveATable")}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link prefetch={false} href="/r/default/book">{t("common.bookATable")}</Link></Button>
          <Button asChild variant="outline"><Link href="/r/default/my-reservations">{t("common.myReservations")}</Link></Button>
          <Button asChild variant="outline"><Link href="/r/default/login">{t("common.staffSignIn")}</Link></Button>
          <Button asChild variant="ghost"><Link href="/platform/login">{t("common.platformSignIn")}</Link></Button>
        </div>
      </Card>
    </section>
  );
}
