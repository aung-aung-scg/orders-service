"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { setLanguage } from "@/i18n/actions";
import { languageNames, locales } from "@/i18n/locales";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("common");
  const [pending, startTransition] = useTransition();
  return <label className="relative inline-flex max-w-full items-center">
    <Languages className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" aria-hidden="true" />
    <span className="sr-only">{t("language")}</span>
    <select value={locale} disabled={pending} onChange={event => {
      const next = event.target.value;
      startTransition(() => setLanguage(next));
    }} className="h-9 max-w-full rounded-md border border-input bg-background pr-2 pl-8 text-sm focus-visible:outline-2 focus-visible:outline-ring">
      {locales.map(value => <option key={value} value={value} lang={value}>{languageNames[value]}</option>)}
    </select>
  </label>;
}
