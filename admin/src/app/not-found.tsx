import Link from "next/link";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("common");
  return <section className="mx-auto grid max-w-md justify-items-start gap-4 px-4 py-12">
    <LanguageSwitcher />
    <h1 className="text-2xl font-semibold">{t("pageNotFound")}</h1>
    <Button variant="outline" asChild><Link href="/">{t("backToHomepage")}</Link></Button>
  </section>;
}
